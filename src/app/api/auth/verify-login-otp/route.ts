import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthToken, setAuthCookie } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logLogin } from "@/services/audit.service";
import { getClientInfo } from "@/lib/api-middleware";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    if (!email || !otp) {
      return errorResponse("Email and OTP required", [], 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        deletedAt: null,
        status: "ACTIVE",
      },
    });

    const { ipAddress, userAgent } = getClientInfo(request);

    if (!user || !user.otpCode || !user.otpExpiry) {
      return errorResponse("Invalid or expired OTP", [], 400);
    }

    if (user.otpExpiry < new Date() || user.otpCode !== otp) {
      await logLogin(user.id, false, ipAddress, userAgent);
      return errorResponse("Invalid or expired OTP", [], 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiry: null,
        lastLogin: new Date(),
      },
    });

    await logLogin(user.id, true, ipAddress, userAgent);

    const authUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const token = await createAuthToken(authUser);
    await setAuthCookie(token);

    return successResponse({ user: authUser }, "Login successful");
  } catch (error) {
    console.error("Login OTP error:", error);
    return errorResponse("OTP verification failed", [], 500);
  }
}
