import type { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  userId: string;
  schoolId: string;
  studentId?: string | null;
  name: string;
  email: string;
  role: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
