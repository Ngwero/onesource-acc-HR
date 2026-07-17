import { readFile } from "fs/promises";
import { withAuth } from "@/lib/api-middleware";
import { notFoundResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";

export const GET = withAuth(
  async ({ request }, _req, params) => {
    const id = params?.id;
    if (!id) return notFoundResponse("Attachment not found");

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) return notFoundResponse("Attachment not found");

    const { searchParams } = new URL(request.url);
    if (searchParams.get("meta") === "1") {
      return Response.json({ success: true, data: attachment });
    }

    if (attachment.filePath.startsWith("supabase://")) {
      const supabase = getSupabaseAdmin();
      if (!supabase) return notFoundResponse("Storage unavailable");
      const storagePath = attachment.filePath.replace("supabase://agribooks/", "");
      const { data, error } = await supabase.storage.from("agribooks").download(storagePath);
      if (error || !data) return notFoundResponse("File not found");
      const buffer = Buffer.from(await data.arrayBuffer());
      return new Response(buffer, {
        headers: {
          "Content-Type": attachment.fileType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${attachment.fileName}"`,
        },
      });
    }

    const fullPath = attachment.filePath.startsWith("/")
      ? attachment.filePath
      : `${process.env.UPLOAD_DIR || "./uploads"}/${attachment.filePath}`.replace(/\/+/g, "/");
    const buffer = await readFile(fullPath);
    return new Response(buffer, {
      headers: {
        "Content-Type": attachment.fileType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${attachment.fileName}"`,
      },
    });
  },
  { module: "dashboard", action: "read" }
);
