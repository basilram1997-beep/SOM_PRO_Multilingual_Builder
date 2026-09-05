const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__somLicenseServerPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__somLicenseServerPrisma = prisma;
}

async function disconnectLicenseServerDb() {
  await prisma.$disconnect().catch(() => null);
}

module.exports = {
  disconnectLicenseServerDb,
  prisma
};
