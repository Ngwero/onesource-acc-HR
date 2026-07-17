import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

export async function saveUpload(
  file: File,
  module: string,
  recordId: string,
  userId: string
) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || "";
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const relativePath = `${module}/${recordId}/${safeName}`;

  let filePath = relativePath;

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.storage
      .from("agribooks")
      .upload(relativePath, bytes, { contentType: file.type, upsert: true });
    if (error) throw new Error(error.message);
    filePath = `supabase://agribooks/${relativePath}`;
  } else {
    const fullPath = path.join(UPLOAD_DIR, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);
    filePath = fullPath;
  }

  return prisma.attachment.create({
    data: {
      fileName: file.name,
      fileType: file.type || ext,
      fileSize: bytes.length,
      filePath,
      module,
      recordId,
      uploadedById: userId,
    },
  });
}

export async function listAttachments(module: string, recordId: string) {
  return prisma.attachment.findMany({
    where: { module, recordId },
    include: { uploadedBy: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
}
