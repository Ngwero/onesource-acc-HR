import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { APP_SHORT_NAME, BRAND } from "@/lib/branding";

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  userId?: string;
  link?: string;
  html?: string;
  skipNotification?: boolean;
}

export type SendEmailResult = {
  sent: boolean;
  reason?: string;
  previewUrl?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

const LOGO_CID = "one-source-logo";
const SMTP_CACHE_MS = 60_000;

let smtpCache: { config: SmtpConfig | null; at: number } | null = null;
let smtpTransporter: Transporter | null = null;
let smtpTransporterKey = "";
let logoContent: Buffer | null | undefined;
let etherealTransporter: Transporter | null = null;
let etherealUser = "";

function logoAttachment() {
  if (logoContent === undefined) {
    const filePath = path.join(process.cwd(), "public", "one-source-logo.png");
    try {
      logoContent = fs.readFileSync(filePath);
    } catch {
      logoContent = null;
    }
  }
  if (!logoContent) return null;
  return {
    filename: "one-source-logo.png",
    content: logoContent,
    cid: LOGO_CID,
    contentDisposition: "inline" as const,
  };
}

function emailShell(title: string, contentHtml: string) {
  return `
  <div style="margin:0;padding:24px;background:${BRAND.mist};font-family:system-ui,-apple-system,sans-serif;color:${BRAND.ink}">
    <div style="max-width:560px;margin:0 auto;background:${BRAND.white};border-radius:16px;overflow:hidden;border:1px solid #d5e8c8">
      <div style="padding:20px 24px;border-bottom:1px solid #e8f2e0;background:${BRAND.white}">
        <img src="cid:${LOGO_CID}" alt="${APP_SHORT_NAME}" width="180" height="120" style="display:block;height:auto;max-width:180px;border:0;outline:none;text-decoration:none" />
      </div>
      <div style="padding:28px 24px">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${BRAND.forest}">${title}</h1>
        ${contentHtml}
      </div>
      <div style="padding:16px 24px;background:${BRAND.soft};border-top:1px solid #d5e8c8">
        <p style="margin:0;font-size:12px;color:${BRAND.muted}">${APP_SHORT_NAME} Accounting · Internal system</p>
      </div>
    </div>
  </div>`;
}

function smtpKey(smtp: SmtpConfig) {
  return `${smtp.host}:${smtp.port}:${smtp.user}`;
}

function configFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  if (!host || !user || !pass || !from) return null;
  return { host, port, user, pass, from };
}

async function resolveSmtpConfig(): Promise<SmtpConfig | null> {
  if (smtpCache && Date.now() - smtpCache.at < SMTP_CACHE_MS) {
    return smtpCache.config;
  }

  // Prefer .env when complete — avoids a DB round-trip on the hot login path.
  const fromEnv = configFromEnv();
  if (fromEnv) {
    smtpCache = { config: fromEnv, at: Date.now() };
    return fromEnv;
  }

  const settings = await prisma.companySetting.findFirst({
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPass: true,
      smtpFrom: true,
    },
  });

  const host = settings?.smtpHost;
  const user = settings?.smtpUser;
  const pass = settings?.smtpPass;
  const from = settings?.smtpFrom || user;
  const port = settings?.smtpPort || 587;

  const config =
    host && user && pass && from ? { host, port, user, pass, from } : null;

  smtpCache = { config, at: Date.now() };
  return config;
}

export async function isSmtpConfigured(): Promise<boolean> {
  return Boolean(await resolveSmtpConfig());
}

function getSmtpTransporter(smtp: SmtpConfig): Transporter {
  const key = smtpKey(smtp);
  if (smtpTransporter && smtpTransporterKey === key) return smtpTransporter;

  smtpTransporter?.close();
  smtpTransporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
  smtpTransporterKey = key;
  return smtpTransporter;
}

async function deliverViaSmtp(
  params: SendEmailParams,
  smtp: SmtpConfig
): Promise<SendEmailResult> {
  try {
    const transporter = getSmtpTransporter(smtp);
    const logo = logoAttachment();
    await transporter.sendMail({
      from: smtp.from,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: params.html || params.body.replace(/\n/g, "<br>"),
      attachments: logo ? [logo] : [],
    });

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP delivery failed";
    console.error("[email error]", message);
    smtpTransporter?.close();
    smtpTransporter = null;
    smtpTransporterKey = "";
    return { sent: false, reason: message };
  }
}

