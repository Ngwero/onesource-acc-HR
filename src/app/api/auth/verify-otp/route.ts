import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();
    if (!email || !otp) {
      return NextResponse.json({ success: false, message: "Email and OTP required" }, { status: 400 });
    }

    const normalized = String(email).trim().toLowerCase();
    const code = String(otp).trim();

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalized, mode: "insensitive" },
        deletedAt: null,
        status: "ACTIVE",
      },
    });

    if (!user || !user.otpCode || !user.otpExpiry) {
      return NextResponse.json({ success: false, message: "Invalid or expired OTP" }, { status: 400 });
    }

    if (user.otpExpiry < new Date() || user.otpCode !== code) {
      return NextResponse.json({ success: false, message: "Invalid or expired OTP" }, { status: 400 });
    }

    // Clear OTP and cancel any prior pending password-reset approvals
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiry: null },
      }),
      prisma.approvalRequest.updateMany({
        where: {
          requestType: "PASSWORD_RESET",
          recordId: user.id,
          status: "PENDING",
        },
        data: { status: "REJECTED", comments: "Superseded by a new OTP-verified request" },
      }),
    ]);

    const approval = await prisma.approvalRequest.create({
      data: {
        requestType: "PASSWORD_RESET",
        requestedById: user.id,
        recordModule: "users",
        recordId: user.id,
        comments: `Password reset requested for ${user.email} (OTP verified)`,
        status: "PENDING",
      },
    });

    await notifyAdmins({
      type: "PENDING_APPROVAL",
      title: "Password reset approval needed",
      message: `${user.fullName} (${user.email}) verified OTP and needs password reset approval.`,
      link: "/approvals",
    });

    return NextResponse.json({
      success: true,
      message: "OTP verified. An admin must approve your password reset. You will receive a reset link by email after approval.",
      data: { approvalId: approval.id },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json({ success: false, message: "Verification failed" }, { status: 500 });
  }
}
