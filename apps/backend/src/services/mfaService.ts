import crypto from "node:crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { hashPassword, verifyPassword } from "./authService";

const MFA_KEY_SOURCE =
  process.env.SOM_PRO_MFA_ENCRYPTION_KEY ||
  process.env.SOM_PRO_AUTH_SECRET ||
  process.env.SOM_PRO_LICENSE_SECRET ||
  "change-this-auth-secret-before-selling";
const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const privilegedMfaRoles = new Set<UserRole>(["ADMIN", "MANAGER", "SCHEDULER"]);
const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

type StoredRecoveryCode = {
  hash: string;
  usedAt?: string | null;
};

export type StoredMfaState = {
  version: 1;
  method: "totp";
  secret: string;
  recoveryCodes: StoredRecoveryCode[];
  createdAt: string;
};

export type MfaCapableUser = {
  id: string;
  schoolId: string;
  role: UserRole;
  mfaEnabled?: boolean | null;
  mfaMethod?: string | null;
  mfaSecretEncrypted?: string | null;
};

function encryptionKey() {
  return crypto.createHash("sha256").update(MFA_KEY_SOURCE).digest();
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto.createHmac("sha256", encryptionKey()).update(value).digest("base64url");
}

function encodeBase32(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += base32Alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(value: string) {
  const clean = value.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let current = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = base32Alphabet.indexOf(char);
    if (index < 0) throw new Error("INVALID_BASE32_SECRET");
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function generateTotpCode(secret: string, now = Date.now()) {
  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(secret: string, code: string, now = Date.now()) {
  const clean = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;

  for (const offset of [-1, 0, 1]) {
    const expected = generateTotpCode(secret, now + offset * TOTP_PERIOD_SECONDS * 1000);
    if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) return true;
  }

  return false;
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(9).toString("base64url").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

export function encryptMfaState(state: StoredMfaState) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `mfa:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptMfaState(value: string): StoredMfaState {
  const [prefix, version, iv, tag, encrypted] = String(value || "").split(":");
  if (prefix !== "mfa" || version !== "v1" || !iv || !tag || !encrypted) throw new Error("INVALID_MFA_STATE");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString(
    "utf8"
  );
  return JSON.parse(plain) as StoredMfaState;
}

export function createMfaEnrollment(label: string, issuer = "SOM PRO") {
  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();
  const state: StoredMfaState = {
    version: 1,
    method: "totp",
    secret,
    recoveryCodes: recoveryCodes.map((code) => ({ hash: hashPassword(code), usedAt: null })),
    createdAt: new Date().toISOString()
  };
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
  return {
    secret,
    otpauthUrl,
    recoveryCodes,
    encryptedState: encryptMfaState(state)
  };
}

export function userRequiresMfa(user: MfaCapableUser, schoolPolicy?: { adminMfaRequired?: boolean | null } | null) {
  if (!privilegedMfaRoles.has(user.role)) return false;
  return Boolean(user.mfaEnabled || schoolPolicy?.adminMfaRequired);
}

export function createMfaChallengeToken(user: Pick<MfaCapableUser, "id" | "schoolId" | "role">) {
  const body = base64Url(
    JSON.stringify({
      purpose: "mfa-login",
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + MFA_CHALLENGE_TTL_SECONDS
    })
  );
  return `${body}.${sign(body)}`;
}

export function verifyMfaChallengeToken(token: string) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature || sign(body) !== signature) throw new Error("INVALID_MFA_CHALLENGE");
  const payload = JSON.parse(base64UrlDecode(body)) as {
    purpose?: string;
    userId?: string;
    schoolId?: string;
    role?: UserRole;
    exp?: number;
  };
  if (payload.purpose !== "mfa-login" || !payload.userId || !payload.schoolId || !payload.role || !payload.exp) {
    throw new Error("INVALID_MFA_CHALLENGE");
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("MFA_CHALLENGE_EXPIRED");
  return payload;
}

export async function verifyUserSecondFactor(user: MfaCapableUser, input: { code?: string; recoveryCode?: string }) {
  if (!user.mfaEnabled || user.mfaMethod !== "TOTP" || !user.mfaSecretEncrypted) return false;
  const state = decryptMfaState(user.mfaSecretEncrypted);
  if (input.code && verifyTotpCode(state.secret, input.code)) return true;

  const recoveryCode = String(input.recoveryCode || "").trim();
  if (!recoveryCode) return false;

  const matchIndex = state.recoveryCodes.findIndex((item) => !item.usedAt && verifyPassword(recoveryCode, item.hash));
  if (matchIndex < 0) return false;

  state.recoveryCodes[matchIndex] = { ...state.recoveryCodes[matchIndex], usedAt: new Date().toISOString() };
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecretEncrypted: encryptMfaState(state) }
  });
  return true;
}

export async function getSchoolMfaPolicy(schoolId: string) {
  const [school, settings] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { adminMfaRequired: true } }),
    prisma.schoolSettings.findUnique({ where: { schoolId }, select: { adminMfaRequired: true } }).catch(() => null)
  ]);
  return { adminMfaRequired: Boolean(school?.adminMfaRequired || settings?.adminMfaRequired) };
}

export async function findPrivilegedUsersMissingMfa(schoolId: string) {
  return prisma.user.findMany({
    where: {
      schoolId,
      role: { in: Array.from(privilegedMfaRoles) },
      OR: [{ mfaEnabled: false }, { mfaMethod: null }, { mfaSecretEncrypted: null }]
    },
    select: { id: true, email: true, role: true }
  });
}

export async function getMfaProductionReadiness(schoolId: string) {
  const missingPrivilegedUsers = await findPrivilegedUsersMissingMfa(schoolId);
  return {
    ok: missingPrivilegedUsers.length === 0,
    requiredRoles: Array.from(privilegedMfaRoles),
    missingPrivilegedUsers
  };
}
