import type { Prisma } from "@prisma/client";

type ClassIdentityInput = {
  name?: string | null;
};

function normalize(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildClassDuplicateWhere(
  schoolId: string,
  schoolClass: ClassIdentityInput,
  excludedClassId?: string
): Prisma.SchoolClassWhereInput | undefined {
  const name = normalize(schoolClass.name);
  if (!name) return undefined;

  return {
    schoolId,
    name,
    ...(excludedClassId ? { id: { not: excludedClassId } } : {})
  };
}
