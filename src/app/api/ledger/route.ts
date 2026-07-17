import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { journalSchema } from "@/lib/validations";
import { postJournalEntry, getTrialBalance, postDraftJournal, reverseJournalEntry } from "@/services/accounting.service";
import { getSubledgerReconciliation, syncGlBalancesFromJournals } from "@/services/gl.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    if (view === "trial-balance") {
      const trialBalance = await getTrialBalance();
      return successResponse(trialBalance);
    }

    if (view === "reconciliation") {
      return successResponse(await getSubledgerReconciliation());
    }

    if (view === "accounts") {
      const accounts = await prisma.chartOfAccount.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      });
      return successResponse(accounts);
    }

    const entries = await prisma.journalEntry.findMany({
      include: {
        lines: { include: { debitAccount: true, creditAccount: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    });

    return successResponse(entries);
  },
  { module: "ledger", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();

    if (body.action === "sync-balances") {
      const result = await syncGlBalancesFromJournals();
      return successResponse(result, `Synced ${result.updated} account balances from posted journals`);
    }

    if (body.action === "post-journal") {
      if (!body.entryId) return errorResponse("entryId is required");
      const entry = await postDraftJournal(body.entryId, user.id);
      return successResponse(entry, "Journal entry posted");
    }

    if (body.action === "reverse-journal") {
      if (!body.entryId) return errorResponse("entryId is required");
      const entry = await reverseJournalEntry(body.entryId, user.id);
      return successResponse(entry, "Journal entry reversed");
    }

    const parsed = journalSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Validation failed", parsed.error.issues);

    const entry = await postJournalEntry({
      description: parsed.data.description,
      reference: parsed.data.reference,
      lines: parsed.data.lines,
      userId: user.id,
      autoPost: false,
    });

    return successResponse(entry, "Journal entry created", 201);
  },
  { module: "ledger", action: "create" }
);
