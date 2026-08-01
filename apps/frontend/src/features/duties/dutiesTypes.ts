import type { DutyAssignment, Teacher } from "@som/shared";

export type DutyRow = DutyAssignment & { teacher?: Teacher };
