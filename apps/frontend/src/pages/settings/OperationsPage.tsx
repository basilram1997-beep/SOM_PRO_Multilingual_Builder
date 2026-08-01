import { useEffect } from "react";
import { useI18n } from "../../i18n/i18n";
import { SchoolOperationsPanel } from "../../features/reports/SchoolOperationsPanel";
import { useSchoolOperations } from "../../features/reports/useSchoolOperations";

export function OperationsPage() {
  const { language } = useI18n();
  const operations = useSchoolOperations(language);

  useEffect(() => {
    void operations.load();
  }, [operations.load]);

  return (
    <div className="page">
      <SchoolOperationsPanel operations={operations} />
    </div>
  );
}
