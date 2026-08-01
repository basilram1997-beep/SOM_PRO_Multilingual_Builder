-- CreateTable
CREATE TABLE "reports_exports" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "requested_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "reports_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_jobs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "backup_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "file_path" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created_by" TEXT,

    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_exports_school_id_created_at_idx" ON "reports_exports"("school_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_exports_school_id_expires_at_idx" ON "reports_exports"("school_id", "expires_at");

-- CreateIndex
CREATE INDEX "reports_exports_school_id_status_idx" ON "reports_exports"("school_id", "status");

-- CreateIndex
CREATE INDEX "reports_exports_school_id_report_type_idx" ON "reports_exports"("school_id", "report_type");

-- CreateIndex
CREATE INDEX "backup_jobs_school_id_started_at_idx" ON "backup_jobs"("school_id", "started_at");

-- CreateIndex
CREATE INDEX "backup_jobs_school_id_status_idx" ON "backup_jobs"("school_id", "status");

-- CreateIndex
CREATE INDEX "backup_jobs_school_id_backup_type_idx" ON "backup_jobs"("school_id", "backup_type");

-- AddForeignKey
ALTER TABLE "reports_exports" ADD CONSTRAINT "reports_exports_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports_exports" ADD CONSTRAINT "reports_exports_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
