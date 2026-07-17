import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { generateDocumentNumber } from "@/lib/utils";
import { generateInvoicePDF } from "@/lib/pdf";
import { dispatchWebhooks } from "@/services/webhook.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const format = searchParams.get("format");

    if (id) {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { customer: true, sale: { include: { items: { include: { produce: true } } } } },
      });
      if (!invoice) return successResponse(null, "Invoice not found");

      if (format === "pdf") {
        const settings = await prisma.companySetting.findFirst();
        const pdf = generateInvoicePDF({
          companyName: settings?.companyName || "One Source",
          companyAddress: settings?.address || undefined,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date.toISOString().split("T")[0],
          dueDate: invoice.dueDate.toISOString().split("T")[0],
          customerName: invoice.customer.name,
          customerAddress: invoice.customer.address || undefined,
          items: invoice.sale?.items.map((i) => ({
            description: i.produce.name,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            total: Number(i.totalAmount),
          })) || [{ description: "Invoice", quantity: 1, unitPrice: Number(invoice.total), total: Number(invoice.total) }],
          subtotal: Number(invoice.subtotal),
          tax: Number(invoice.tax),
          discount: Number(invoice.discount),
          total: Number(invoice.total),
          currency: invoice.currency,
        });
        return new Response(new Uint8Array(pdf), {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"` },
        });
      }
      return successResponse(invoice);
    }

    const invoices = await prisma.invoice.findMany({
      include: { customer: true },
      orderBy: { date: "desc" },
    });
    return successResponse(invoices);
  },
  { module: "invoices", action: "read" }
);

export const POST = withAuth(
  async ({ request }) => {
    const body = await request.json();
    const sale = await prisma.sale.findUnique({
      where: { id: body.saleId },
      include: { customer: true, items: true },
    });
    if (!sale) return errorResponse("Sale not found");

    const invoiceNumber = sale.invoiceNumber || (await generateDocumentNumber("INV", prisma));
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (sale.customer.paymentTerms || 30));

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: typeof invoiceNumber === "string" ? invoiceNumber : String(invoiceNumber),
        customerId: sale.customerId,
        saleId: sale.id,
        dueDate,
        subtotal: Number(sale.totalAmount) - Number(sale.taxAmount),
        tax: sale.taxAmount,
        discount: sale.discount,
        total: sale.totalAmount,
        balance: sale.totalAmount,
        status: sale.paymentStatus,
      },
      include: { customer: true },
    });

    await dispatchWebhooks("INVOICE_CREATED", {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      total: Number(invoice.total),
    });

    return successResponse(invoice, "Invoice created", 201);
  },
  { module: "invoices", action: "create" }
);
