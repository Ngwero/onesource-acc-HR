"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Calculator, ShieldCheck, Users } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
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
    <div className="login-page login-page-v2 min-h-screen">
      <header className="login-topnav">
        <BrandLogo size="md" className="login-brand" />
        <p className="login-topnav-meta">Authorized personnel only</p>
      </header>

      <div className="login-shell">
        <section className="login-hero-panel" aria-label="Welcome">
          <div className="login-hero-media" aria-hidden>
            <img src="/login-hero.jpg" alt="" className="login-hero-img" />
            <div className="login-hero-shade" />
          </div>

          <div className="login-hero-copy">
            <span className="login-hero-pill">
              <span className="login-hero-pill-dot" aria-hidden />
              Finance · Inventory · People
            </span>
            <h1 className="login-display login-hero-title">
              Run your books
              <span>with clarity</span>
            </h1>
            <p className="login-hero-lead">
              One Source brings accounting and HR together — invoices, stock,
              payroll, and reports in one secure workspace.
            </p>
          </div>

          <div className="login-hero-badges" aria-hidden>
            <span className="login-hero-badge">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Accounting &amp; HR in one place
            </span>
            <span className="login-hero-badge">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Secure OTP sign-in
            </span>
          </div>

          <aside className="login-float-card">
            <div className="login-float-card-head">
              <BrandLogo size="sm" className="login-brand [&_img]:h-8" />
              <span className="login-float-year">2026</span>
            </div>
            <h2 className="login-display login-float-title">
              {step === "credentials" ? "Sign in to continue" : "Enter your OTP"}
            </h2>
            <p className="login-float-desc">
              {step === "credentials"
                ? `Use your ${APP_SHORT_NAME} account. We’ll email a one-time code to finish.`
                : `We sent a 6-digit code to ${email}.`}
            </p>

            <h1 className="sr-only">{APP_NAME}</h1>

            {step === "credentials" ? (
              <form onSubmit={handleCredentials} className="login-float-form">
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-100 bg-red-50/90 px-3 py-2.5 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
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
                  <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700">
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
              <form onSubmit={handleOtp} className="login-float-form">
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-100 bg-red-50/90 px-3 py-2.5 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}
                {message && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                    {message}
                  </div>
                )}
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-medium text-sky-900 hover:underline"
                  >
                    Open OTP email preview →
                  </a>
                )}
                {devOtp && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                    Dev OTP: <strong>{devOtp}</strong>
                  </div>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
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
          </aside>
        </section>

        <section className="login-feature-row" aria-label="What you get">
          <article className="login-feature-card login-feature-photo">
            <img src="/login-hero.jpg" alt="" />
          </article>
          <article className="login-feature-card">
            <span className="login-feature-icon" aria-hidden>
              <Calculator className="h-5 w-5" />
            </span>
            <h3 className="login-display">Accounting workspace</h3>
            <p>Invoices, banking, inventory, and financial reports in one ledger.</p>
          </article>
          <article className="login-feature-card">
            <span className="login-feature-icon" aria-hidden>
              <Users className="h-5 w-5" />
            </span>
            <h3 className="login-display">HR &amp; payroll</h3>
            <p>Employees, leave, attendance, and payroll beside your books.</p>
          </article>
          <article className="login-feature-card login-feature-trust">
            <span className="login-feature-icon" aria-hidden>
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h3 className="login-display">Secure by design</h3>
            <p>OTP-verified sign-in and role-based access for your team.</p>
          </article>
        </section>
      </div>
    </div>
  );
}
