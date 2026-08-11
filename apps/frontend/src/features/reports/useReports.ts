import { useCallback, useState } from "react";
import { somApi } from "../../api/somApi";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import type { ChartItem, ReportCharts } from "./reportTypes";

const emptyCharts: ReportCharts = { classes: [], subjects: [], teachers: [] };

export function useReports(language: AppLanguage) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [text, setText] = useState("");
  const [chart, setChart] = useState<ChartItem[]>([]);
  const [charts, setCharts] = useState<ReportCharts>(emptyCharts);

  const load = useCallback(async () => {
    try {
      const res = await somApi.reports.daily(date, language);
      setText(res.data.text);
      setChart(res.data.chart || []);
      setCharts(res.data.charts || emptyCharts);
    } catch {
      setText("");
      setChart([]);
      setCharts(emptyCharts);
    }
  }, [date, language]);

  return { date, setDate, text, chart, charts, load };
}

export type { ChartItem, ReportCharts };
