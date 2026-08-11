import type { Request } from "express";
import { prisma } from "../db/prisma";

export class SchoolContextError extends Error {
  statusCode = 401;
  code = "SCHOOL_CONTEXT_REQUIRED";

  constructor() {
    super("School context is required");
  }
}

type SchoolIdResolver = () => Promise<string>;

let developmentSchoolIdResolver: SchoolIdResolver | null = null;

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

/**
 * Development-only fallback for local trials.
 * Keep this fallback only for local development and bootstrap flows before the first school exists.
 */
export async function getDefaultSchoolIdForDevelopmentOnly() {
  if (developmentSchoolIdResolver) return developmentSchoolIdResolver();

  const preferredSchoolId = process.env.SOM_E2E_SCHOOL_ID?.trim();
  let school = preferredSchoolId ? await prisma.school.findUnique({ where: { id: preferredSchoolId } }) : null;
  if (!school) {
    school = await prisma.school.findFirst({ orderBy: { createdAt: "desc" } });
  }
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: "مدرسة جديدة",
        address: ""
      }
    });
  }
  return school.id;
}

export async function getRequestSchoolId(req: Request) {
  if (req.user?.schoolId) return req.user.schoolId;

  if (!isProductionEnvironment()) {
    return getDefaultSchoolIdForDevelopmentOnly();
  }

  throw new SchoolContextError();
}

export function setDevelopmentSchoolIdResolverForTests(resolver: SchoolIdResolver | null) {
  developmentSchoolIdResolver = resolver;
}

/**
 * Backward-compatible helper for services that run before a user exists, such as first-login setup
 * and license bootstrap. Do not use this in school data routes.
 */
export async function getDefaultSchoolId() {
  return getDefaultSchoolIdForDevelopmentOnly();
}
