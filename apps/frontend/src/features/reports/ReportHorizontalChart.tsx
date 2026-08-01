import { chartColor } from "../../utils/teacherColors";
import type { ChartItem } from "./reportTypes";

type Props = {
  title: string;
  data: ChartItem[];
};

export function ReportHorizontalChart({ title, data }: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <section className="report-chart-card">
      <h4>{title}</h4>
      {total === 0 ? (
        <p className="muted">{"-"}</p>
      ) : (
        <div className="report-horizontal-chart">
          {data.map((item, index) => {
            const share = Math.round((item.value / total) * 100);
            const width = Math.max(8, (item.value / max) * 100);
            return (
              <div className="report-horizontal-row" key={item.label}>
                <div className="report-horizontal-label">
                  <i style={{ background: chartColor(index) }} />
                  <strong>{item.label}</strong>
                </div>
                <div className="report-horizontal-bar-track">
                  <div
                    className="report-horizontal-bar"
                    style={{ width: `${width}%`, background: chartColor(index) }}
                    title={`${item.label}: ${item.value} (${share}%)`}
                    aria-label={`${item.label}: ${item.value} (${share}%)`}
                  />
                </div>
                <span className="report-horizontal-value">
                  {item.value} ({share}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
