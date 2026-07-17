import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  getBankAccounts,
  importBankTransactions,
  getUnreconciledTransactions,
  createBankReconciliation,
  createBatchPayment,
  suggestPaymentMatches,
  matchBankTransaction,
  matchBankWithNewPayment,
  excludeBankTransaction,
  getReconciliationSummary,
  matchBankToInvoice,
  splitBankTransaction,
} from "@/services/bank.service";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "unreconciled") {
      const accountId = searchParams.get("bankAccountId") || undefined;
      return successResponse(await getUnreconciledTransactions(accountId));
    }

    if (view === "reconciliations") {
      const accountId = searchParams.get("bankAccountId") || undefined;
      const recs = await prisma.bankReconciliation.findMany({
        where: accountId ? { bankAccountId: accountId } : undefined,
        include: { bankAccount: true },
        orderBy: { statementDate: "desc" },
        take: 50,
      });
      return successResponse(recs);
    }

    if (view === "suggest-matches") {
      const transactionId = searchParams.get("transactionId");
      if (!transactionId) return errorResponse("transactionId required");
      return successResponse(await suggestPaymentMatches(transactionId));
    }

    if (view === "summary") {
      const accountId = searchParams.get("bankAccountId");
      if (!accountId) return errorResponse("bankAccountId required");
      return successResponse(await getReconciliationSummary(accountId));
    }

    return successResponse(await getBankAccounts());
  },
  { module: "bank", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const action = body.action;

    try {
      switch (action) {
        case "import": {
          const result = await importBankTransactions(body.bankAccountId, body.transactions);
          return successResponse(result, `${result.imported} transactions imported`);
        }
        case "match-payment": {
          const tx = await matchBankTransaction(body.transactionId, body.paymentId, user.id);
          return successResponse(tx, "Bank transaction matched to payment");
        }
        case "match-create-payment": {
          const result = await matchBankWithNewPayment(body.transactionId, {
            userId: user.id,
            allocations: body.allocations,
            reference: body.reference,
            notes: body.notes,
          });
          return successResponse(result, "Payment created and bank transaction matched", 201);
        }
        case "match-invoice": {
          const tx = await matchBankToInvoice(body.transactionId, body.invoiceId, user.id);
          return successResponse(tx, "Bank transaction matched to invoice");
        }
        case "split-transaction": {
          const result = await splitBankTransaction(body.transactionId, body.splits, user.id);
          return successResponse(result, "Bank transaction split");
        }
        case "exclude": {
          const tx = await excludeBankTransaction(body.transactionId, user.id);
          return successResponse(tx, "Transaction excluded from reconciliation");
        }
        case "complete-reconciliation": {
          const rec = await createBankReconciliation({
            bankAccountId: body.bankAccountId,
            statementDate: body.statementDate,
            openingBalance: body.openingBalance,
            closingBalance: body.closingBalance,
            userId: user.id,
            notes: body.notes,
            postVariance: body.postVariance !== false,
          });
          return successResponse(rec, "Bank reconciliation completed");
        }
        case "batch-payment": {
          const batch = await createBatchPayment({
            bankAccountId: body.bankAccountId,
            payableIds: body.payableIds,
            userId: user.id,
          });
          return successResponse(batch, "Batch payment processed", 201);
        }
        case "create-account": {
          const gl1110 = await prisma.chartOfAccount.findUnique({ where: { code: "1110" } });
          const account = await prisma.bankAccount.create({
            data: {
              code: body.code,
              name: body.name,
              bankName: body.bankName,
              accountNumber: body.accountNumber,
              currency: body.currency || "UGX",
              openingBalance: body.openingBalance || 0,
              currentBalance: body.openingBalance || 0,
              glAccountId: gl1110?.id,
            },
          });
          return successResponse(account, "Bank account created", 201);
        }
        default:
          return errorResponse("Unknown action");
      }
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Bank action failed");
    }
  },
  { module: "bank", action: "create" }
);
