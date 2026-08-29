import { allowedPagesForRole, type AppPageKey } from "@som/shared";
import type { PageKey } from "./main";

export const schedulerAllowedPages: PageKey[] = ["daily", "homeroom", "duties"];

export function canAccessPage(role: string | undefined, page: PageKey) {
  if (!role) return false;
  return allowedPagesForRole(role).includes(page as AppPageKey);
}

export function fallbackPageForRole(role: string | undefined): PageKey {
  if (role === "TEACHER") return "homeroomPortal";
  if (role === "SCHEDULER") return "daily";
  if (role === "STUDENT" || role === "PARENT") return "studentTimetable";
  return "dashboard";
}
