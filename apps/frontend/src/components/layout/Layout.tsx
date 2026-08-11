import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Award,
  BellRing,
  BookOpen,
  CalendarDays,
  Calculator,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  MapPin,
  Settings,
  ShieldCheck,
  Stethoscope,
  Smile,
  Table2,
  UserCheck,
  UserCog,
  Users
} from "lucide-react";
import type { DailySectionKey, PageKey } from "../../app/main";
import { canAccessPage } from "../../app/pageAccess";
import { LanguageSwitcher, useI18n, type TranslationKey } from "../../i18n/i18n";
import type { AuthUser } from "../../pages/auth/LoginPage";

function playIconSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 620;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (error) {
    console.warn("[layout] icon sound playback failed", error);
  }
}

type SidebarPageItem = {
  key: string;
  page: PageKey;
  labelKey: TranslationKey;
  icon: LucideIcon;
  dailySection?: DailySectionKey;
};

type SidebarGroup = {
  key: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  items: SidebarPageItem[];
  showHeader?: boolean;
};

const mainItems: SidebarPageItem[] = [
  { key: "dashboard", page: "dashboard", labelKey: "nav.dashboard", icon: Home },
  { key: "homeroom-portal", page: "homeroomPortal", labelKey: "nav.homeroomPortal", icon: UserCheck },
  { key: "student-portal", page: "studentPortal", labelKey: "nav.studentPortal", icon: GraduationCap }
];

const teacherViewGroup: SidebarGroup = {
  key: "teacher-view",
  labelKey: "nav.teacherViewGroup",
  icon: BookOpen,
  items: [
    { key: "teacher-portal-schedule", page: "schedules", labelKey: "nav.teacherBaseSchedule", icon: CalendarDays },
    {
      key: "teacher-portal-daily",
      page: "daily",
      labelKey: "nav.teacherDailyProgram",
      icon: ClipboardList,
      dailySection: "fullSchedule"
    },
    { key: "teacher-portal-duties", page: "duties", labelKey: "nav.teacherDutySchedule", icon: MapPin },
    {
      key: "teacher-portal-program",
      page: "daily",
      labelKey: "teacherPortal.visible.teacherProgram",
      icon: UserCheck,
      dailySection: "teacherPrograms"
    }
  ]
};

const teacherWorkGroup: SidebarGroup = {
  key: "teacher-work",
  labelKey: "nav.teacherWorkGroup",
  icon: ClipboardCheck,
  items: [
    { key: "teacher-marks", page: "studentMarks", labelKey: "nav.teacherMarks", icon: Calculator },
    { key: "teacher-behavior", page: "studentBehaviorPerformance", labelKey: "nav.teacherBehavior", icon: Smile },
    { key: "teacher-attendance", page: "studentAttendance", labelKey: "nav.teacherAttendance", icon: CheckSquare },
    { key: "teacher-lesson-today", page: "studentLessonToday", labelKey: "nav.teacherLessonToday", icon: FileText },
    {
      key: "teacher-homework",
      page: "studentHomeworkPreparation",
      labelKey: "nav.teacherHomework",
      icon: ClipboardList
    },
    { key: "teacher-exams", page: "studentExams", labelKey: "nav.teacherExams", icon: ClipboardCheck },
    { key: "teacher-permissions", page: "teacherPermissions", labelKey: "nav.teacherPermissions", icon: BellRing },
    { key: "teacher-pledge", page: "studentPledge", labelKey: "nav.studentPledge", icon: ClipboardCheck },
    { key: "teacher-certificates", page: "studentCertificates", labelKey: "nav.studentCertificates", icon: Award }
  ]
};

const permissionsGroup: SidebarGroup = {
  key: "permissions",
  labelKey: "nav.permissionsGroup",
  icon: BellRing,
  items: [
    { key: "teacher-permissions", page: "teacherPermissions", labelKey: "nav.teacherPermissions", icon: BellRing }
  ]
};

