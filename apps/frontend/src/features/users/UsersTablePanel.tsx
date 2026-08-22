import { Card } from "../../components/ui/Card";

type UserRole = "ADMIN" | "SCHEDULER" | "TEACHER" | "STUDENT" | "PARENT";
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole | string;
  studentId?: string | null;
  studentIds?: string[];
};
type StudentOption = { id: string; name: string };

type Props = {
  labels: {
    title: string;
    name: string;
    username: string;
    role: string;
    linkedStudent: string;
    none: string;
    action: string;
    delete: string;
    saving: string;
  };
  roleLabels: Record<UserRole, string>;
  users: UserRow[];
  students: StudentOption[];
  deletingId: string | null;
  saving: boolean;
  suggesting: boolean;
  removeUser: (id: string) => void;
};

export function UsersTablePanel({
  labels,
  roleLabels,
  users,
  students,
  deletingId,
  saving,
  suggesting,
  removeUser
}: Props) {
  const studentNameById = new Map(students.map((student) => [student.id, student.name]));

  return (
    <Card title={labels.title}>
      <div className="table-wrap users-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{labels.name}</th>
              <th>{labels.username}</th>
              <th>{labels.role}</th>
              <th>{labels.linkedStudent}</th>
              <th>{labels.action}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td dir="ltr">{user.email}</td>
                <td>{roleLabels[user.role as UserRole] || user.role}</td>
                <td>
                  {(user.studentIds?.length ? user.studentIds : user.studentId ? [user.studentId] : [])
                    .map((studentId) => studentNameById.get(studentId) || studentId)
                    .join("، ") || labels.none}
                </td>
                <td>
                  <button
                    className="danger"
                    onClick={() => removeUser(user.id)}
                    disabled={deletingId === user.id || saving || suggesting}
                  >
                    {deletingId === user.id ? labels.saving : labels.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
