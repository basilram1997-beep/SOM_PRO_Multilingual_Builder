import { useEffect, useState } from "react";
import { somApi } from "../../api/somApi";
import { localizePeriodName } from "../../i18n/displayNames";
import { userFacingErrorMessage } from "../../lib/errorMessage";
import type { SchoolInfo, SettingPeriod } from "./settingsTypes";

const ALL_WEEK_DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const DEFAULT_WORKING_DAYS = ["السبت", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const PERIOD_LABEL = "الحصة";

export type SettingsLanguage = "ar" | "en" | "he";

export function useSettings(
  enterSchoolNameMessage: string,
  saveSchoolInfoMessage: string,
  saveSettingsMessage: string,
  savePeriodsMessage: string
) {
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    name: "",
    managerName: "",
    institutionCode: "",
    address: ""
  });
  const [workingDays, setWorkingDays] = useState<string[]>(DEFAULT_WORKING_DAYS);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [maxTeachers, setMaxTeachers] = useState(100);
  const [adminMfaRequired, setAdminMfaRequired] = useState(false);
  const [periods, setPeriods] = useState<SettingPeriod[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const res = await somApi.settings.get();
      const school = res.data.school;
      setSchoolInfo({
        name: school?.name || "",
        managerName: school?.managerName || "",
        institutionCode: school?.institutionCode || "",
        address: school?.address || ""
      });
      setWorkingDays(res.data.settings.workingDays || DEFAULT_WORKING_DAYS);
      setPeriodsPerDay(res.data.settings.periodsPerDay || 7);
      setMaxTeachers(res.data.settings.maxTeachers || 100);
      setAdminMfaRequired(Boolean(res.data.settings.adminMfaRequired));
      setPeriods((res.data.periods || []) as SettingPeriod[]);
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل تحميل إعدادات المدرسة"));
    }
  }

  useEffect(() => {
    load().catch((error) => console.error(error));
  }, []);

  function toggleDay(day: string) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function saveSchoolInfo() {
    if (!schoolInfo.name.trim()) return alert(enterSchoolNameMessage);
    try {
      await somApi.settings.updateSchool(schoolInfo);
      setMessage(saveSchoolInfoMessage);
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل حفظ بيانات المدرسة"));
    }
  }

  async function save() {
    const offDays = ALL_WEEK_DAYS.filter((d) => !workingDays.includes(d));
    try {
      await somApi.settings.update({ workingDays, offDays, periodsPerDay, maxTeachers, adminMfaRequired });
      setMessage(saveSettingsMessage);
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل حفظ الإعدادات"));
    }
  }

  async function savePeriods() {
    const active = Array.from({ length: periodsPerDay }, (_, i) => {
      const period = i + 1;
      const existing = periods.find((p) => p.period === period);
      return {
        period,
        label: existing?.label || `${PERIOD_LABEL} ${period}`,
        startTime: existing?.startTime || "",
        endTime: existing?.endTime || "",
        isActive: true
      };
    });
    try {
      await somApi.settings.updatePeriods(active);
      setMessage(savePeriodsMessage);
      await load();
    } catch (error) {
      console.error(error);
      alert(userFacingErrorMessage(error, "فشل حفظ تعريف الحصص"));
    }
  }

  return {
    schoolInfo,
    workingDays,
    periodsPerDay,
    maxTeachers,
    adminMfaRequired,
    periods,
    message,
    setSchoolInfo,
    setWorkingDays,
    setPeriodsPerDay,
    setMaxTeachers,
    setAdminMfaRequired,
    setPeriods,
    toggleDay,
    saveSchoolInfo,
    save,
    savePeriods,
    localizePeriodName
  };
}

export function upsertPeriod(list: SettingPeriod[], period: number, patch: Partial<SettingPeriod>) {
  const found = list.find((p) => p.period === period) || { period, label: `${PERIOD_LABEL} ${period}`, isActive: true };
  const next = { ...found, ...patch };
  return [...list.filter((p) => p.period !== period), next].sort((a, b) => a.period - b.period);
}
