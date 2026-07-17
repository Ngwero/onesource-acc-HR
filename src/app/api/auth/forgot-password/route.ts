import { NextResponse, after } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured, sendOtpEmail } from "@/services/email.service";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ success: false, message: "Email required" }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalized, mode: "insensitive" },
        deletedAt: null,
        status: "ACTIVE",
      },
      select: { id: true, email: true },
    });

    // Always return success shape to avoid email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If that email exists, an OTP was sent",
        data: { otpSent: true },
      });
    }

    const smtpReady = await isSmtpConfigured();
    if (!smtpReady && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          success: false,
          message: "Could not send OTP email. Configure SMTP in Settings.",
        },
        { status: 503 }
      );
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpiry,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    after(() => {
      void sendOtpEmail(user.email, otp, "password-reset").then((mail) => {
        if (!mail.sent) {
          console.error("[forgot-password otp email]", mail.reason || "send failed");
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: "OTP sent to your email. Enter the code to continue.",
      data: {
        otpSent: true,
        emailDelivered: true,
        previewUrl: null,
      },
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ success: false, message: "Request failed" }, { status: 500 });
  }
}
