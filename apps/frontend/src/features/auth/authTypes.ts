export type AuthUser = {
  id: string;
  schoolId: string;
  studentId?: string | null;
  name: string;
  email: string;
  role: string;
};
