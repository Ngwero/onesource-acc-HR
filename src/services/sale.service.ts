import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import { deductStock, getAvailableStock } from "./inventory.service";
import { postSaleJournal, postCOGSJournal } from "./accounting.service";
import { createAuditLog } from "./audit.service";
import { notifyManagers } from "@/lib/notifications";

export async function confirmSale(saleId: string, userId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: { include: { produce: true } }, customer: true },
  });

  if (!sale) throw new Error("Sale not found");
  if (sale.status !== "DRAFT") throw new Error("Only draft sales can be confirmed");

  const isCredit = sale.paymentMethod !== "CASH" && sale.paymentStatus !== "PAID";

  if (isCredit) {
    const limit = Number(sale.customer.creditLimit) || 0;
    const balance = Number(sale.customer.balance) || 0;
    const amount = Number(sale.totalAmount) || 0;
    const newBalance = balance + amount;
    const exceeds = limit <= 0 ? amount > 0 : newBalance > limit;

    if (exceeds) {
      const existingApproval = await prisma.approvalRequest.findFirst({
        where: {
          recordModule: "local_sales",
          recordId: saleId,
          status: "APPROVED",
        },
      });
      if (!existingApproval) {
        const pending = await prisma.approvalRequest.findFirst({
          where: { recordModule: "local_sales", recordId: saleId, status: "PENDING" },
        });
        if (!pending) {
          const overBy = limit > 0 ? newBalance - limit : amount;
          await prisma.approvalRequest.create({
            data: {
              requestType: "CREDIT_SALE",
              recordModule: "local_sales",
              recordId: saleId,
              requestedById: userId,
              amount: sale.totalAmount,
              comments:
                limit > 0
                  ? `Credit limit exceeded for ${sale.customer.name}. Balance ${balance} + sale ${amount} > limit ${limit} (over by ${overBy}). Sale ${sale.saleNumber}`
                  : `No credit limit set for ${sale.customer.name}. Credit sale ${sale.saleNumber} requires approval.`,
            },
          });
          try {
            await notifyManagers({
              type: "PENDING_APPROVAL",
              title: "Credit limit alert",
              message:
                limit > 0
                  ? `${sale.saleNumber} for ${sale.customer.name} exceeds credit limit (over by ${overBy.toLocaleString()})`
                  : `${sale.saleNumber} for ${sale.customer.name} needs approval — no credit limit set`,
              link: "/approvals",
            });
          } catch (err) {
            console.error("[confirmSale] credit alert notify failed", err);
          }
        }
        throw new Error(
          limit > 0
            ? "Credit limit exceeded. Manager approval required — check Approvals / notifications."
            : "No credit limit set for this customer. Manager approval required — check Approvals."
        );
      }
    }
  }

  const warehouse = await prisma.stockLocation.findFirst({ where: { code: "WH-MAIN" } });
  if (!warehouse) throw new Error("Main warehouse not configured");

  for (const item of sale.items) {
    const available = await getAvailableStock(item.produceId, item.grade, warehouse.id);
    if (available < Number(item.quantity)) {
      throw new Error(
        `Insufficient stock for ${item.produce.name}. Available: ${available}`
      );
    }
  }

  let cogsTotal = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      const batch = await tx.inventoryBatch.findFirst({
        where: {
          produceId: item.produceId,
          grade: item.grade,
          locationId: warehouse.id,
          quantity: { gt: 0 },
        },
        orderBy: { dateReceived: "asc" },
      });
      if (batch) {
        cogsTotal += Number(item.quantity) * Number(batch.unitCost);
      }

      await deductStock({
        produceId: item.produceId,
        grade: item.grade,
        locationId: warehouse.id,
        quantity: Number(item.quantity),
        movementType: "SALE_DISPATCH",
        userId,
        referenceDoc: sale.saleNumber,
      });
    }

    if (isCredit) {
      const receivableNumber = await generateDocumentNumber("REC", tx as typeof prisma);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (sale.customer.paymentTerms || 30));

      await tx.receivable.create({
        data: {
          receivableNumber,
          customerId: sale.customerId,
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          amount: sale.totalAmount,
          balance: sale.totalAmount,
          dueDate,
          status: "UNPAID",
        },
      });

      await tx.customer.update({
        where: { id: sale.customerId },
        data: { balance: { increment: Number(sale.totalAmount) } },
      });
    }

    await tx.sale.update({
      where: { id: saleId },
      data: {
        status: "CONFIRMED",
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  });

  await postSaleJournal(
    Number(sale.totalAmount),
    !isCredit,
    userId,
    sale.saleNumber,
    Number(sale.taxAmount)
  );

  if (cogsTotal > 0) {
    await postCOGSJournal(cogsTotal, userId, sale.saleNumber);
  }

  await createAuditLog({
    userId,
    action: "CONFIRM",
    module: "local_sales",
    recordId: saleId,
    newValue: { saleNumber: sale.saleNumber },
  });

  return prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true, customer: true },
  });
}

export async function createSale(
  data: {
    customerId: string;
    saleDate?: string;
    discount?: number;
    taxAmount?: number;
    deliveryCost?: number;
    paymentMethod?: string;
    items: Array<{
      produceId: string;
      grade?: string;
      quantity: number;
      unitPrice: number;
    }>;
  },
  userId: string
) {
  const saleNumber = await generateDocumentNumber("SAL", prisma);
  const invoiceNumber = await generateDocumentNumber("INV", prisma);

  let subtotal = 0;
  const itemsData = data.items.map((item) => {
    const total = item.quantity * item.unitPrice;
    subtotal += total;
    return {
      produceId: item.produceId,
      grade: (item.grade || "A") as "A" | "B" | "C" | "EXPORT_GRADE" | "LOCAL_GRADE",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalAmount: total,
    };
  });

  const totalAmount =
    subtotal - (data.discount || 0) + (data.taxAmount || 0) + (data.deliveryCost || 0);
  const isCash = (data.paymentMethod || "CASH") === "CASH";

  return prisma.sale.create({
    data: {
      saleNumber,
      invoiceNumber,
      saleDate: data.saleDate ? new Date(data.saleDate) : new Date(),
      customerId: data.customerId,
      discount: data.discount || 0,
      taxAmount: data.taxAmount || 0,
      deliveryCost: data.deliveryCost || 0,
      totalAmount,
      paymentMethod: (data.paymentMethod || "CASH") as "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE" | "CARD",
      paymentStatus: isCash ? "PAID" : "UNPAID",
      createdById: userId,
      items: { create: itemsData },
    },
    include: { items: { include: { produce: true } }, customer: true },
  });
}
