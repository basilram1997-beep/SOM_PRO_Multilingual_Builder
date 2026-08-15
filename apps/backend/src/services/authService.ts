import crypto from "node:crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getDefaultSchoolId } from "./schoolContext";
import {
  createMfaChallengeToken,
  getSchoolMfaPolicy,
  userRequiresMfa,
  verifyUserSecondFactor
} from "./mfaService";
import { getParentStudentIds, uniqueNonEmpty } from "./accountLinking";

const DEFAULT_AUTH_SECRET = "change-this-auth-secret-before-selling";
const AUTH_SECRET = process.env.SOM_PRO_AUTH_SECRET || process.env.SOM_PRO_LICENSE_SECRET || DEFAULT_AUTH_SECRET;
const TOKEN_TTL_SECONDS = Number(process.env.SOM_PRO_AUTH_TOKEN_TTL_SECONDS || 8 * 60 * 60);
const DEFAULT_ADMIN_EMAIL = process.env.SOM_PRO_ADMIN_EMAIL || "admin@sompro.local";
const DEFAULT_ADMIN_PASSWORD = process.env.SOM_PRO_ADMIN_PASSWORD || "";
const DEFAULT_ADMIN_NAME = process.env.SOM_PRO_ADMIN_NAME || "مدير النظام";
const LICENSE_ADMIN_NAME = "مدير المدرسة";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeLoginIdentifier(value: string) {
  const normalized = normalizeEmail(value);
  if (!normalized) return "";
  return normalized.includes("@") ? normalized : `${normalized}@som.local`;
}

function loginIdentifierCandidates(value: string) {
  const trimmed = String(value || "").trim();
  const lower = normalizeEmail(trimmed);
  const normalized = normalizeLoginIdentifier(trimmed);
  return Array.from(new Set([trimmed, lower, normalized].filter(Boolean)));
}

export async function findUsersByLoginIdentifier(value: string) {
  const candidates = loginIdentifierCandidates(value);
  if (!candidates.length) return [];

  return prisma.user.findMany({
    where: {
      OR: candidates.flatMap((identifier) => [{ email: identifier }, { name: identifier }])
    },
    include: { school: { select: { isActive: true } } }
  });
}

async function linkedStudentIdsForUser(user: { id: string; schoolId: string; studentId?: string | null; role?: UserRole }) {
  if (user.role !== "PARENT") return uniqueNonEmpty([user.studentId]);
  return uniqueNonEmpty([user.studentId, ...(await getParentStudentIds(prisma, user.schoolId, user.id))]);
}

export type LicenseAdminAccount = {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
};

export type AuthTokenPayload = {
  userId: string;
  schoolId: string;
  role: UserRole;
  tokenVersion: number;
  exp: number;
};

export type LoginSecondFactorInput = {
  mfaCode?: string;
  recoveryCode?: string;
};

