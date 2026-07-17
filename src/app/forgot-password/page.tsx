"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/layout/brand-logo";

type Step = "email" | "otp" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setDevOtp("");
    setPreviewUrl("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      if (data.data?.previewUrl) setPreviewUrl(String(data.data.previewUrl));
      setMessage(data.message);
      setStep("otp");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return;
      }
      setMessage(data.message);
      setStep("done");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            {step === "email" && "Enter your email to receive a one-time verification code"}
            {step === "otp" && "Enter the OTP sent to your email"}
            {step === "done" && "Waiting for admin approval"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {message && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
          {previewUrl && step === "otp" && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-4 block rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-900 hover:underline"
            >
              Open OTP email preview →
            </a>
          )}
          {devOtp && step === "otp" && (
            <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Dev OTP: <strong>{devOtp}</strong>
            </div>
          )}

          {step === "email" && (
            <form onSubmit={requestOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setMessage("");
                  setError("");
                  setDevOtp("");
                  setPreviewUrl("");
                }}
              >
                Use a different email
              </Button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-4 text-sm text-gray-600">
              <p>
                After an admin approves your request, you will receive an email with a link to set a
                new password.
              </p>
              <Link href="/login">
                <Button className="w-full">Back to login</Button>
              </Link>
            </div>
          )}

          {step !== "done" && (
            <p className="mt-4 text-center text-sm">
              <Link href="/login" className="text-green-700 hover:underline">
                Back to login
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
