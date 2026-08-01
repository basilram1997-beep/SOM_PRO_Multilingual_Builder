import { UserRole } from "@prisma/client";

export type Permission =
  "read" | "manageTeachers" | "manageSchedules" | "manageSettings" | "manageLicense" | "manageLessons";

const rolePermissions: Record<UserRole, Permission[]> = {
  ADMIN: ["read", "manageTeachers", "manageSchedules", "manageSettings", "manageLicense", "manageLessons"],
  MANAGER: ["read", "manageTeachers", "manageSchedules", "manageSettings", "manageLessons"],
  SCHEDULER: ["read", "manageSchedules"],
  TEACHER: ["read", "manageLessons"],
  STUDENT: ["read"],
  PARENT: ["read"]
};

export function canRole(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function permissionsForRole(role: UserRole) {
  return [...rolePermissions[role]];
}
