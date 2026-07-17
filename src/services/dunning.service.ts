import { prisma } from "@/lib/prisma";
import { sendEmail } from "./email.service";
import { dispatchWebhooks } from "./webhook.service";

export async function sendOverdueReminders() {
  const overdueReceivables = await prisma.receivable.findMany({
    where: { status: "OVERDUE", balance: { gt: 0 } },
    include: { customer: true },
    take: 50,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const rec of overdueReceivables) {
    const email = rec.customer.email;
    if (!email) {
      skipped++;
      continue;
    }

    const result = await sendEmail({
      to: email,
      subject: `Overdue invoice reminder — ${rec.receivableNumber}`,
      body: `Dear ${rec.customer.name},\n\nThis is a reminder that ${rec.receivableNumber} for UGX ${Number(rec.balance).toLocaleString()} was due on ${rec.dueDate.toISOString().split("T")[0]}.\n\nPlease arrange payment at your earliest convenience.`,
    });

    if (result.sent) {
      sent++;
      await dispatchWebhooks("OVERDUE_INVOICE", {
        receivableId: rec.id,
        receivableNumber: rec.receivableNumber,
        customerId: rec.customerId,
        balance: Number(rec.balance),
      });
    } else if (result.reason?.includes("SMTP not configured")) {
      skipped++;
    } else {
      failed++;
    }
  }

  return { sent, skipped, failed };
}
