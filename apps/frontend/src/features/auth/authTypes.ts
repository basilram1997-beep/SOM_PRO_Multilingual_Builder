export type AuthUser = {
  id: string;
  schoolId: string;
  studentId?: string | null;
  studentIds?: string[];
  name: string;
  email: string;
  role: string;
};