/** Dev fallback: Ethereal captures the message and returns a preview URL. */
async function deliverViaEthereal(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    if (!etherealTransporter) {
      const testAccount = await nodemailer.createTestAccount();
      etherealUser = testAccount.user;
      etherealTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
        pool: true,
        maxConnections: 1,
      });
    }

    const logo = logoAttachment();
    const info = await etherealTransporter.sendMail({
      from: `"${APP_SHORT_NAME} Accounting" <${etherealUser}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: params.html || params.body.replace(/\n/g, "<br>"),
      attachments: logo ? [logo] : [],
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    console.log(`[email ethereal] To: ${params.to} | preview: ${previewUrl || "n/a"}`);
    return {
      sent: true,
      previewUrl: typeof previewUrl === "string" ? previewUrl : undefined,
      reason: "Delivered to Ethereal test inbox (configure SMTP for real email)",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ethereal delivery failed";
    console.error("[email ethereal error]", message);
    etherealTransporter = null;
    return { sent: false, reason: message };
  }
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (params.userId && !params.skipNotification) {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: "PENDING_APPROVAL",
        title: params.subject,
        message: params.body.slice(0, 500),
        link: params.link,
      },
    });
  }

  const smtp = await resolveSmtpConfig();
  if (smtp) {
    return deliverViaSmtp(params, smtp);
  }

  if (process.env.NODE_ENV !== "production") {
    const ethereal = await deliverViaEthereal(params);
    if (ethereal.sent) return ethereal;
  }

  console.log(`[email stub] To: ${params.to} | ${params.subject}\n${params.body}`);
  return {
    sent: false,
    reason: "SMTP not configured — set SMTP in Settings or .env",
  };
}

export async function sendOtpEmail(
  email: string,
  otp: string,
  purpose: "login" | "password-reset" = "password-reset"
) {
  const isLogin = purpose === "login";
  const title = isLogin ? "Login verification" : "Password reset verification";
  return sendEmail({
    to: email,
    subject: isLogin
      ? `Login OTP — ${APP_SHORT_NAME} Accounting`
      : `Password Reset OTP — ${APP_SHORT_NAME} Accounting`,
    body: isLogin
      ? `Your login verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not try to sign in, ignore this email.`
      : `Your password reset verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request a password reset, ignore this email.`,
    skipNotification: true,
    html: emailShell(
      title,
      `
      <p style="margin:0 0 8px;color:${BRAND.muted}">Your verification code is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0;color:${BRAND.forest}">${otp}</p>
      <p style="margin:0;color:${BRAND.muted};font-size:14px">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
    `
    ),
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  return sendEmail({
    to: email,
    subject: `Password Reset — ${APP_SHORT_NAME} Accounting`,
    body: `Your password reset was approved. Set a new password using this link (expires in 1 hour):\n\n${resetUrl}`,
    userId: user?.id,
    link: resetUrl,
    html: emailShell(
      "Set a new password",
      `
      <p style="margin:0 0 16px;color:${BRAND.muted}">Your password reset was approved. Use the button below to choose a new password.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:${BRAND.lime};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          Reset password
        </a>
      </p>
      <p style="margin:0;color:${BRAND.muted};font-size:13px">This link expires in 1 hour.<br>${resetUrl}</p>
    `
    ),
  });
}

export async function sendWelcomeSetPasswordEmail(
  email: string,
  fullName: string,
  resetUrl: string
) {
  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_SHORT_NAME} Accounting — Set your password`,
    body: `Hello ${fullName},\n\nAn account has been created for you on ${APP_SHORT_NAME} Accounting.\n\nSet your password using this link (expires in 48 hours):\n\n${resetUrl}\n\nIf you did not expect this email, contact your administrator.`,
    link: resetUrl,
    skipNotification: true,
    html: emailShell(
      `Welcome, ${fullName}`,
      `
      <p style="margin:0 0 16px;color:${BRAND.muted}">An account has been created for you on ${APP_SHORT_NAME} Accounting. Click below to set your password and sign in.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:${BRAND.lime};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          Set your password
        </a>
      </p>
      <p style="margin:0;color:${BRAND.muted};font-size:13px">This link expires in 48 hours.<br>${resetUrl}</p>
    `
    ),
  });
}

export async function sendInvoiceEmail(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const settings = await prisma.companySetting.findFirst();
  const company = settings?.companyName || `${APP_SHORT_NAME} Accounting`;
  const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/api/invoices?id=${invoiceId}&format=pdf`;

  return sendEmail({
    to: invoice.customer.email || settings?.email || "noreply@example.com",
    subject: `Invoice ${invoice.invoiceNumber} from ${company}`,
    body: `Dear ${invoice.customer.name},\n\nPlease find your invoice ${invoice.invoiceNumber} for ${Number(invoice.total).toLocaleString()} UGX.\n\nDownload PDF: ${pdfUrl}`,
    html: emailShell(
      `Invoice ${invoice.invoiceNumber}`,
      `
      <p style="margin:0 0 16px;color:${BRAND.muted}">Dear ${invoice.customer.name},</p>
      <p style="margin:0 0 16px">Please find invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${Number(invoice.total).toLocaleString()} UGX</strong>.</p>
      <p style="margin:24px 0">
        <a href="${pdfUrl}" style="display:inline-block;background:${BRAND.lime};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">
          Download PDF
        </a>
      </p>
    `
    ),
  });
}
