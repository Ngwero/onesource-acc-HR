import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  getTaxCodes,
  createQuote,
  convertQuoteToSale,
  createCreditNote,
  getCashFlowForecast,
} from "@/services/xero.service";
import { runDepreciation } from "@/services/depreciation.service";
import { runDueRecurringTemplates } from "@/services/recurring.service";
import { getBudgetVsActual } from "@/services/budget.service";
import { applyCreditNote } from "@/services/credit-note.service";
import { runFxRevaluation } from "@/services/fx.service";
import {
  approvePurchaseOrder,
  createReceiptFromPo,
  getPoThreeWayMatch,
} from "@/services/purchase-order.service";
import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const module = searchParams.get("module");

    switch (module) {
      case "tax":
        return successResponse(await getTaxCodes());
      case "quotes":
        return successResponse(
          await prisma.quote.findMany({
            include: { customer: true, items: true, taxCode: true },
            orderBy: { date: "desc" },
          })
        );
      case "credit-notes":
        return successResponse(
          await prisma.creditNote.findMany({
            include: { customer: true, supplier: true, items: true },
            orderBy: { date: "desc" },
          })
        );
      case "purchase-orders":
        return successResponse(
          await prisma.purchaseOrder.findMany({
            include: {
              supplier: true,
              items: { include: { produce: true } },
              purchases: { select: { id: true, purchaseNumber: true, status: true, totalAmount: true } },
            },
            orderBy: { date: "desc" },
          })
        );
      case "purchase-order-match": {
        const poId = searchParams.get("poId");
        if (!poId) return errorResponse("poId required");
        return successResponse(await getPoThreeWayMatch(poId));
      }
      case "recurring":
        return successResponse(
          await prisma.recurringTemplate.findMany({
            include: { customer: true, supplier: true },
            orderBy: { nextRunDate: "asc" },
          })
        );
      case "budgets":
        return successResponse(
          await prisma.budget.findMany({
            include: { lines: { include: { account: true } } },
            orderBy: { fiscalYear: "desc" },
          })
        );
      case "fixed-assets":
        return successResponse(
          await prisma.fixedAsset.findMany({ orderBy: { purchaseDate: "desc" } })
        );
      case "cashflow":
        return successResponse(await getCashFlowForecast(90));
      case "budget-vs-actual":
        return successResponse(await getBudgetVsActual(searchParams.get("budgetId") || undefined));
      default:
        return successResponse({ modules: ["tax", "quotes", "credit-notes", "purchase-orders", "recurring", "budgets", "fixed-assets", "cashflow"] });
    }
  },
  { module: "reports", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();

    switch (body.module) {
      case "quotes": {
        const quote = await createQuote({ ...body, userId: user.id });
        return successResponse(quote, "Quote created", 201);
      }
      case "quotes-convert": {
        const sale = await convertQuoteToSale(body.quoteId, user.id);
        return successResponse(sale, "Quote converted to sale");
      }
      case "credit-notes": {
        const cn = await createCreditNote({ ...body, userId: user.id });
        return successResponse(cn, "Credit note created", 201);
      }
      case "purchase-orders": {
        const poNumber = await generateDocumentNumber("PO", prisma);
        let subtotal = 0;
        const items = body.items.map((item: { description: string; quantity: number; unitPrice: number; produceId?: string }) => {
          const total = item.quantity * item.unitPrice;
          subtotal += total;
          return { ...item, total };
        });
        const po = await prisma.purchaseOrder.create({
          data: {
            poNumber,
            supplierId: body.supplierId,
            expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
            subtotal,
            total: subtotal + (body.taxAmount || 0),
            taxAmount: body.taxAmount || 0,
            notes: body.notes,
            createdById: user.id,
            items: { create: items },
          },
          include: { supplier: true, items: true },
        });
        return successResponse(po, "Purchase order created", 201);
      }
      case "recurring": {
        const template = await prisma.recurringTemplate.create({
          data: {
            name: body.name,
            type: body.type,
            frequency: body.frequency,
            nextRunDate: new Date(body.nextRunDate),
            amount: body.amount,
            customerId: body.customerId,
            supplierId: body.supplierId,
            description: body.description,
          },
        });
        return successResponse(template, "Recurring template created", 201);
      }
      case "budgets": {
        const budget = await prisma.budget.create({
          data: {
            name: body.name,
            fiscalYear: body.fiscalYear,
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
            lines: {
              create: body.lines.map((l: { accountId: string; amount: number; period: string }) => ({
                accountId: l.accountId,
                amount: l.amount,
                period: l.period,
              })),
            },
          },
          include: { lines: { include: { account: true } } },
        });
        return successResponse(budget, "Budget created", 201);
      }
      case "fixed-assets": {
        const assetNumber = await generateDocumentNumber("FA", prisma);
        const asset = await prisma.fixedAsset.create({
          data: {
            assetNumber,
            name: body.name,
            category: body.category,
            purchaseDate: new Date(body.purchaseDate),
            purchaseCost: body.purchaseCost,
            salvageValue: body.salvageValue || 0,
            usefulLifeMonths: body.usefulLifeMonths,
            bookValue: body.purchaseCost,
          },
        });
        return successResponse(asset, "Fixed asset registered", 201);
      }
      case "tax": {
        const tax = await prisma.taxCode.create({
          data: { code: body.code, name: body.name, rate: body.rate, description: body.description },
        });
        return successResponse(tax, "Tax code created", 201);
      }
      case "run-depreciation": {
        const result = await runDepreciation(user.id);
        return successResponse(result, `Depreciation run: ${result.processed} assets`);
      }
      case "run-recurring": {
        const result = await runDueRecurringTemplates(user.id);
        return successResponse(result, `Recurring run: ${result.processed} templates`);
      }
      case "run-fx-revaluation": {
        const result = await runFxRevaluation(user.id);
        return successResponse(result, `FX revaluation: ${result.posted} adjustments posted`);
      }
      case "purchase-orders-approve": {
        const po = await approvePurchaseOrder(body.poId, user.id);
        return successResponse(po, "Purchase order approved");
      }
      case "purchase-orders-receive": {
        const purchase = await createReceiptFromPo(body.poId, {
          userId: user.id,
          transportCost: body.transportCost,
          loadingCost: body.loadingCost,
          items: body.items,
        });
        return successResponse(purchase, "Goods receipt created — confirm purchase to post bill", 201);
      }
      default:
        return errorResponse("Unknown module");
    }
  },
  { module: "ledger", action: "create" }
);

