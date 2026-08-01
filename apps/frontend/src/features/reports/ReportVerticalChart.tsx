import { chartColor } from "../../utils/teacherColors";
import type { ChartItem } from "./reportTypes";

type Props = {
  title: string;
  data: ChartItem[];
};

export function ReportVerticalChart({ title, data }: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <section className="report-chart-card">
      <h4>{title}</h4>
      {total === 0 ? (
        <p className="muted">{"-"}</p>
      ) : (
        <div className="report-vertical-chart">
          {data.map((item, index) => {
            const share = Math.round((item.value / total) * 100);
            const height = Math.max(12, (item.value / max) * 100);
            return (
              <div className="report-vertical-column" key={item.label}>
                <div className="report-vertical-bar-wrap">
                  <div
                    className="report-vertical-bar"
                    style={{ height: `${height}%`, background: chartColor(index) }}
                    title={`${item.label}: ${item.value} (${share}%)`}
                    aria-label={`${item.label}: ${item.value} (${share}%)`}
                  >
                    <strong>{share}%</strong>
                  </div>
                </div>
                <span className="report-vertical-label">{item.label}</span>
                <em>{item.value}</em>
              </div>
            );
          })}
        </div>
      )}
      <div className="report-legend-inline">
        {data.map((item, index) => {
          const share = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <span key={item.label}>
              <i style={{ background: chartColor(index) }} />
              {item.label}: {item.value} ({share}%)
            </span>
          );
        })}
      </div>
    </section>
  );
}