const studentPortalGroup: SidebarGroup = {
  key: "student-portal-group",
  labelKey: "nav.studentPortalGroup",
  icon: GraduationCap,
  showHeader: false,
  items: [
    { key: "student-marks", page: "studentMarks", labelKey: "nav.studentMarks", icon: Calculator },
    { key: "student-lesson-today", page: "studentLessonToday", labelKey: "nav.studentLessonToday", icon: FileText },
    {
      key: "student-homework",
      page: "studentHomeworkPreparation",
      labelKey: "nav.studentHomeworkPreparation",
      icon: ClipboardList
    },
    { key: "student-timetable", page: "studentTimetable", labelKey: "nav.studentTimetable", icon: Table2 },
    { key: "student-exams", page: "studentExams", labelKey: "nav.studentExams", icon: ClipboardCheck }
  ]
};

const programsGroup: SidebarGroup = {
  key: "programs",
  labelKey: "nav.programsGroup",
  icon: CalendarDays,
  items: [
    { key: "teachers", page: "teachers", labelKey: "nav.teachers", icon: Users },
    { key: "program-base", page: "schedules", labelKey: "nav.programBase", icon: CalendarDays },
    {
      key: "program-daily",
      page: "daily",
      labelKey: "nav.programDaily",
      icon: ClipboardList,
      dailySection: "fullSchedule"
    },
    { key: "program-duties", page: "duties", labelKey: "nav.programDuties", icon: MapPin },
    {
      key: "program-free-teachers",
      page: "daily",
      labelKey: "nav.programFreeTeachers",
      icon: Users,
      dailySection: "freeTeachers"
    },
    {
      key: "program-substitutions",
      page: "daily",
      labelKey: "nav.programSubstitutions",
      icon: FileText,
      dailySection: "substitutions"
    },
    {
      key: "program-teacher",
      page: "daily",
      labelKey: "nav.programTeacher",
      icon: UserCheck,
      dailySection: "teacherPrograms"
    },
    { key: "program-homeroom", page: "homeroom", labelKey: "nav.programHomeroom", icon: UserCheck },
    { key: "program-events", page: "daily", labelKey: "nav.programEvents", icon: ClipboardList, dailySection: "events" }
  ]
};

const studentsGroup: SidebarGroup = {
  key: "students-management",
  labelKey: "nav.studentsGroup",
  icon: GraduationCap,
  items: [
    { key: "student-classes", page: "studentClasses", labelKey: "nav.studentClasses", icon: Table2 },
    { key: "student-files", page: "students", labelKey: "nav.studentFiles", icon: Users },
    { key: "student-attendance", page: "studentAttendance", labelKey: "nav.studentAttendance", icon: CheckSquare },
    { key: "student-pledge", page: "studentPledge", labelKey: "nav.studentPledge", icon: ClipboardCheck },
    { key: "student-academic", page: "studentAcademicLevel", labelKey: "nav.studentAcademicLevel", icon: BookOpen },
    {
      key: "student-behavior",
      page: "studentBehaviorPerformance",
      labelKey: "nav.studentBehaviorPerformance",
      icon: Smile
    },
    { key: "student-marks", page: "studentMarks", labelKey: "nav.studentMarks", icon: Calculator },
    { key: "student-lesson-today", page: "studentLessonToday", labelKey: "nav.studentLessonToday", icon: FileText },
    {
      key: "student-homework-preparation",
      page: "studentHomeworkPreparation",
      labelKey: "nav.studentHomeworkPreparation",
      icon: ClipboardList
    },
    { key: "student-exams", page: "studentExams", labelKey: "nav.studentExams", icon: ClipboardCheck },
    { key: "student-timetable", page: "studentTimetable", labelKey: "nav.studentTimetable", icon: Table2 },
    { key: "student-certificates", page: "studentCertificates", labelKey: "nav.studentCertificates", icon: Award }
  ]
};

