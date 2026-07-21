import { prisma } from "@/lib/prisma";

export function clampSessionIdleMinutes(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 5) return 15;
  return Math.min(240, Math.round(n));
}

export async function getSessionIdleMinutes() {
  const fromEnv = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES);
  const settings = await prisma.companySetting.findFirst({
    select: { sessionIdleMinutes: true },
  });
  if (settings?.sessionIdleMinutes != null) {
    return clampSessionIdleMinutes(settings.sessionIdleMinutes);
  }
  return clampSessionIdleMinutes(fromEnv);
}
