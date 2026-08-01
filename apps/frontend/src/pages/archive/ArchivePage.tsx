import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import { useArchive } from "../../features/archive/useArchive";
import { ArchiveSavedDaysTable } from "../../features/archive/ArchiveSavedDaysTable";

type Props = {
  onEditDay: (date: string) => void;
};

export function ArchivePage({ onEditDay }: Props) {
  const { t, language } = useI18n();
  const archive = useArchive();

  return (
    <div className="page archive-page" data-e2e="archive-page">
      <div className="page-title-row archive-page-title">
        <div>
          <h2>{t("archive.title")}</h2>
          <p>{t("archive.savedDays")}</p>
        </div>
        <button onClick={archive.load}>{t("common.refresh")}</button>
      </div>
      <Card title={t("archive.savedDays")}>
        <ArchiveSavedDaysTable
          items={archive.items}
          t={t}
          language={language}
          onEditDay={onEditDay}
          onDeleteDay={archive.remove}
        />
      </Card>
    </div>
  );
}
