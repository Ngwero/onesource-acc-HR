import { prisma } from "@/lib/prisma";
import { runDueRecurringTemplates } from "./recurring.service";
import { runDepreciation } from "./depreciation.service";
import { sendOverdueReminders } from "./dunning.service";
import { dispatchWebhooks } from "./webhook.service";
import { runFxRevaluation } from "./fx.service";
import { createAuditLog } from "./audit.service";

export async function markOverdueDocuments() {
  const now = new Date();

  const [payables, receivables] = await Promise.all([
    prisma.payable.updateMany({
      where: {
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
      },
      data: { status: "OVERDUE" },
    }),
    prisma.receivable.updateMany({
      where: {
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
      },
      data: { status: "OVERDUE" },
    }),
  ]);

  return {
    payablesMarked: payables.count,
    receivablesMarked: receivables.count,
    total: payables.count + receivables.count,
  };
}

async function resolveSystemUserId(): Promise<string> {
  const envId = process.env.CRON_USER_ID;
  if (envId) {
    const user = await prisma.user.findUnique({ where: { id: envId } });
    if (user) return user.id;
  }

  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No active admin user found for scheduled jobs");
  return admin.id;
}

export async function runScheduledJobs(options?: { userId?: string; skipEmail?: boolean }) {
  const userId = options?.userId || (await resolveSystemUserId());
  const startedAt = new Date();

  const overdue = await markOverdueDocuments();
  const recurring = await runDueRecurringTemplates(userId);
  const depreciation = await runDepreciation(userId);
  const fxRevaluation = await runFxRevaluation(userId);

  let emailReminders = { sent: 0, skipped: 0, failed: 0 };
  if (!options?.skipEmail) {
    emailReminders = await sendOverdueReminders();
  }

  const result = {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    overdue,
    recurring,
    depreciation,
    fxRevaluation,
    emailReminders,
  };

  await createAuditLog({
    userId,
    action: "SCHEDULED_JOBS_RUN",
    module: "automation",
    recordId: "cron",
    newValue: result,
  });

  await dispatchWebhooks("SCHEDULED_JOBS_COMPLETED", result);

  return result;
}

export async function getAutomationStatus() {
  const now = new Date();
  const [overduePayables, overdueReceivables, dueRecurring, activeAssets, lastRun] =
    await Promise.all([
      prisma.payable.count({ where: { status: "OVERDUE" } }),
      prisma.receivable.count({ where: { status: "OVERDUE" } }),
      prisma.recurringTemplate.count({ where: { isActive: true, nextRunDate: { lte: now } } }),
      prisma.fixedAsset.count({ where: { status: "ACTIVE" } }),
      prisma.auditLog.findFirst({
        where: { action: "SCHEDULED_JOBS_RUN", module: "automation" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    overduePayables,
    overdueReceivables,
    dueRecurringTemplates: dueRecurring,
    activeFixedAssets: activeAssets,
    lastRun: lastRun
      ? { at: lastRun.createdAt.toISOString(), summary: lastRun.newValue }
      : null,
    cronConfigured: !!process.env.CRON_SECRET,
    smtpConfigured: await (async () => {
      const s = await prisma.companySetting.findFirst({
        select: { smtpHost: true, smtpUser: true, smtpPass: true },
      });
      return !!(
        (s?.smtpHost && s?.smtpUser && s?.smtpPass) ||
        (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
      );
    })(),
  };
}
