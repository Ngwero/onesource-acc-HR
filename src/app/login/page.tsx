"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { LoginParticles } from "@/components/auth/login-particles";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/branding";
import { markFreshLogin } from "@/lib/product-tour";

type Step = "credentials" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setDevOtp("");
    setPreviewUrl("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Login failed");
        return;
      }

      if (data.data?.requiresOtp) {
        if (data.data.previewUrl) setPreviewUrl(String(data.data.previewUrl));
        setMessage(data.message || "Enter the OTP sent to your email.");
        setStep("otp");
        return;
      }

      finishLogin();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const finishLogin = () => {
    markFreshLogin();
    router.push("/apps");
    router.refresh();
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Invalid OTP");
        return;
      }
      finishLogin();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page relative grid min-h-screen overflow-hidden lg:grid-cols-2">
      <LoginParticles className="pointer-events-none absolute inset-0 z-0 opacity-70 lg:opacity-40" density="soft" />

      <aside className="login-hero relative z-[1] hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
        <LoginParticles className="pointer-events-none absolute inset-0" density="rich" />
        <div className="login-hero-orb login-hero-orb-a" aria-hidden />
        <div className="login-hero-orb login-hero-orb-b" aria-hidden />

        <div className="relative z-10 p-10 xl:p-14">
          <BrandLogo size="lg" variant="light" className="login-brand" />
        </div>

        <div className="relative z-10 max-w-lg p-10 xl:p-14">
          <p className="login-display text-sm font-medium tracking-[0.18em] text-[#C8E88A] uppercase">
            Internal access
          </p>
          <h1 className="login-display mt-4 text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
            {APP_SHORT_NAME}
            <span className="mt-2 block text-[#C8E88A]/90">Accounting System</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/75">
            Secure workspace for finance, inventory, sales, and reporting.
          </p>
        </div>

        <div className="relative z-10 border-t border-white/10 px-10 py-6 text-sm text-slate-400 xl:px-14">
          Authorized personnel only
        </div>
      </aside>

      <main className="relative z-[1] flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="login-panel w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <BrandLogo size="lg" className="login-brand" />
          </div>

          <div className="login-reveal">
            <p className="login-display text-sm font-medium tracking-wide text-slate-500">
              {step === "credentials" ? "Welcome back" : "Almost there"}
            </p>
            <h2 className="login-display mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {step === "credentials" ? "Sign in" : "Enter OTP"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {step === "credentials"
                ? `Use your ${APP_SHORT_NAME} account credentials.`
                : `We sent a 6-digit code to ${email}.`}
            </p>
            <h1 className="sr-only">{APP_NAME}</h1>
          </div>

          {step === "credentials" ? (
            <form
              onSubmit={handleCredentials}
              className="login-reveal login-reveal-delay mt-8 space-y-5"
            >
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-input"
                />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
                  Password
                  <Link
                    href="/forgot-password"
                    className="font-medium text-[#105820] hover:underline"
                  >
                    Forgot?
                  </Link>
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="login-input pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold tracking-wide text-slate-500 uppercase hover:text-slate-800"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <button type="submit" disabled={loading} className="login-submit">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="login-spinner" aria-hidden />
                    Verifying...
                  </span>
                ) : (
                  "Continue"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtp} className="login-reveal login-reveal-delay mt-8 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {message}
                </div>
              )}
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900 hover:underline"
                >
                  Open OTP email preview →
                </a>
              )}
              {devOtp && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Dev OTP: <strong>{devOtp}</strong>
                </div>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Verification code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="login-input tracking-[0.35em]"
                />
              </label>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="login-submit"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="login-spinner" aria-hidden />
                    Verifying...
                  </span>
                ) : (
                  "Verify & sign in"
                )}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setDevOtp("");
                  setPreviewUrl("");
                  setMessage("");
                  setError("");
                }}
                className="w-full text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Back to password
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
