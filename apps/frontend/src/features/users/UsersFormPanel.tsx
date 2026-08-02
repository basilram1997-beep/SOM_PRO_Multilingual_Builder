import type { Dispatch, SetStateAction } from "react";
import { Card } from "../../components/ui/Card";

type UserRole = "ADMIN" | "SCHEDULER" | "TEACHER" | "STUDENT" | "PARENT";

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  studentId: string;
};

type StudentOption = { id: string; name: string };

type Props = {
  labels: {
    add: string;
    name: string;
    password: string;
    role: string;
    linkedStudent: string;
    selectStudent: string;
    saving: string;
  };
  roles: Array<{ value: UserRole; label: string }>;
  students: StudentOption[];
  form: UserForm;
  suggesting: boolean;
  saving: boolean;
  message: string;
  setForm: Dispatch<SetStateAction<UserForm>>;
  suggestUsername: (role: UserRole) => void;
  createUser: () => void;
};

function needsStudentLink(role: UserRole) {
  return role === "STUDENT" || role === "PARENT";
}

export function UsersFormPanel({
  labels,
  roles,
  students,
  form,
  suggesting,
  saving,
  message,
  setForm,
  suggestUsername,
  createUser
}: Props) {
  return (
    <Card title={labels.add}>
      <div className="users-form-panel users-add-panel">
        <label className="users-field users-name-field">
          {labels.name}
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="users-field users-role-field">
          {labels.role}
          <select
            value={form.role}
            onChange={(e) => {
              const role = e.target.value as UserRole;
              setForm((previous) => ({
                ...previous,
                role,
                studentId: needsStudentLink(role) ? previous.studentId : ""
              }));
              suggestUsername(role);
            }}
          >
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        {needsStudentLink(form.role) && (
          <label className="users-field users-student-field">
            {labels.linkedStudent}
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">{labels.selectStudent}</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="users-field users-password-field">
          {labels.password}
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button type="button" className="users-save-button" onClick={createUser} disabled={saving || suggesting}>
          {saving ? labels.saving : labels.add}
        </button>
      </div>
      {message && <div className="success">{message}</div>}
    </Card>
  );
}
