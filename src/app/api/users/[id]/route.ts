import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createAuditLog } from "@/services/audit.service";
import { canManageAccounts, canManageTargetUser, isSuperAdmin } from "@/lib/account-management";

export const GET = withAuth(
  async ({ user }, _req, params) => {
    const id = params?.id;
    if (!id) return errorResponse("User ID required");
    if (!canManageAccounts(user.role)) return forbiddenResponse("Access denied");

    const target = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    if (!target) return notFoundResponse("User not found");
    if (!canManageTargetUser(user.role, target.role, user.id, target.id) && user.id !== target.id) {
      return forbiddenResponse("You cannot view this user");
    }
    return successResponse(target);
  },
  { module: "users", action: "read" }
);

export const PATCH = withAuth(
  async ({ user, request }, _req, params) => {
    const id = params?.id;
    if (!id) return errorResponse("User ID required");

    const body = await request.json();

    if (body.action === "reset-password") {
      if (!isSuperAdmin(user.role) && !canManageAccounts(user.role)) {
        return forbiddenResponse("You cannot reset passwords");
      }

      const target = await prisma.user.findFirst({ where: { id, deletedAt: null } });
      if (!target) return notFoundResponse("User not found");
      if (!canManageTargetUser(user.role, target.role, user.id, target.id)) {
        return forbiddenResponse("You cannot reset this user's password");
      }

      const password = body.password || "Admin@123";
      if (password.length < 6) return errorResponse("Password must be at least 6 characters");

      await prisma.user.update({
        where: { id },
        data: { passwordHash: await hashPassword(password), resetToken: null, resetTokenExpiry: null },
      });

      await createAuditLog({
        userId: user.id,
        action: "UPDATE",
        module: "users",
        recordId: id,
        newValue: { action: "password-reset" },
      });

      return successResponse(null, "Password reset successfully");
    }

    return errorResponse("Unknown action");
  },
  { module: "users", action: "update" }
);

export const DELETE = withAuth(
  async ({ user }, _req, params) => {
    const id = params?.id;
    if (!id) return errorResponse("User ID required");
    if (!canManageAccounts(user.role)) return forbiddenResponse("Access denied");

    const target = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!target) return notFoundResponse("User not found");
    if (!canManageTargetUser(user.role, target.role, user.id, target.id)) {
      return forbiddenResponse("You cannot deactivate this user");
    }

    if (target.role === "SUPER_ADMIN") {
      const superAdminCount = await prisma.user.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
      });
      if (superAdminCount <= 1) {
        return errorResponse("Cannot deactivate the last Super Admin");
      }
    }

    await prisma.user.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });

    await createAuditLog({ userId: user.id, action: "DEACTIVATE", module: "users", recordId: id });
    return successResponse(null, "User deactivated");
  },
  { module: "users", action: "delete" }
);