function assertAuthSecretConfigured() {
  if (process.env.NODE_ENV === "production" && AUTH_SECRET === DEFAULT_AUTH_SECRET) {
    throw new Error("SOM_PRO_AUTH_SECRET must be changed before production use");
  }
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(value: string) {
  assertAuthSecretConfigured();
  return crypto.createHmac("sha256", AUTH_SECRET).update(value).digest("base64url");
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:v1:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [scheme, version, salt, expected] = String(stored || "").split(":");
  if (scheme !== "scrypt" || version !== "v1" || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

export function createAuthToken(payload: Omit<AuthTokenPayload, "exp">, ttlSeconds = TOKEN_TTL_SECONDS) {
  const fullPayload: AuthTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const body = base64Url(JSON.stringify(fullPayload));
  return `${body}.${sign(body)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature || sign(body) !== signature) throw new Error("INVALID_AUTH_TOKEN");
  const payload = JSON.parse(base64UrlDecode(body)) as AuthTokenPayload;
  if (!payload.userId || !payload.schoolId || !payload.role || !payload.exp) throw new Error("INVALID_AUTH_TOKEN");
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("AUTH_TOKEN_EXPIRED");
  return payload;
}

export async function ensureDefaultAdminUser() {
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  if (!DEFAULT_ADMIN_PASSWORD) {
    throw new Error("SOM_PRO_ADMIN_PASSWORD is required to create the first admin user");
  }

  const schoolId = await getDefaultSchoolId();
  return prisma.user.create({
    data: {
      schoolId,
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      password: hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: "ADMIN"
    }
  });
}

export async function ensureLicenseAdminAccount(
  account?: LicenseAdminAccount | null,
  license?: { schoolName?: string; institutionCode?: string },
  forcePasswordReset = false
) {
  if (!account?.email || !account?.password) return null;
  const schoolId = await getDefaultSchoolId();
  const email = normalizeLoginIdentifier(account.email);
  const name = account.name?.trim() || LICENSE_ADMIN_NAME;
  const role = account.role || "ADMIN";

  await prisma.school
    .update({
      where: { id: schoolId },
      data: {
        ...(license?.schoolName ? { name: license.schoolName } : {}),
        ...(license?.institutionCode ? { institutionCode: license.institutionCode } : {}),
        managerName: name
      }
    })
    .catch(() => null);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const updated = forcePasswordReset
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { password: hashPassword(account.password), name, role, tokenVersion: { increment: 1 } }
        })
      : existing;
    return {
      id: updated.id,
      schoolId: updated.schoolId,
      studentId: updated.studentId,
      name: updated.name,
      email: updated.email,
      role: updated.role
    };
  }

  const created = await prisma.user.create({
    data: { schoolId, name, email, password: hashPassword(account.password), role }
  });
  return {
    id: created.id,
    schoolId: created.schoolId,
    studentId: created.studentId,
    name: created.name,
    email: created.email,
    role: created.role
  };
}

export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) throw new Error("PASSWORD_TOO_SHORT");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !verifyPassword(currentPassword, user.password)) throw new Error("INVALID_CURRENT_PASSWORD");
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashPassword(newPassword), tokenVersion: { increment: 1 } }
  });
  return true;
}

export async function loginWithPassword(email: string, password: string, secondFactor?: LoginSecondFactorInput) {
  await ensureDefaultAdminUser();
  const users = await findUsersByLoginIdentifier(email);
  const user = users.find((candidate) => verifyPassword(password, candidate.password) && candidate.school.isActive);
  if (!user) {
    const inactiveMatch = users.find(
      (candidate) => verifyPassword(password, candidate.password) && !candidate.school.isActive
    );
    if (inactiveMatch) throw new Error("SCHOOL_INACTIVE");
    throw new Error("INVALID_LOGIN");
  }

  const mfaPolicy = await getSchoolMfaPolicy(user.schoolId);
  if (userRequiresMfa(user, mfaPolicy)) {
    if (!user.mfaEnabled || user.mfaMethod !== "TOTP" || !user.mfaSecretEncrypted) {
      return {
        mfaRequired: true,
        mfaEnrollmentRequired: true,
        user: {
          id: user.id,
          schoolId: user.schoolId,
          studentId: user.studentId,
          studentIds: await linkedStudentIdsForUser(user),
          name: user.name,
          email: user.email,
          role: user.role
        }
      };
    }

    const secondFactorOk = await verifyUserSecondFactor(user, {
      code: secondFactor?.mfaCode,
      recoveryCode: secondFactor?.recoveryCode
    });
    if (!secondFactorOk) {
      return {
        mfaRequired: true,
        mfaToken: createMfaChallengeToken(user),
        user: {
          id: user.id,
          schoolId: user.schoolId,
          studentId: user.studentId,
          studentIds: await linkedStudentIdsForUser(user),
          name: user.name,
          email: user.email,
          role: user.role
        }
      };
    }
  }

  await prisma.user
    .update({
      where: { id: user.id },
      data: { lastActivityAt: new Date() }
    })
    .catch(() => null);
  const token = createAuthToken({
    userId: user.id,
    schoolId: user.schoolId,
    role: user.role,
    tokenVersion: user.tokenVersion || 0
  });
  return {
    token,
    user: {
      id: user.id,
      schoolId: user.schoolId,
      studentId: user.studentId,
      studentIds: await linkedStudentIdsForUser(user),
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}
