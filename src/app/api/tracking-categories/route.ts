import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async () => {
    const categories = await prisma.trackingCategory.findMany({ orderBy: { name: "asc" } });
    return successResponse(categories);
  },
  { module: "settings", action: "read" }
);

export const POST = withAuth(
  async ({ request }) => {
    const body = await request.json();
    if (body.action === "delete") {
      await prisma.trackingCategory.update({ where: { id: body.id }, data: { isActive: false } });
      return successResponse(null, "Category deactivated");
    }
    const category = await prisma.trackingCategory.create({
      data: { name: body.name, options: body.options || [] },
    });
    return successResponse(category, "Tracking category created", 201);
  },
  { module: "settings", action: "create" }
);

export const PATCH = withAuth(
  async ({ request }) => {
    const body = await request.json();
    const category = await prisma.trackingCategory.update({
      where: { id: body.id },
      data: { name: body.name, options: body.options, isActive: body.isActive },
    });
    return successResponse(category, "Tracking category updated");
  },
  { module: "settings", action: "update" }
);
