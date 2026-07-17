import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createAuditLog } from "@/services/audit.service";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section");

    if (section === "master") {
      const [units, locations, categories, currencies, taxCodes] = await Promise.all([
        prisma.unitOfMeasure.findMany(),
        prisma.stockLocation.findMany(),
        prisma.expenseCategory.findMany(),
        prisma.currency.findMany(),
        prisma.taxCode.findMany(),
      ]);
      return successResponse({ units, locations, categories, currencies, taxCodes });
    }

    const settings = await prisma.companySetting.findFirst();
    if (!settings) return successResponse(settings);
    return successResponse({
      ...settings,
      smtpPass: settings.smtpPass ? "••••••••" : "",
      smtpConfigured: Boolean(settings.smtpHost && settings.smtpUser && settings.smtpPass),
    });
  },
  { module: "settings", action: "read" }
);

export const PUT = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    const existing = await prisma.companySetting.findFirst();

    const data = {
      companyName: body.companyName,
      address: body.address,
      phone: body.phone,
      email: body.email,
      website: body.website,
      taxId: body.taxId,
      bankDetails: body.bankDetails,
      defaultCurrency: body.defaultCurrency,
      defaultPaymentTerms: body.defaultPaymentTerms,
      defaultTaxRate: body.defaultTaxRate,
      fiscalYearStartMonth: body.fiscalYearStartMonth,
      smtpHost: body.smtpHost || null,
      smtpPort: body.smtpPort ? Number(body.smtpPort) : 587,
      smtpUser: body.smtpUser || null,
      smtpFrom: body.smtpFrom || null,
      ...(body.smtpPass && body.smtpPass !== "••••••••"
        ? { smtpPass: body.smtpPass }
        : {}),
    };

    const settings = existing
      ? await prisma.companySetting.update({ where: { id: existing.id }, data })
      : await prisma.companySetting.create({
          data: { ...data, companyName: body.companyName || "One Source" },
        });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      module: "settings",
      recordId: settings.id,
      newValue: { ...settings, smtpPass: settings.smtpPass ? "[redacted]" : null },
    });

    return successResponse(
      { ...settings, smtpPass: settings.smtpPass ? "••••••••" : "" },
      "Settings saved"
    );
  },
  { module: "settings", action: "update" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    if (body.action === "create-bank-account") {
      const account = await prisma.bankAccount.create({
        data: {
          code: body.code,
          name: body.name,
          bankName: body.bankName,
          accountNumber: body.accountNumber,
          currency: body.currency || "UGX",
          openingBalance: body.openingBalance || 0,
          currentBalance: body.openingBalance || 0,
          glAccountId: body.glAccountId,
        },
      });
      return successResponse(account, "Bank account created", 201);
    }
    return errorResponse("Unknown action");
  },
  { module: "bank", action: "create" }
);