export const PATCH = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const { module, id } = body;
    if (!id) return errorResponse("ID required");

    switch (module) {
      case "quotes": {
        const updated = await prisma.quote.update({
          where: { id },
          data: { notes: body.notes, expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined, status: body.status },
        });
        return successResponse(updated, "Quote updated");
      }
      case "purchase-orders": {
        const updated = await prisma.purchaseOrder.update({
          where: { id },
          data: { status: body.status, notes: body.notes, expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined },
        });
        return successResponse(updated, "Purchase order updated");
      }
      case "credit-notes": {
        if (body.action === "apply") {
          const cn = await applyCreditNote(
            id,
            {
              receivableId: body.receivableId,
              payableId: body.payableId,
              invoiceId: body.invoiceId,
            },
            user.id
          );
          return successResponse(cn, "Credit note applied to open balance");
        }
        const updated = await prisma.creditNote.update({
          where: { id },
          data: { reason: body.reason, status: body.status },
        });
        return successResponse(updated, "Credit note updated");
      }
      case "recurring": {
        const updated = await prisma.recurringTemplate.update({
          where: { id },
          data: {
            name: body.name,
            amount: body.amount,
            frequency: body.frequency,
            nextRunDate: body.nextRunDate ? new Date(body.nextRunDate) : undefined,
            isActive: body.isActive,
            description: body.description,
          },
        });
        return successResponse(updated, "Template updated");
      }
      case "tax": {
        const updated = await prisma.taxCode.update({
          where: { id },
          data: { name: body.name, rate: body.rate, description: body.description, isActive: body.isActive },
        });
        return successResponse(updated, "Tax code updated");
      }
      case "fixed-assets": {
        const updated = await prisma.fixedAsset.update({
          where: { id },
          data: { name: body.name, category: body.category, status: body.status },
        });
        return successResponse(updated, "Asset updated");
      }
      default:
        return errorResponse("Unknown module");
    }
  },
  { module: "ledger", action: "update" }
);

export const DELETE = withAuth(
  async ({ request }) => {
    const body = await request.json();
    const { module, id } = body;
    if (!id) return errorResponse("ID required");

    switch (module) {
      case "quotes":
        await prisma.quote.update({ where: { id }, data: { status: "DECLINED" } });
        break;
      case "purchase-orders":
        await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
        break;
      case "credit-notes":
        await prisma.creditNote.update({ where: { id }, data: { status: "CANCELLED" } });
        break;
      case "recurring":
        await prisma.recurringTemplate.update({ where: { id }, data: { isActive: false } });
        break;
      case "tax":
        await prisma.taxCode.update({ where: { id }, data: { isActive: false } });
        break;
      default:
        return errorResponse("Unknown module");
    }
    return successResponse(null, "Deleted");
  },
  { module: "ledger", action: "delete" }
);
