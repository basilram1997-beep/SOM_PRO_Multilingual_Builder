import type { DailyStatusDraft, Translate } from "./dailyTypes";
import { statusLabel } from "./dailyHelpers";

type Props = {
  t: Translate;
  statuses: DailyStatusDraft[];
  teacherName: (id: string) => string;
  onRemove: (index: number) => void;
};

export function DailyStatusList({ t, statuses, teacherName, onRemove }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("common.teacher")}</th>
            <th>{t("common.status")}</th>
            <th>{t("daily.statusReason")}</th>
            <th>{t("common.from")}</th>
            <th>{t("common.to")}</th>
            <th>{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {statuses.length === 0 && (
            <tr>
              <td colSpan={6}>{t("daily.noStatuses")}</td>
            </tr>
          )}
          {statuses.map((status, index) => (
            <tr key={index} data-e2e={`daily-status-row-${index}`}>
              <td>{teacherName(status.teacherId)}</td>
              <td>{statusLabel(status.type, t)}</td>
              <td>{status.reason || t("common.none")}</td>
              <td>{status.fromPeriod}</td>
              <td>{status.toPeriod}</td>
              <td>
                <button
                  data-e2e={`daily-status-remove-${index}`}
                  className="danger light"
                  onClick={() => onRemove(index)}
                >
                  {t("common.delete")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
