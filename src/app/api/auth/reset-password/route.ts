import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    if (!token || !password || password.length < 6) {
      return NextResponse.json({ success: false, message: "Valid token and password (6+ chars) required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "Invalid or expired reset link" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return NextResponse.json({ success: true, message: "Password updated. You can sign in now." });
  } catch {
    return NextResponse.json({ success: false, message: "Reset failed" }, { status: 500 });
  }
}