const settingsGroup: SidebarGroup = {
  key: "school-settings",
  labelKey: "nav.schoolSettingsGroup",
  icon: Settings,
  items: [
    { key: "settings-page", page: "settings", labelKey: "nav.settingsPage", icon: Settings },
    { key: "archive", page: "archive", labelKey: "nav.archive", icon: Archive },
    { key: "reports", page: "reports", labelKey: "nav.reports", icon: FileText },
    { key: "operations", page: "operations", labelKey: "reports.operationsTitle", icon: Table2 },
    { key: "security-monitoring", page: "securityMonitoring", labelKey: "nav.securityMonitoring", icon: ShieldCheck },
    { key: "operator-health", page: "operatorHealth", labelKey: "nav.operatorHealth", icon: Stethoscope },
    { key: "school-notifications", page: "schoolNotifications", labelKey: "nav.schoolNotifications", icon: BellRing },
    { key: "users", page: "users", labelKey: "nav.users", icon: UserCog },
    { key: "license", page: "license", labelKey: "nav.license", icon: ShieldCheck }
  ]
};

function SidebarButton({
  current,
  onNavigate,
  item,
  dailySection,
  translate
}: {
  current: PageKey;
  onNavigate: (p: PageKey, section?: DailySectionKey) => void;
  item: SidebarPageItem;
  dailySection: DailySectionKey;
  translate: (key: TranslationKey) => string;
}) {
  const Icon = item.icon;
  const isActive =
    current === item.page && (item.page !== "daily" || dailySection === item.dailySection || !item.dailySection);
  const className = [
    "sidebar-item",
    item.dailySection ? "sidebar-subitem" : "sidebar-mainitem",
    isActive ? "active" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      key={item.key}
      data-e2e={`nav-${item.key}`}
      className={className}
      aria-current={isActive ? "page" : undefined}
      onClick={() => {
        playIconSound();
        onNavigate(item.page, item.dailySection);
      }}
      type="button"
    >
      <Icon size={18} />
      <span>{translate(item.labelKey)}</span>
    </button>
  );
}

