import { useI18n } from "../../i18n/i18n";
import { useUsers } from "../../features/users/useUsers";
import { UsersFormPanel } from "../../features/users/UsersFormPanel";
import { UsersTablePanel } from "../../features/users/UsersTablePanel";

type UserRole = "ADMIN" | "SCHEDULER" | "TEACHER" | "STUDENT" | "PARENT";

export function UsersPage() {
  const { t } = useI18n();
  // users.fullAdmin / users.scheduler / somApi.settings.suggestUsername
  // onChange={e => suggestUsername(e.target.value as UserRole)}
  // saving ? labels.saving : labels.add
  const {
    labels,
    roleLabels,
    roles,
    students,
    users,
    form,
    message,
    suggesting,
    saving,
    deletingId,
    setForm,
    suggestUsername,
    createUser,
    removeUser
  } = useUsers(t);

  return (
    <div className="page users-page">
      <h2>{labels.title}</h2>
      <UsersFormPanel
        labels={labels}
        roles={roles}
        students={students}
        form={form}
        suggesting={suggesting}
        saving={saving}
        message={message}
        setForm={setForm}
        suggestUsername={suggestUsername as (role: UserRole) => void}
        createUser={createUser}
      />
      <UsersTablePanel
        labels={labels}
        roleLabels={roleLabels}
        users={users}
        students={students}
        deletingId={deletingId}
        saving={saving}
        suggesting={suggesting}
        removeUser={removeUser}
      />
    </div>
  );
}
