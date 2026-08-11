export const PERIOD_LABEL = "الحصة";

export type SettingPeriodLike = {
  period: number;
  label?: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
};

export function upsertPeriod<T extends SettingPeriodLike>(list: T[], period: number, patch: Partial<T>) {
  const found = list.find((item) => item.period === period) || {
    period,
    label: `${PERIOD_LABEL} ${period}`,
    isActive: true
  };
  const next = { ...found, ...patch };
  return [...list.filter((item) => item.period !== period), next].sort((left, right) => left.period - right.period);
}
