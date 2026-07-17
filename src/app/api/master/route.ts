import { withAuth } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

type MasterType = "unit" | "location" | "category";

export const POST = withAuth(
  async ({ request }) => {
    const body = await request.json();
    const { type, action } = body as { type: MasterType; action: string };

    if (action === "create") {
      switch (type) {
        case "unit": {
          const item = await prisma.unitOfMeasure.create({ data: { code: body.code, name: body.name } });
          return successResponse(item, "Unit created", 201);
        }
        case "location": {
          const item = await prisma.stockLocation.create({
            data: { code: body.code, name: body.name, description: body.description },
          });
          return successResponse(item, "Location created", 201);
        }
        case "category": {
          const item = await prisma.expenseCategory.create({ data: { code: body.code, name: body.name } });
          return successResponse(item, "Category created", 201);
        }
        default:
          return errorResponse("Unknown type");
      }
    }

    if (action === "update") {
      switch (type) {
        case "unit": {
          const item = await prisma.unitOfMeasure.update({
            where: { id: body.id },
            data: { code: body.code, name: body.name },
          });
          return successResponse(item, "Unit updated");
        }
        case "location": {
          const item = await prisma.stockLocation.update({
            where: { id: body.id },
            data: { code: body.code, name: body.name, description: body.description, isActive: body.isActive },
          });
          return successResponse(item, "Location updated");
        }
        case "category": {
          const item = await prisma.expenseCategory.update({
            where: { id: body.id },
            data: { code: body.code, name: body.name },
          });
          return successResponse(item, "Category updated");
        }
        default:
          return errorResponse("Unknown type");
      }
    }

    if (action === "delete") {
      switch (type) {
        case "unit":
          await prisma.unitOfMeasure.delete({ where: { id: body.id } });
          break;
        case "location":
          await prisma.stockLocation.update({ where: { id: body.id }, data: { isActive: false } });
          break;
        case "category":
          await prisma.expenseCategory.delete({ where: { id: body.id } });
          break;
        default:
          return errorResponse("Unknown type");
      }
      return successResponse(null, "Deleted");
    }

    return errorResponse("Unknown action");
  },
  { module: "settings", action: "update" }
);
