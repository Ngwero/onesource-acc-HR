import { prisma } from "@/lib/prisma";

let cachedDefaultEntityId: string | null = null;

export async function getDefaultEntityId(): Promise<string | null> {
  if (cachedDefaultEntityId) return cachedDefaultEntityId;

  const entity = await prisma.entity.findFirst({
    where: { isActive: true, isDefault: true },
    select: { id: true },
  });

  if (entity) {
    cachedDefaultEntityId = entity.id;
    return entity.id;
  }

  const fallback = await prisma.entity.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  cachedDefaultEntityId = fallback?.id || null;
  return cachedDefaultEntityId;
}
