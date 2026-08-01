import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Layout } from "../components/layout/Layout";
import { I18nProvider } from "../i18n/i18n";
import { LoginPage, type AuthUser } from "../pages/auth/LoginPage";
import { somApi } from "../api/somApi";
import { canAccessPage, fallbackPageForRole } from "./pageAccess";
import { getAuthToken, setAuthToken } from "../api/http";
import "../styles/global.css";
import "../styles/pages.css";

const DashboardPage = lazy(() =>
  import("../pages/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const TeacherPortalPage = lazy(() =>
  import("../pages/portal/TeacherPortalPage").then((module) => ({ default: module.TeacherPortalPage }))
);
const HomeroomTeacherPortalPage = lazy(() =>
  import("../pages/portal/HomeroomTeacherPortalPage").then((module) => ({ default: module.HomeroomTeacherPortalPage }))
);
const TeachersPage = lazy(() =>
  import("../pages/teachers/TeachersPage").then((module) => ({ default: module.TeachersPage }))
);
const SchedulesPage = lazy(() =>
  import("../pages/schedules/SchedulesPage").then((module) => ({ default: module.SchedulesPage }))
);
const HomeroomPage = lazy(() =>
  import("../pages/homeroom/HomeroomPage").then((module) => ({ default: module.HomeroomPage }))
);
const DutiesPage = lazy(() => import("../pages/duties/DutiesPage").then((module) => ({ default: module.DutiesPage })));
const DailyPage = lazy(() => import("../pages/daily/DailyPage").then((module) => ({ default: module.DailyPage })));
const ArchivePage = lazy(() =>
  import("../pages/archive/ArchivePage").then((module) => ({ default: module.ArchivePage }))
);
const ReportsPage = lazy(() =>
  import("../pages/reports/ReportsPage").then((module) => ({ default: module.ReportsPage }))
);
const SecurityMonitoringPage = lazy(() =>
  import("../pages/reports/SecurityMonitoringPage").then((module) => ({ default: module.SecurityMonitoringPage }))
);
const OperationsPage = lazy(() =>
  import("../pages/settings/OperationsPage").then((module) => ({ default: module.OperationsPage }))
);
const SettingsPage = lazy(() =>
  import("../pages/settings/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);
const LicensePage = lazy(() =>
  import("../pages/settings/LicensePage").then((module) => ({ default: module.LicensePage }))
);
const StudentPortalPage = lazy(() =>
  import("../pages/portal/StudentPortalPage").then((module) => ({ default: module.StudentPortalPage }))
);
const SchoolNotificationsPage = lazy(() =>
  import("../pages/students/StudentNotificationsPage").then((module) => ({ default: module.SchoolNotificationsPage }))
);
const UsersPage = lazy(() => import("../pages/users/UsersPage").then((module) => ({ default: module.UsersPage })));
const StudentsPage = lazy(() =>
  import("../pages/students/StudentsPage").then((module) => ({ default: module.StudentsPage }))
);
const ClassManagementPage = lazy(() =>
  import("../pages/students/ClassManagementPage").then((module) => ({ default: module.ClassManagementPage }))
);
const StudentAttendancePage = lazy(() =>
  import("../pages/students/StudentAttendancePage").then((module) => ({ default: module.StudentAttendancePage }))
);
const TeacherPermissionsPage = lazy(() =>
  import("../pages/teachers/TeacherPermissionsPage").then((module) => ({ default: module.TeacherPermissionsPage }))
);
const StudentPledgePage = lazy(() =>
  import("../pages/students/StudentPledgePage").then((module) => ({ default: module.StudentPledgePage }))
);
const AcademicLevelPage = lazy(() =>
  import("../pages/students/AcademicLevelPage").then((module) => ({ default: module.AcademicLevelPage }))
);
const BehaviorPerformancePage = lazy(() =>
  import("../pages/students/BehaviorPerformancePage").then((module) => ({ default: module.BehaviorPerformancePage }))
);
const StudentMarksPage = lazy(() =>
  import("../pages/students/StudentMarksPage").then((module) => ({ default: module.StudentMarksPage }))
);
const StudentCertificatesPage = lazy(() =>
  import("../pages/students/StudentCertificatesPage").then((module) => ({ default: module.StudentCertificatesPage }))
);
const LessonTodayPage = lazy(() =>
  import("../pages/lessons/LessonTodayPage").then((module) => ({ default: module.LessonTodayPage }))
);
const HomeworkPreparationPage = lazy(() =>
  import("../pages/lessons/HomeworkPreparationPage").then((module) => ({ default: module.HomeworkPreparationPage }))
);
const ExamSchedulePage = lazy(() =>
  import("../pages/lessons/ExamSchedulePage").then((module) => ({ default: module.ExamSchedulePage }))
);
const TimetablePage = lazy(() =>
  import("../pages/lessons/TimetablePage").then((module) => ({ default: module.TimetablePage }))
);

export type PageKey =
  | "dashboard"
  | "teacherPortal"
  | "homeroomPortal"
  | "studentPortal"
  | "teachers"
  | "students"
  | "studentClasses"
  | "studentAttendance"
  | "teacherPermissions"
  | "studentPledge"
  | "studentAcademicLevel"
  | "studentBehaviorPerformance"
  | "studentMarks"
  | "studentLessonToday"
  | "studentHomeworkPreparation"
  | "studentExams"
  | "studentTimetable"
  | "studentCertificates"
  | "homeroom"
  | "duties"
  | "schedules"
  | "daily"
  | "archive"
  | "reports"
  | "operations"
  | "securityMonitoring"
  | "settings"
  | "schoolNotifications"
  | "users"
  | "license";
export type DailySectionKey =
  "statusInput" | "fullSchedule" | "duties" | "freeTeachers" | "substitutions" | "teacherPrograms" | "events";

function App() {
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
  const [page, setPage] = useState<PageKey>("dashboard");
  const [dailySection, setDailySection] = useState<DailySectionKey>("fullSchedule");
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(getAuthToken()));
  const [homeroomCertificateAccess, setHomeroomCertificateAccess] = useState(false);

  useEffect(() => {
    let active = true;
    if (!getAuthToken()) return;
    somApi.auth
      .me()
      .then((res) => {
        if (active) setUser(res.data.user);
      })
      .catch(() => {
        setAuthToken("");
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      setAuthToken("");
      setUser(null);
    };
    window.addEventListener("som-auth-expired", handler);
    return () => window.removeEventListener("som-auth-expired", handler);
  }, []);

  useEffect(() => {
    let active = true;
    if (!user || user.role !== "TEACHER") {
      setHomeroomCertificateAccess(false);
      return;
    }

    somApi.homeroom
      .list()
      .then((response) => {
        if (!active) return;
        const assignments = response.data || [];
        setHomeroomCertificateAccess(assignments.some((item) => item.teacherId === user.id && item.isActive !== false));
      })
      .catch(() => {
        if (!active) return;
        setHomeroomCertificateAccess(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let timeoutId = window.setTimeout(() => {
      setAuthToken("");
      setUser(null);
      window.dispatchEvent(new CustomEvent("som-auth-expired"));
    }, INACTIVITY_TIMEOUT_MS);

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setAuthToken("");
        setUser(null);
        window.dispatchEvent(new CustomEvent("som-auth-expired"));
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    for (const eventName of events) {
      window.addEventListener(eventName, resetTimer, { passive: true });
    }

    return () => {
      window.clearTimeout(timeoutId);
      for (const eventName of events) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const internalToolPage = page === "operations" || page === "securityMonitoring";
    const allowed =
      (!internalToolPage || import.meta.env.DEV) &&
      (canAccessPage(user.role, page) || (page === "studentCertificates" && homeroomCertificateAccess));
    if (!allowed) setPage(fallbackPageForRole(user.role));
  }, [homeroomCertificateAccess, page, user]);

  useEffect(() => {
    const mainContent = document.getElementById("main-content");
    if (!mainContent) return;
    const frame = window.requestAnimationFrame(() => {
      (mainContent as HTMLElement).focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [page, dailySection, user]);

  const pages: Record<PageKey, React.ReactNode> = {
    dashboard: <DashboardPage />,
    teacherPortal: <TeacherPortalPage currentUser={user!} />,
    homeroomPortal: <HomeroomTeacherPortalPage currentUser={user!} />,
    studentPortal: <StudentPortalPage currentUser={user!} />,
    teachers: <TeachersPage />,
    students: <StudentsPage />,
    studentClasses: <ClassManagementPage />,
    studentAttendance: <StudentAttendancePage currentUser={user!} />,
    teacherPermissions: <TeacherPermissionsPage currentUser={user!} />,
    studentPledge: <StudentPledgePage />,
    studentAcademicLevel: <AcademicLevelPage />,
    studentBehaviorPerformance: <BehaviorPerformancePage currentUser={user!} />,
    studentMarks: <StudentMarksPage currentUser={user!} />,
    studentLessonToday: <LessonTodayPage currentUser={user!} />,
    studentHomeworkPreparation: <HomeworkPreparationPage currentUser={user!} />,
    studentExams: <ExamSchedulePage currentUser={user!} />,
    studentTimetable: <TimetablePage currentUser={user!} />,
    studentCertificates: (
      <StudentCertificatesPage currentUser={user!} canEditCertificates={homeroomCertificateAccess} />
    ),
    homeroom: <HomeroomPage />,
    duties: <DutiesPage currentUser={user!} />,
    schedules: <SchedulesPage currentUser={user!} />,
    daily: (
      <DailyPage
        currentUser={user!}
        initialDate={dailyDate}
        focusSection={dailySection}
        onArchiveComplete={() => setPage("archive")}
      />
    ),
    archive: (
      <ArchivePage
        onEditDay={(date) => {
          setDailyDate(date);
          setPage("daily");
          setDailySection("fullSchedule");
        }}
      />
    ),
    reports: <ReportsPage />,
    operations: <OperationsPage />,
    securityMonitoring: <SecurityMonitoringPage />,
    settings: <SettingsPage />,
    schoolNotifications: <SchoolNotificationsPage />,
    users: <UsersPage />,
    license: <LicensePage />
  };

  function navigate(nextPage: PageKey, nextDailySection?: DailySectionKey) {
    const internalToolPage = nextPage === "operations" || nextPage === "securityMonitoring";
    if (
      !user ||
      ((!internalToolPage || import.meta.env.DEV) &&
        (canAccessPage(user.role, nextPage) || (nextPage === "studentCertificates" && homeroomCertificateAccess)))
    ) {
      setPage(nextPage);
      if (nextPage === "daily" && nextDailySection !== undefined) {
        setDailySection(nextDailySection);
      }
      if (nextPage === "daily") setDailySection(nextDailySection || "fullSchedule");
      if (nextPage !== "daily") setDailySection("fullSchedule");
    }
  }

  function logout() {
    setAuthToken("");
    setUser(null);
    setPage("dashboard");
  }

  if (import.meta.env.DEV) {
    window.__somSetAuthToken = setAuthToken;
    window.__somSetCurrentUser = setUser;
  }

  return (
    <I18nProvider>
      {checkingSession ? (
        <main className="login-screen">
          <div className="login-card">
            <strong>
              {
                "\u062c\u0627\u0631\u064a \u0641\u062d\u0635 \u062c\u0644\u0633\u0629 \u0627\u0644\u062f\u062e\u0648\u0644..."
              }
            </strong>
          </div>
        </main>
      ) : !user ? (
        <LoginPage onLogin={setUser} />
      ) : (
        <Layout
          current={page}
          currentDailySection={dailySection}
          onNavigate={navigate}
          currentUser={user}
          onLogout={logout}
          homeroomCertificateAccess={homeroomCertificateAccess}
        >
          <Suspense
            fallback={
              <main className="login-screen">
                <div className="login-card">
                  <strong>
                    {"\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629..."}
                  </strong>
                </div>
              </main>
            }
          >
            {pages[page]}
          </Suspense>
        </Layout>
      )}
    </I18nProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
