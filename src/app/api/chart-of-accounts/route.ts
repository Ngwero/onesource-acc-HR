import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async () => {
    const accounts = await prisma.chartOfAccount.findMany({
      orderBy: { code: "asc" },
    });
    return successResponse(accounts);
  },
  { module: "ledger", action: "read" }
);

export const POST = withAuth(
  async ({ request }) => {
    const body = await request.json();
    const existing = await prisma.chartOfAccount.findUnique({ where: { code: body.code } });
    if (existing) return errorResponse("Account code already exists");

    const account = await prisma.chartOfAccount.create({
      data: {
        code: body.code,
        name: body.name,
        accountType: body.accountType,
        parentId: body.parentId || null,
        isActive: body.isActive !== false,
      },
    });
    return successResponse(account, "Account created", 201);
  },
  { module: "ledger", action: "create" }
);

export const PATCH = withAuth(
  async ({ request }) => {
    const body = await request.json();
    const existing = await prisma.chartOfAccount.findUnique({ where: { id: body.id } });
    if (!existing) return notFoundResponse("Account not found");

    const account = await prisma.chartOfAccount.update({
      where: { id: body.id },
      data: {
        name: body.name ?? existing.name,
        accountType: body.accountType ?? existing.accountType,
        isActive: body.isActive ?? existing.isActive,
      },
    });
    return successResponse(account, "Account updated");
  },
  { module: "ledger", action: "update" }
);

export const DELETE = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return errorResponse("Account ID required");

    await prisma.chartOfAccount.update({
      where: { id },
      data: { isActive: false },
    });
    return successResponse(null, "Account deactivated");
  },
  { module: "ledger", action: "delete" }
);
