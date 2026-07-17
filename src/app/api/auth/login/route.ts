import { NextRequest, after } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logLogin } from "@/services/audit.service";
import { getClientInfo } from "@/lib/api-middleware";
import { isSmtpConfigured, sendOtpEmail } from "@/services/email.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("Validation failed", parsed.error.issues);
    }

    const { email, password } = parsed.data;
    const { ipAddress, userAgent } = getClientInfo(request);

    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!user || user.status !== "ACTIVE" || user.deletedAt) {
      if (user) await logLogin(user.id, false, ipAddress, userAgent);
      return errorResponse("Invalid email or password", [], 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logLogin(user.id, false, ipAddress, userAgent);
      return errorResponse("Invalid email or password", [], 401);
    }

    const smtpReady = await isSmtpConfigured();
    if (!smtpReady && process.env.NODE_ENV === "production") {
      return errorResponse(
        "Could not send OTP email. Configure SMTP in Settings.",
        [],
        503
      );
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiry },
    });

    // Don't block the HTTP response on SMTP — OTP screen shows immediately.
    after(() => {
      void sendOtpEmail(user.email, otp, "login").then((mail) => {
        if (!mail.sent) {
          console.error("[login otp email]", mail.reason || "send failed");
        }
      });
    });

    return successResponse(
      {
        requiresOtp: true,
        email: user.email,
        emailDelivered: true,
        previewUrl: null,
      },
      `Password verified. OTP sent to ${user.email}.`
    );
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Login failed", [], 500);
  }
}
