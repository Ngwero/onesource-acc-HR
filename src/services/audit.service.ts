import { prisma } from "@/lib/prisma";

interface AuditParams {
  userId?: string;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export async function createAuditLog(params: AuditParams) {
  return prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      module: params.module,
      recordId: params.recordId,
      oldValue: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : undefined,
      newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      reason: params.reason,
    },
  });
}

export async function logLogin(
  userId: string,
  success: boolean,
  ipAddress?: string,
  userAgent?: string
) {
  return createAuditLog({
    userId: success ? userId : undefined,
    action: success ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
    module: "auth",
    recordId: userId,
    ipAddress,
    userAgent,
  });
}