function SidebarGroupSection({
  group,
  expanded,
  onToggle,
  onActivate,
  current,
  onNavigate,
  dailySection,
  translate
}: {
  group: SidebarGroup;
  expanded: boolean;
  onToggle?: () => void;
  onActivate?: () => void;
  current: PageKey;
  onNavigate: (p: PageKey, section?: DailySectionKey) => void;
  dailySection: DailySectionKey;
  translate: (key: TranslationKey) => string;
}) {
  const GroupIcon = group.icon;
  return (
    <section className="sidebar-group" data-e2e={`nav-group-${group.key}`}>
      {group.showHeader !== false ? (
        <button
          className="sidebar-group-header"
          type="button"
          onClick={onToggle || onActivate}
          aria-expanded={expanded}
          disabled={!onToggle && !onActivate}
          data-e2e={`nav-group-toggle-${group.key}`}
        >
          <span className="sidebar-group-title">
            <GroupIcon size={18} />
            <span>{translate(group.labelKey)}</span>
          </span>
          <ChevronDown size={16} className={expanded ? "chevron-open" : ""} />
        </button>
      ) : null}
      {expanded && (
        <div className="sidebar-group-body">
          {group.items.map((item) => (
            <SidebarButton
              key={item.key}
              current={current}
              onNavigate={onNavigate}
              item={item}
              dailySection={dailySection}
              translate={translate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function Layout({
  current,
  currentDailySection,
  onNavigate,
  currentUser,
  homeroomCertificateAccess = false,
  onLogout,
  children
}: {
  current: PageKey;
  currentDailySection: DailySectionKey;
  onNavigate: (p: PageKey, section?: DailySectionKey) => void;
  currentUser: AuthUser;
  homeroomCertificateAccess?: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [systemOnline, setSystemOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [programsExpanded, setProgramsExpanded] = useState(true);
  const [permissionsExpanded, setPermissionsExpanded] = useState(true);
  const [studentsExpanded, setStudentsExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const isTeacherUser = currentUser.role === "TEACHER";
  const isStudentAreaUser = currentUser.role === "STUDENT" || currentUser.role === "PARENT";
  const showInternalTools = import.meta.env.DEV;
  const showOperatorHealth =
    import.meta.env.DEV || String(import.meta.env.VITE_SOM_SHOW_OPERATOR_HEALTH || "").toLowerCase() === "true";
  const visibleMainItems = mainItems.filter(
    (item) => canAccessPage(currentUser.role, item.page) && !(isStudentAreaUser && item.page === "studentPortal")
  );
  const visibleProgramsItems = programsGroup.items.filter((item) => canAccessPage(currentUser.role, item.page));
  const visiblePermissionsItems = permissionsGroup.items.filter((item) => canAccessPage(currentUser.role, item.page));
  const visibleTeacherViewItems = teacherViewGroup.items.filter((item) => canAccessPage(currentUser.role, item.page));
  const visibleTeacherWorkItems = teacherWorkGroup.items.filter(
    (item) =>
      canAccessPage(currentUser.role, item.page) || (item.page === "studentCertificates" && homeroomCertificateAccess)
  );
  const visibleStudentsItems =
    isStudentAreaUser || isTeacherUser
      ? []
      : studentsGroup.items.filter((item) => canAccessPage(currentUser.role, item.page));
  const visibleSettingsItems = settingsGroup.items.filter((item) => {
    if (!canAccessPage(currentUser.role, item.page)) return false;
    if (!showInternalTools && (item.page === "operations" || item.page === "securityMonitoring")) return false;
    if (!showOperatorHealth && item.page === "operatorHealth") return false;
    return true;
  });
  const visibleStudentPortalItems = studentPortalGroup.items.filter((item) =>
    canAccessPage(currentUser.role, item.page)
  );
  const shouldExpandPrograms =
    current === "schedules" || current === "daily" || current === "duties" || current === "homeroom";
  const shouldExpandTeacherPermissions = current === "teacherPermissions";
  const shouldExpandSettings =
    current === "settings" ||
    current === "archive" ||
    current === "reports" ||
    (showInternalTools && (current === "operations" || current === "securityMonitoring")) ||
    (showOperatorHealth && current === "operatorHealth") ||
    current === "schoolNotifications" ||
    current === "users" ||
    current === "license";
  const shouldExpandStudents =
    current === "students" ||
    current === "studentClasses" ||
    current === "studentAttendance" ||
    current === "studentPledge" ||
    current === "studentAcademicLevel" ||
    current === "studentBehaviorPerformance" ||
    current === "studentMarks" ||
    current === "studentLessonToday" ||
    current === "studentHomeworkPreparation" ||
    current === "studentExams" ||
    current === "studentTimetable" ||
    current === "studentCertificates";
  const shouldExpandStudentPortal = isStudentAreaUser;
  const sidebarRoleLabel =
    currentUser.role === "PARENT" || currentUser.role === "STUDENT"
      ? t("users.student")
      : currentUser.role === "TEACHER"
        ? homeroomCertificateAccess
          ? t("users.homeroomTeacher")
          : t("users.teacher")
        : currentUser.role;

  useEffect(() => {
    const handleOnline = () => setSystemOnline(true);
    const handleOffline = () => setSystemOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="shell" data-e2e="app-shell">
      <a className="skip-link" href="#main-content">
        {t("common.skipToContent")}
      </a>
      <LanguageSwitcher />
      <aside className="sidebar" aria-label={t("nav.sidebar")}>
        <h1>
          SOM <span style={{ color: "#f59e0b" }}>PRO</span>
        </h1>
        <p>{t("app.subtitle")}</p>
        <div className="sidebar-user">
          <strong>{currentUser.name}</strong>
          <span>{sidebarRoleLabel}</span>
        </div>
        <div className="shell-connection-status" role="status" aria-live="polite" data-e2e="shell-connection-status">
          <span>{t("login.systemStatus")}</span>
          <strong className={systemOnline ? "shell-status-online" : "shell-status-offline"}>
            {systemOnline ? t("login.systemOnline") : t("login.systemOffline")}
          </strong>
        </div>
        <nav data-e2e="sidebar-nav" aria-label={t("nav.mainNavigation")}>
          {visibleMainItems.map((item) => (
            <SidebarButton
              key={item.key}
              current={current}
              onNavigate={onNavigate}
              item={item}
              dailySection={currentDailySection}
              translate={t}
            />
          ))}

          {isTeacherUser ? (
            <>
              {visibleTeacherViewItems.length > 0 && (
                <div className="sidebar-group" data-e2e="nav-group-teacher-view">
                  <div className="sidebar-group-body">
                    {visibleTeacherViewItems.map((item) => (
                      <SidebarButton
                        key={item.key}
                        current={current}
                        onNavigate={onNavigate}
                        item={item}
                        dailySection={currentDailySection}
                        translate={t}
                      />
                    ))}
                  </div>
                </div>
              )}

              {visibleTeacherWorkItems.length > 0 && (
                <div className="sidebar-group" data-e2e="nav-group-teacher-work">
                  <div className="sidebar-group-body">
                    {visibleTeacherWorkItems.map((item) => (
                      <SidebarButton
                        key={item.key}
                        current={current}
                        onNavigate={onNavigate}
                        item={item}
                        dailySection={currentDailySection}
                        translate={t}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {visibleProgramsItems.length > 0 && (
                <SidebarGroupSection
                  group={{ ...programsGroup, items: visibleProgramsItems }}
                  expanded={programsExpanded || shouldExpandPrograms}
                  onToggle={() => setProgramsExpanded((value) => !value)}
                  current={current}
                  onNavigate={onNavigate}
                  dailySection={currentDailySection}
                  translate={t}
                />
              )}

              {visibleStudentsItems.length > 0 && (
                <SidebarGroupSection
                  group={{ ...studentsGroup, items: visibleStudentsItems }}
                  expanded={studentsExpanded || shouldExpandStudents}
                  onToggle={() => {
                    const opening = !studentsExpanded;
                    setStudentsExpanded(opening);
                    if (opening && visibleStudentsItems.length > 0)
                      onNavigate(visibleStudentsItems[0].page, visibleStudentsItems[0].dailySection);
                  }}
                  current={current}
                  onNavigate={onNavigate}
                  dailySection={currentDailySection}
                  translate={t}
                />
              )}

              {visiblePermissionsItems.length > 0 && (
                <SidebarGroupSection
                  group={{ ...permissionsGroup, items: visiblePermissionsItems }}
                  expanded={permissionsExpanded || shouldExpandTeacherPermissions}
                  onToggle={() => setPermissionsExpanded((value) => !value)}
                  current={current}
                  onNavigate={onNavigate}
                  dailySection={currentDailySection}
                  translate={t}
                />
              )}
            </>
          )}

          {visibleSettingsItems.length > 0 && (
            <SidebarGroupSection
              group={{ ...settingsGroup, items: visibleSettingsItems }}
              expanded={settingsExpanded || shouldExpandSettings}
              onToggle={() => setSettingsExpanded((value) => !value)}
              current={current}
              onNavigate={onNavigate}
              dailySection={currentDailySection}
              translate={t}
            />
          )}

          {isStudentAreaUser && visibleStudentPortalItems.length > 0 && (
            <SidebarGroupSection
              group={{ ...studentPortalGroup, items: visibleStudentPortalItems }}
              expanded={shouldExpandStudentPortal}
              onToggle={() => undefined}
              onActivate={() => onNavigate("studentPortal")}
              current={current}
              onNavigate={onNavigate}
              dailySection={currentDailySection}
              translate={t}
            />
          )}

          <button className="logout-button" onClick={onLogout} type="button">
            <LogOut size={18} />
            <span>{t("common.logout")}</span>
          </button>
        </nav>
      </aside>
      <main className="content" id="main-content" tabIndex={-1} aria-label={t("nav.mainContent")}>
        {children}
      </main>
    </div>
  );
}
