import { withAuth, getClientInfo } from "@/lib/api-middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { saveUpload, listAttachments } from "@/lib/upload";

export const GET = withAuth(
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const module = searchParams.get("module");
    const recordId = searchParams.get("recordId");
    if (!module || !recordId) return errorResponse("module and recordId required");
    const attachments = await listAttachments(module, recordId);
    return successResponse(attachments);
  },
  { module: "dashboard", action: "read" }
);

export const POST = withAuth(
  async ({ user, request }) => {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const module = formData.get("module") as string;
    const recordId = formData.get("recordId") as string;

    if (!file || !module || !recordId) {
      return errorResponse("file, module, and recordId are required");
    }

    if (file.size > 10 * 1024 * 1024) {
      return errorResponse("File must be under 10MB");
    }

    const attachment = await saveUpload(file, module, recordId, user.id);
    return successResponse(attachment, "File uploaded", 201);
  },
  { module: "dashboard", action: "create" }
);
