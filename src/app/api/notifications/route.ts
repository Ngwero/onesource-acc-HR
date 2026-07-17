import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { successResponse } from "@/lib/api-response";

export const GET = withAuth(
  async ({ user, request }) => {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return successResponse(notifications);
  },
  { module: "dashboard", action: "read" }
);

export const PATCH = withAuth(
  async ({ user, request }) => {
    const body = await request.json();
    if (body.action === "mark-all-read") {
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });
      return successResponse(null, "All notifications marked read");
    }
    if (body.id) {
      await prisma.notification.update({
        where: { id: body.id, userId: user.id },
        data: { isRead: true },
      });
    }
    return successResponse(null, "Notification updated");
  },
  { module: "dashboard", action: "read" }
);
