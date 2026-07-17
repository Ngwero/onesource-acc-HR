import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/client";

export async function notifyManagers(params: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const managers = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER"] }, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  if (managers.length === 0) return;

  await prisma.notification.createMany({
    data: managers.map((u) => ({
      userId: u.id,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    })),
  });
}

/** Password resets require Super Admin / Admin approval only. */
export async function notifyAdmins(params: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((u) => ({
      userId: u.id,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    })),
  });
}
