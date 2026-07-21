"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const WARN_BEFORE_MS = 60 * 1000;

function clampIdleMinutes(value: number) {
  if (!Number.isFinite(value) || value < 5) return 15;
  return Math.min(240, Math.round(value));
}

export function IdleSessionGuard({
  idleMinutes,
  children,
}: {
  idleMinutes: number;
  children: React.ReactNode;
}) {
  const minutes = clampIdleMinutes(idleMinutes);
  const idleMs = minutes * 60 * 1000;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(Date.now());
  const loggingOutRef = useRef(false);

  const logout = useCallback((reason: "idle" | "manual" = "idle") => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    window.location.href = `/api/auth/logout?reason=${reason}`;
  }, []);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(null);
  }, []);

  const staySignedIn = useCallback(async () => {
    markActivity();
    try {
      await fetch("/api/auth/session/refresh", { method: "POST" });
      lastRefreshRef.current = Date.now();
    } catch {
      // ignore — timer will still enforce idle logout
    }
  }, [markActivity]);

  useEffect(() => {
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const onActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 1000);
      lastActivityRef.current = Date.now();
      setSecondsLeft(null);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    const tick = window.setInterval(() => {
      if (loggingOutRef.current) return;
      const now = Date.now();
      const inactiveFor = now - lastActivityRef.current;
      const remaining = idleMs - inactiveFor;

      if (remaining <= 0) {
        logout("idle");
        return;
      }

      if (remaining <= WARN_BEFORE_MS) {
        setSecondsLeft(Math.max(1, Math.ceil(remaining / 1000)));
      } else {
        setSecondsLeft(null);
      }

      // Sliding session: refresh JWT while the user is active
      if (
        inactiveFor < 60_000 &&
        now - lastRefreshRef.current >= REFRESH_INTERVAL_MS
      ) {
        lastRefreshRef.current = now;
        void fetch("/api/auth/session/refresh", { method: "POST" }).catch(() => {});
      }
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      window.clearInterval(tick);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [idleMs, logout]);

  return (
    <>
      {children}
      {secondsLeft !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-session-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl">
            <h2 id="idle-session-title" className="text-lg font-semibold text-amber-950">
              Still there?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You will be signed out in{" "}
              <span className="font-semibold text-amber-800">{secondsLeft}s</span> due to
              inactivity ({minutes} minute session timeout).
            </p>
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={() => void staySignedIn()}>
                Stay signed in
              </Button>
              <Button type="button" variant="outline" onClick={() => logout("manual")}>
                Sign out now
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
