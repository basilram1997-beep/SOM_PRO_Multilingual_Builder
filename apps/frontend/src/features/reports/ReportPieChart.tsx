import { chartColor } from "../../utils/teacherColors";
import type { ChartItem } from "./reportTypes";

type Props = {
  title: string;
  data: ChartItem[];
};

export function ReportPieChart({ title, data }: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const gradient = total
    ? (() => {
        let start = 0;
        return data
          .map((item, index) => {
            const percent = (item.value / total) * 100;
            const from = start;
            start += percent;
            return `${chartColor(index)} ${from}% ${start}%`;
          })
          .join(", ");
      })()
    : "";
  return (
    <section className="pie-card">
      <h4>{title}</h4>
      <div className="pie-chart-shell">
        {total > 0 ? (
          <div
            className="pie-chart"
            style={{ background: `conic-gradient(${gradient})` }}
            aria-label={title}
            title={title}
          >
            <span>{total}</span>
          </div>
        ) : (
          <div className="pie-chart pie-chart-empty">
            <span>-</span>
          </div>
        )}
      </div>
      <div className="pie-legend">
        {data.length === 0 && <p className="muted">-</p>}
        {data.map((item, index) => {
          const share = total ? Math.max(0, Math.round((item.value / total) * 100)) : 0;
          return (
            <span key={item.label}>
              <strong>
                <i style={{ background: chartColor(index) }} />
                {item.label}
              </strong>
              <em>
                {item.value} ({share}%)
              </em>
            </span>
          );
        })}
      </div>
    </section>
  );
}
