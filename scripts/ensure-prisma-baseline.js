const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");
const path = require("path");
const { error, log } = require("./cli-output");

const root = path.resolve(__dirname, "..");
const backendSchema = path.join(root, "apps", "backend", "prisma", "schema.prisma");
const baselineMigrationName = "20260718175000_baseline_current_schema";

async function main() {
  const prisma = new PrismaClient();

  try {
    const tables = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `;
    const tableCount = Number(tables[0]?.count || 0);

    let migrationTableExists = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "_prisma_migrations" LIMIT 1`;
      migrationTableExists = true;
    } catch {
      migrationTableExists = false;
    }

    if (tableCount > 0 && !migrationTableExists) {
      log(`تم اكتشاف قاعدة بيانات موجودة فيها ${tableCount} جداول بدون سجل migrations. سيتم اعتماد baseline أولًا.`);
      execSync(`npx prisma migrate resolve --applied ${baselineMigrationName} --schema ${backendSchema}`, {
        cwd: root,
        stdio: "inherit",
        shell: true
      });
    } else {
      log("سجل migrations موجود أو قاعدة البيانات فارغة. لا حاجة لاعتماد baseline.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((failure) => {
  error("فشل تجهيز Prisma baseline:", failure instanceof Error ? failure.message : failure);
  process.exit(1);
});
