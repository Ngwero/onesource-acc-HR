import crypto from "crypto";
import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse, forbiddenResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createAuditLog } from "@/services/audit.service";
import { registerSchema } from "@/lib/validations";
import { sendWelcomeSetPasswordEmail } from "@/services/email.service";
import {
  canManageAccounts,
  canAssignRole,
  canManageTargetUser,
  getAssignableRoles,
  isSuperAdmin,
} from "@/lib/account-management";
import type { UserRole } from "@/generated/prisma/client";

async function issueWelcomeResetEmail(user: {
  id: string;
  email: string;
  fullName: string;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  return sendWelcomeSetPasswordEmail(user.email, user.fullName, resetUrl);
}

export const GET = withAuth(
  async ({ user }) => {
    if (!canManageAccounts(user.role)) {
      return forbiddenResponse("You do not have access to user management");
    }

    const users = await prisma.user.findMany({
      where: { deletedAt: null },
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
      orderBy: { fullName: "asc" },
    });

    return successResponse({
      users,
      assignableRoles: getAssignableRoles(user.role),
      canEditPermissions: isSuperAdmin(user.role),
      canCreateUsers: isSuperAdmin(user.role) || user.role === "ADMIN",
      actorRole: user.role,
    });
  },
  { module: "users", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    try {
      if (!isSuperAdmin(user.role) && user.role !== "ADMIN") {
        return forbiddenResponse("Only Super Admin or Admin can create users");
      }

      const body = await request.json();
      const parsed = registerSchema.safeParse({
        fullName: body.fullName,
        email: body.email,
        phone: body.phone || undefined,
        password: body.password || undefined,
        role: body.role || "SALES_OFFICER",
      });

      if (!parsed.success) {
        return errorResponse("Validation failed", parsed.error.issues);
      }

      const { fullName, email, phone, role } = parsed.data;
      const targetRole = (role || "SALES_OFFICER") as UserRole;

      if (!canAssignRole(user.role, targetRole)) {
        return forbiddenResponse(`You cannot assign the ${targetRole} role`);
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && !existing.deletedAt) {
        return errorResponse("Email already exists");
      }

      // Temporary password — user must set their own via welcome email link
      const tempPassword =
        parsed.data.password || crypto.randomBytes(16).toString("base64url");
      const passwordHash = await hashPassword(tempPassword);
      const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

      let savedUser: {
        id: string;
        fullName: string;
        email: string;
        role: UserRole;
        status: string;
      };

      if (existing?.deletedAt) {
        savedUser = await prisma.user.update({
          where: { id: existing.id },
          data: {
            fullName,
            phone: phone || null,
            passwordHash,
            role: targetRole,
            status,
            deletedAt: null,
            otpCode: null,
            otpExpiry: null,
          },
          select: { id: true, fullName: true, email: true, role: true, status: true },
        });
      } else {
        savedUser = await prisma.user.create({
          data: {
            fullName,
            email,
            phone: phone || null,
            passwordHash,
            role: targetRole,
            status,
          },
          select: { id: true, fullName: true, email: true, role: true, status: true },
        });
      }

      await createAuditLog({
        userId: user.id,
        action: "CREATE",
        module: "users",
        recordId: savedUser.id,
        newValue: { ...savedUser, restored: Boolean(existing?.deletedAt) },
      });

      let inviteEmailSent = false;
      let inviteEmailError: string | undefined;
      try {
        const mail = await issueWelcomeResetEmail(savedUser);
        inviteEmailSent = mail.sent;
        if (!mail.sent) inviteEmailError = mail.reason;
      } catch (err) {
        inviteEmailError = err instanceof Error ? err.message : "Failed to send invite email";
        console.error("Welcome email error:", inviteEmailError);
      }

      return successResponse(
        { ...savedUser, inviteEmailSent, inviteEmailError: inviteEmailError || null },
        inviteEmailSent
          ? "User created. A set-password email was sent."
          : `User created, but the invite email could not be sent${inviteEmailError ? `: ${inviteEmailError}` : ""}`,
        201
      );
    } catch (err) {
      console.error("Create user error:", err);
      return errorResponse("Failed to create user", [], 500);
    }
  },
  { module: "users", action: "create" }
);

export const PATCH = withAuth(
  async ({ user, request }) => {
    if (!canManageAccounts(user.role)) {
      return forbiddenResponse("You do not have permission to update users");
    }

    const body = await request.json();
    const target = await prisma.user.findFirst({ where: { id: body.id, deletedAt: null } });
    if (!target) return errorResponse("User not found");

    if (!canManageTargetUser(user.role, target.role, user.id, target.id)) {
      return forbiddenResponse("You cannot manage this user");
    }

    if (body.role && !canAssignRole(user.role, body.role as UserRole)) {
      return forbiddenResponse(`You cannot assign the ${body.role} role`);
    }

    const updated = await prisma.user.update({
      where: { id: body.id },
      data: {
        fullName: body.fullName,
        phone: body.phone,
        role: body.role,
        status: body.status,
      },
      select: { id: true, fullName: true, email: true, role: true, status: true },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      module: "users",
      recordId: updated.id,
      newValue: updated,
    });
    return successResponse(updated, "User updated");
  },
  { module: "users", action: "update" }
);
