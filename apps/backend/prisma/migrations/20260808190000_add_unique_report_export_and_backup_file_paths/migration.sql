-- CreateIndex
CREATE UNIQUE INDEX "reports_exports_school_id_file_path_key" ON "reports_exports"("school_id", "file_path");

-- CreateIndex
CREATE UNIQUE INDEX "backup_jobs_school_id_file_path_key" ON "backup_jobs"("school_id", "file_path");
