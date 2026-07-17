import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoiceData {
  companyName: string;
  companyAddress?: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customerName: string;
  customerAddress?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency?: string;
}

export function generateInvoicePDF(data: InvoiceData): Buffer {
  const doc = new jsPDF();
  const currency = data.currency || "UGX";

  doc.setFontSize(20);
  doc.setTextColor(21, 128, 61);
  doc.text(data.companyName, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  if (data.companyAddress) doc.text(data.companyAddress, 14, 28);

  doc.setFontSize(16);
  doc.text("INVOICE", 150, 20);
  doc.setFontSize(10);
  doc.text(`Invoice #: ${data.invoiceNumber}`, 150, 28);
  doc.text(`Date: ${data.date}`, 150, 34);
  doc.text(`Due Date: ${data.dueDate}`, 150, 40);

  doc.text("Bill To:", 14, 50);
  doc.text(data.customerName, 14, 56);
  if (data.customerAddress) doc.text(data.customerAddress, 14, 62);

  autoTable(doc, {
    startY: 75,
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: data.items.map((item) => [
      item.description,
      item.quantity.toString(),
      `${currency} ${item.unitPrice.toLocaleString()}`,
      `${currency} ${item.total.toLocaleString()}`,
    ]),
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.text(`Subtotal: ${currency} ${data.subtotal.toLocaleString()}`, 140, finalY);
  doc.text(`Tax: ${currency} ${data.tax.toLocaleString()}`, 140, finalY + 6);
  doc.text(`Discount: ${currency} ${data.discount.toLocaleString()}`, 140, finalY + 12);
  doc.setFontSize(12);
  doc.text(`Total: ${currency} ${data.total.toLocaleString()}`, 140, finalY + 22);

  return Buffer.from(doc.output("arraybuffer"));
}

export function generateReportPDF(title: string, headers: string[], rows: string[][]): Buffer {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(21, 128, 61);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [headers],
    body: rows,
  });

  return Buffer.from(doc.output("arraybuffer"));
}
