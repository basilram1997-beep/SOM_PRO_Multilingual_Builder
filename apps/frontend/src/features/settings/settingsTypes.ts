export type SchoolInfo = {
  name: string;
  managerName: string;
  institutionCode: string;
  address: string;
};

export type SettingPeriod = {
  period: number;
  label?: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
};
