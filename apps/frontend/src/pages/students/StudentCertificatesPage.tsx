import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Printer, Save } from "lucide-react";
import type { SchoolClass, Student, StudentCertificate, StudentCertificateBehaviorLevel, Subject } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import { Card } from "../../components/ui/Card";
import { localizeClassName, localizeSubjectName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";
import type { SchoolInfo } from "../../features/settings/settingsTypes";
import {
  defaultGradeSections,
  formatGradeSchemeSections,
  type GradeEntry,
  type GradeScheme
} from "../../features/students/gradeEntryTypes";
import { calculateWeightedTotal } from "../../features/students/gradeEntryDraft";
import {
  type CertificateStudentContext,
  certificateResultOptions,
  certificateTypeOptions,
  gradeKeyFromAverage,
  resultFromAverage,
  type CertificateMarkRow,
  type CertificateResult,
  type CertificateType
} from "../../features/students/studentCertificateTypes";
import type { TeacherWithAssignments } from "../../features/teachers/teacherTypes";

type Props = {
  currentUser: AuthUser;
  canEditCertificates?: boolean;
};

type BehaviorLevel = StudentCertificateBehaviorLevel;
type CurriculumType = "PALESTINIAN" | "BAGRUT";

type CertificateReviewItem = {
  studentId: string;
  studentName: string;
  className: string;
  section: string;
  nationalId: string;
  rows: PrintableCertificateRow[];
  average: number | null;
  result: CertificateResult;
  behaviorLevel: BehaviorLevel;
  attendanceSummary: CertificateStudentContext["attendanceSummary"];
  teacherNotes: string;
  teacherSignature: string;
  principalSignature: string;
};

const behaviorOptions: Array<{ value: BehaviorLevel; labelKey: string }> = [
  { value: "EXCELLENT", labelKey: "certificates.behavior.excellent" },
  { value: "VERY_GOOD", labelKey: "certificates.behavior.veryGood" },
  { value: "GOOD", labelKey: "certificates.behavior.good" },
  { value: "NEEDS_ATTENTION", labelKey: "certificates.behavior.needsAttention" }
];

const curriculumOptions: Array<{ value: CurriculumType; labelKey: string }> = [
  { value: "PALESTINIAN", labelKey: "certificates.curriculum.palestinian" },
  { value: "BAGRUT", labelKey: "certificates.curriculum.bagrut" }
];

function normalizedSubjectName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[^\u0600-\u06ffa-z0-9]+/g, " ");
}

function isSubjectAllowedForCurriculum(subjectName: string, curriculumType: CurriculumType) {
  const normalized = normalizedSubjectName(subjectName);
  if (curriculumType === "PALESTINIAN") {
    return !normalized.includes("مدنيات") && !normalized.includes("civics");
  }
  return !normalized.includes("دراسات اجتماعيه") && !normalized.includes("دراسات اجتماعية") && !normalized.includes("social studies");
}

function behaviorLabelKey(value: BehaviorLevel) {
  return behaviorOptions.find((option) => option.value === value)?.labelKey || "certificates.behavior.good";
}

function resultLabelKey(value: CertificateResult) {
  return (
    certificateResultOptions.find((option) => option.value === value)?.labelKey || "certificates.results.incomplete"
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentAcademicYear() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type PrintableCertificateRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  currentMark: string;
  currentAverage: number | null;
  comparisonMark: string;
  comparisonAverage: number | null;
  average: number | null;
  grade: string;
};

function subjectTotalFromEntry(
  entry: GradeEntry | null | undefined,
  scheme: GradeScheme | null | undefined,
  studentId: string
) {
  if (!entry || !scheme) {
    return { mark: "", average: null };
  }

  const studentMarks = entry.rows?.[studentId] || {};
  const hasStudentMarks = Object.values(studentMarks).some((value) => value.trim());
  if (!hasStudentMarks) {
    return { mark: "", average: null };
  }

  const total = calculateWeightedTotal(studentMarks, scheme.sections, scheme.maxScore);
  if (total === null || !scheme.maxScore) {
    return { mark: "", average: null };
  }

  return { mark: String(total), average: Math.round((total / scheme.maxScore) * 1000) / 10 };
}

function combineSubjectAverages(first: number | null, second: number | null) {
  if (first === null && second === null) return null;
  if (first === null) return second;
  if (second === null) return first;
  return Math.round(((first + second) / 2) * 10) / 10;
}

function certificateTypeLabel(t: (key: string) => string, language: string, type: CertificateType) {
  const option = certificateTypeOptions.find((item) => item.value === type) || certificateTypeOptions[0];
  const translated = t(option.labelKey);
  if (translated && translated !== option.labelKey) {
    return translated;
  }

  const fallbackLabels: Record<CertificateType, Record<string, string>> = {
    TERM1_BIMONTHLY: {
      ar: "شهادة الشهرين للفصل الأول",
      he: "תעודת מחצית ראשונה לסמסטר א'",
      en: "First term bi-monthly certificate"
    },
    TERM1_FINAL: {
      ar: "شهادة نهاية الفصل الأول",
      he: "תעודת סיום סמסטר א'",
      en: "First term final certificate"
    },
    TERM2_BIMONTHLY: {
      ar: "شهادة الشهرين للفصل الثاني",
      he: "תעודת מחצית ראשונה לסמסטר ב'",
      en: "Second term bi-monthly certificate"
    },
    TERM2_FINAL: {
      ar: "شهادة نهاية الفصل الثاني",
      he: "תעודת סיום סמסטר ב'",
      en: "Second term final certificate"
    }
  };

  return fallbackLabels[type]?.[language] || fallbackLabels[type]?.en || option.labelKey;
}

export function StudentCertificatesPage({ currentUser, canEditCertificates = false }: Props) {
  const { t, language } = useI18n();
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<TeacherWithAssignments[]>([]);
  const [gradeSchemes, setGradeSchemes] = useState<GradeScheme[]>([]);
  const [savedGradeEntries, setSavedGradeEntries] = useState<GradeEntry[]>([]);
  const [comparisonGradeSchemes, setComparisonGradeSchemes] = useState<GradeScheme[]>([]);
  const [comparisonGradeEntries, setComparisonGradeEntries] = useState<GradeEntry[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [certificateType, setCertificateType] = useState<CertificateType>("TERM1_BIMONTHLY");
  const [curriculumType, setCurriculumType] = useState<CurriculumType>("PALESTINIAN");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [issueDate, setIssueDate] = useState(todayISO());
  const [schoolNumber, setSchoolNumber] = useState("");
  const [presentDays, setPresentDays] = useState("0");
  const [absentDays, setAbsentDays] = useState("0");
  const [lateDays, setLateDays] = useState("0");
  const [earlyExitDays, setEarlyExitDays] = useState("0");
  const [behaviorLevel, setBehaviorLevel] = useState<BehaviorLevel>("GOOD");
  const [teacherNotes, setTeacherNotes] = useState("");
  const [teacherSignature, setTeacherSignature] = useState("");
  const [principalSignature, setPrincipalSignature] = useState("");
  const [result, setResult] = useState<CertificateResult>("PASS");
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [certificateId, setCertificateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [certificateStatus, setCertificateStatus] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [certificateContext, setCertificateContext] = useState<CertificateStudentContext | null>(null);
  const [legacySubjectRows, setLegacySubjectRows] = useState<CertificateMarkRow[]>([]);
  const [showClassReview, setShowClassReview] = useState(false);
  const [classReviewLoading] = useState(false);
  const [classReviewError, setClassReviewError] = useState("");
  const [classCertificateReview, setClassCertificateReview] = useState<CertificateReviewItem[]>([]);
  const isHydratingRef = useRef(false);
  const lastSavedSnapshotRef = useRef("");
  const saveTimeoutRef = useRef<number | null>(null);
  const behaviorLevelTouchedRef = useRef(false);
  const resultTouchedRef = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([somApi.settings.get(), somApi.classes.list(), somApi.subjects.list(), somApi.teachers.list()])
      .then(([settingsResponse, classesResponse, subjectsResponse, teachersResponse]) => {
        if (!active) return;
        setSchoolInfo(settingsResponse.data.school);
        setClasses(sortSchoolClasses((classesResponse.data || []) as SchoolClass[]));
        setSubjects(subjectsResponse.data || []);
        setTeachers((teachersResponse.data || []) as TeacherWithAssignments[]);
        setSelectedClassId((previous) => previous || classesResponse.data?.[0]?.id || "");
      })
      .catch(() => {
        if (!active) return;
        setPageMessage(t("certificates.loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSelectedStudentId("");
      setSelectedStudentIds([]);
      return;
    }

    let active = true;
    somApi.students
      .list(selectedClassId)
      .then((response) => {
        if (!active) return;
        const nextStudents = response.data || [];
        setStudents(nextStudents);
        setSelectedStudentId((previous) =>
          previous && nextStudents.some((item) => item.id === previous) ? previous : nextStudents[0]?.id || ""
        );
        setSelectedStudentIds((previous) => {
          const valid = previous.filter((id) => nextStudents.some((item) => item.id === id));
          if (valid.length > 0) return valid;
          return nextStudents[0]?.id ? [nextStudents[0].id] : [];
        });
      })
      .catch(() => {
        if (!active) return;
        setPageMessage(t("certificates.loadFailed"));
      });

    return () => {
      active = false;
    };
  }, [selectedClassId, t]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const selectedStudent = useMemo(
    () => students.find((item) => item.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  const selectedClassStudents = useMemo(
    () => students.filter((item) => Boolean(item.id) && selectedStudentIds.includes(item.id || "")),
    [students, selectedStudentIds]
  );

  const certificateSubjects = useMemo(() => {
    const assignedSubjectIds = new Set<string>();
    for (const teacher of teachers) {
      for (const assignment of teacher.assignments || []) {
        if (assignment.classId === selectedClassId && assignment.subjectId) {
          assignedSubjectIds.add(assignment.subjectId);
        }
      }
    }

    const classSubjects = assignedSubjectIds.size > 0 ? subjects.filter((subject) => subject.id && assignedSubjectIds.has(subject.id)) : subjects;
    return classSubjects.filter((subject) =>
      isSubjectAllowedForCurriculum(localizeSubjectName(subject.name || "", language), curriculumType)
    );
  }, [curriculumType, language, selectedClassId, subjects, teachers]);

  useEffect(() => {
    if (selectedStudent?.nationalId) {
      setSchoolNumber(selectedStudent.nationalId ?? "");
    } else if (!selectedStudent) {
      setSchoolNumber("");
    }
  }, [selectedStudent?.id]);

  useEffect(() => {
    if (!principalSignature && schoolInfo?.managerName) {
      setPrincipalSignature(schoolInfo.managerName);
    }
  }, [principalSignature, schoolInfo?.managerName]);

  useEffect(() => {
    setPublished(false);
    setSaved(false);
    setShowPreview(false);
    setShowClassReview(false);
    setClassCertificateReview([]);
    setClassReviewError("");
  }, [selectedStudentId, selectedClassId, certificateType]);

  const certificateRows = useMemo(() => {
    const entryBySubject = new Map(savedGradeEntries.map((entry) => [entry.subjectId, entry]));
    const rows = gradeSchemes.map((scheme) => {
      const entry = entryBySubject.get(scheme.subjectId);
      const studentMarks = entry?.rows?.[selectedStudentId] || {};
      const hasStudentMarks = Object.values(studentMarks).some((value) => value.trim());
      const total = hasStudentMarks ? calculateWeightedTotal(studentMarks, scheme.sections, scheme.maxScore) : null;
      const normalizedAverage =
        total === null || !scheme.maxScore ? null : Math.round((total / scheme.maxScore) * 1000) / 10;
      return {
        id: scheme.id || `${scheme.classId}-${scheme.subjectId}-${scheme.certificateType}`,
        subjectId: scheme.subjectId,
        subjectName:
          scheme.title?.trim() ||
          localizeSubjectName(subjects.find((item) => item.id === scheme.subjectId)?.name || "", language) ||
          t("certificates.subjectPlaceholder"),
        mark: total === null ? "" : String(total),
        maxScore: scheme.maxScore || 0,
        grade: normalizedAverage === null ? "" : gradeKeyFromAverage(normalizedAverage),
        note: formatGradeSchemeSections(
          scheme.sections.length > 0
            ? scheme.sections
            : defaultGradeSections(scheme.certificateType, language as "ar" | "en" | "he")
        )
      };
    });

    if (rows.length === 0) {
      return legacySubjectRows.filter((row) => row.subjectId || row.subjectName || row.mark || row.note);
    }

    const hasSelectedStudentMarks = savedGradeEntries.some((entry) => {
      const marks = entry.rows?.[selectedStudentId];
      return Boolean(marks) && Object.values(marks).some((value) => value.trim());
    });

    if (hasSelectedStudentMarks) {
      return rows.filter((row) => row.subjectId || row.subjectName || row.mark || row.note);
    }

    return legacySubjectRows.length > 0
      ? legacySubjectRows.filter((row) => row.subjectId || row.subjectName || row.mark || row.note)
      : rows.filter((row) => row.subjectId || row.subjectName || row.mark || row.note);
  }, [savedGradeEntries, gradeSchemes, language, legacySubjectRows, selectedStudentId, subjects, t]);

  function buildPrintableRowsForStudent(studentId: string) {
    const currentEntryBySubject = new Map(savedGradeEntries.map((entry) => [entry.subjectId, entry]));
    const comparisonEntryBySubject = new Map(comparisonGradeEntries.map((entry) => [entry.subjectId, entry]));
    const comparisonSchemeBySubject = new Map(comparisonGradeSchemes.map((scheme) => [scheme.subjectId, scheme]));
    const isSecondTermFinal = certificateType === "TERM2_FINAL";

    const baseRows = gradeSchemes.map((scheme) => {
      const currentEntry = currentEntryBySubject.get(scheme.subjectId) || null;
      const currentScore = subjectTotalFromEntry(currentEntry, scheme, studentId);

      if (!isSecondTermFinal) {
        const averageValue = currentScore.average;
        return {
          id: scheme.id || `${scheme.classId}-${scheme.subjectId}-${scheme.certificateType}`,
          subjectId: scheme.subjectId,
          subjectName:
            scheme.title?.trim() ||
            localizeSubjectName(subjects.find((item) => item.id === scheme.subjectId)?.name || "", language) ||
            t("certificates.subjectPlaceholder"),
          currentMark: currentScore.mark,
          currentAverage: averageValue,
          comparisonMark: "",
          comparisonAverage: null,
          average: averageValue,
          grade: averageValue === null ? "" : gradeKeyFromAverage(averageValue)
        };
      }

      const comparisonScheme = comparisonSchemeBySubject.get(scheme.subjectId) || null;
      const comparisonEntry = comparisonEntryBySubject.get(scheme.subjectId) || null;
      const comparisonScore = subjectTotalFromEntry(comparisonEntry, comparisonScheme, studentId);
      const averageValue = combineSubjectAverages(comparisonScore.average, currentScore.average);

      return {
        id: scheme.id || `${scheme.classId}-${scheme.subjectId}-${scheme.certificateType}`,
        subjectId: scheme.subjectId,
        subjectName:
          scheme.title?.trim() ||
          localizeSubjectName(subjects.find((item) => item.id === scheme.subjectId)?.name || "", language) ||
          t("certificates.subjectPlaceholder"),
        currentMark: currentScore.mark,
        currentAverage: currentScore.average,
        comparisonMark: comparisonScore.mark,
        comparisonAverage: comparisonScore.average,
        average: averageValue,
        grade: averageValue === null ? "" : gradeKeyFromAverage(averageValue)
      };
    });

    if (baseRows.length === 0) {
      return [];
    }

    return baseRows;
  }

  const certificatePrintableRows = useMemo<PrintableCertificateRow[]>(() => {
    return buildPrintableRowsForStudent(selectedStudentId);
  }, [
    certificateType,
    comparisonGradeEntries,
    comparisonGradeSchemes,
    gradeSchemes,
    language,
    savedGradeEntries,
    selectedStudentId,
    subjects,
    t
  ]);

  const average = useMemo(() => {
    const marks = certificatePrintableRows
      .map((row) => row.average)
      .filter((mark): mark is number => typeof mark === "number" && Number.isFinite(mark));
    if (marks.length === 0) return null;
    return Math.round((marks.reduce((sum, mark) => sum + mark, 0) / marks.length) * 10) / 10;
  }, [certificatePrintableRows]);

  const gradeKey = useMemo(() => gradeKeyFromAverage(average), [average]);
  const suggestedBehaviorLevel = useMemo(
    () => certificateContext?.behaviorSummary.suggestedLevel || "GOOD",
    [certificateContext]
  );
  const suggestedResult = useMemo(() => resultFromAverage(average), [average]);

  const schoolName = schoolInfo?.name?.trim() || t("certificates.schoolNameFallback");
  const readOnly = currentUser.role === "TEACHER" && !canEditCertificates;
  const selectedClassName = selectedClass ? localizeClassName(selectedClass.name, language) : t("common.none");
  const selectedClassSection = selectedClass?.section?.trim() || t("common.none");
  const selectedStudentName = selectedStudent?.name?.trim() || t("common.none");
  useEffect(() => {
    if (!selectedClassId) {
      setGradeSchemes([]);
      setComparisonGradeSchemes([]);
      return;
    }

    let active = true;
    const relevantTypes: CertificateType[] =
      certificateType === "TERM2_FINAL" ? ["TERM1_FINAL", "TERM2_FINAL"] : [certificateType];

    Promise.all(
      relevantTypes.map((type) =>
        Promise.allSettled(
          certificateSubjects
            .filter((subject) => Boolean(subject.id))
            .map((subject) => somApi.students.gradeSchemes.get(selectedClassId, subject.id as string, type))
        ).then((results) => ({
          type,
          schemes: results
            .map((result) => (result.status === "fulfilled" ? result.value.data : null))
            .filter((scheme): scheme is GradeScheme => Boolean(scheme))
        }))
      )
    )
      .then((results) => {
        if (!active) return;
        const nextCurrent = results.find((item) => item.type === certificateType)?.schemes || [];
        const nextComparison =
          certificateType === "TERM2_FINAL" ? results.find((item) => item.type === "TERM1_FINAL")?.schemes || [] : [];
        setGradeSchemes(nextCurrent);
        setComparisonGradeSchemes(nextComparison);
      })
      .catch(() => {
        if (!active) return;
        setGradeSchemes([]);
        setComparisonGradeSchemes([]);
      });

    return () => {
      active = false;
    };
  }, [selectedClassId, certificateType, certificateSubjects]);

  useEffect(() => {
    if (!selectedClassId) {
      setSavedGradeEntries([]);
      setComparisonGradeEntries([]);
      return;
    }

    let active = true;
    const relevantTypes: CertificateType[] =
      certificateType === "TERM2_FINAL" ? ["TERM1_FINAL", "TERM2_FINAL"] : [certificateType];

    Promise.all(
      relevantTypes.map((type) =>
        Promise.allSettled(
          certificateSubjects
            .filter((subject) => Boolean(subject.id))
            .map((subject) => somApi.students.gradeEntries.get(selectedClassId, subject.id as string, type))
        ).then((results) => ({
          type,
          entries: results
            .map((result) => (result.status === "fulfilled" ? result.value.data : null))
            .filter((entry): entry is GradeEntry => Boolean(entry))
        }))
      )
    )
      .then((results) => {
        if (!active) return;
        const nextCurrent = results.find((item) => item.type === certificateType)?.entries || [];
        const nextComparison =
          certificateType === "TERM2_FINAL" ? results.find((item) => item.type === "TERM1_FINAL")?.entries || [] : [];
        setSavedGradeEntries(nextCurrent);
        setComparisonGradeEntries(nextComparison);
      })
      .catch(() => {
        if (!active) return;
        setSavedGradeEntries([]);
        setComparisonGradeEntries([]);
        setPageMessage(t("certificates.loadFailed"));
      });

    return () => {
      active = false;
    };
  }, [selectedClassId, certificateType, certificateSubjects]);

  function certificateStateSnapshot(record: {
    studentId: string;
    certificateType: string;
    academicYear: string;
    issueDate: string;
    schoolNumber?: string | null | undefined;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    earlyExitDays: number;
    behaviorLevel: BehaviorLevel;
    teacherNotes?: string | null | undefined;
    teacherSignature?: string | null | undefined;
    principalSignature?: string | null | undefined;
    average?: number | null | undefined;
    grade?: string | null | undefined;
    result: CertificateResult;
    saved: boolean;
    published: boolean;
    subjectRows: StudentCertificate["subjectRows"];
  }) {
    return JSON.stringify({
      studentId: record.studentId,
      certificateType: record.certificateType,
      academicYear: record.academicYear,
      issueDate: record.issueDate,
      schoolNumber: record.schoolNumber || "",
      presentDays: record.presentDays,
      absentDays: record.absentDays,
      lateDays: record.lateDays,
      behaviorLevel: record.behaviorLevel,
      teacherNotes: record.teacherNotes || "",
      teacherSignature: record.teacherSignature || "",
      principalSignature: record.principalSignature || "",
      average: record.average ?? null,
      grade: record.grade || "",
      result: record.result,
      saved: record.saved,
      published: record.published,
      subjectRows: record.subjectRows
        .map((row) => ({
          id: row.id,
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          mark: row.mark,
          maxScore: row.maxScore,
          grade: row.grade,
          note: row.note
        }))
        .filter((row) => row.subjectId || row.subjectName || row.mark || row.grade || row.note)
    });
  }

  function buildCertificateRecord(
    overrides: Partial<
      Pick<
        StudentCertificate,
        | "saved"
        | "published"
        | "result"
        | "behaviorLevel"
        | "teacherSignature"
        | "principalSignature"
        | "teacherNotes"
        | "schoolNumber"
      >
    > = {}
  ): StudentCertificate {
    return {
      id: certificateId || undefined,
      studentId: selectedStudentId,
      certificateType,
      academicYear,
      issueDate,
      schoolNumber: (overrides.schoolNumber ?? schoolNumber).trim() || selectedStudent?.nationalId || null,
      presentDays: Number.parseInt(presentDays, 10) || 0,
      absentDays: Number.parseInt(absentDays, 10) || 0,
      lateDays: Number.parseInt(lateDays, 10) || 0,
      earlyExitDays: Number.parseInt(earlyExitDays, 10) || 0,
      behaviorLevel: overrides.behaviorLevel ?? behaviorLevel,
      teacherNotes: (overrides.teacherNotes ?? teacherNotes).trim() || null,
      teacherSignature: (overrides.teacherSignature ?? teacherSignature).trim() || null,
      principalSignature:
        (overrides.principalSignature ?? principalSignature ?? schoolInfo?.managerName ?? "").trim() || null,
      average,
      grade: gradeKey,
      result: overrides.result ?? result,
      saved: overrides.saved ?? saved,
      published: overrides.published ?? published,
      subjectRows: certificateRows
        .map((row) => ({
          id: row.id,
          subjectId: row.subjectId.trim(),
          subjectName: row.subjectName.trim(),
          mark: row.mark.trim(),
          maxScore: Number((row as { maxScore?: number }).maxScore) || 0,
          grade: row.grade.trim(),
          note: row.note.trim()
        }))
        .filter((row) => row.subjectId || row.subjectName || row.mark || row.grade || row.note)
    };
  }

  function hydrateCertificate(record: StudentCertificate | null, context: CertificateStudentContext | null = null) {
    isHydratingRef.current = true;
    behaviorLevelTouchedRef.current = false;
    resultTouchedRef.current = false;
    if (!record) {
      setCertificateId("");
      setSchoolNumber(selectedStudent?.nationalId || "");
      setPresentDays(String(context?.attendanceSummary.presentDays ?? 0));
      setAbsentDays(String(context?.attendanceSummary.absentDays ?? 0));
      setLateDays(String(context?.attendanceSummary.lateDays ?? 0));
      setEarlyExitDays(String(context?.attendanceSummary.earlyExitDays ?? 0));
      setBehaviorLevel(context?.behaviorSummary.suggestedLevel || "GOOD");
      setTeacherNotes(context?.behaviorSummary.noteSuggestions[1] || "");
      setTeacherSignature("");
      setPrincipalSignature(schoolInfo?.managerName || "");
      setResult(resultFromAverage(average));
      setSaved(false);
      setPublished(false);
      setLegacySubjectRows([]);
      setCertificateStatus("");
      lastSavedSnapshotRef.current = certificateStateSnapshot({
        studentId: selectedStudentId,
        certificateType,
        academicYear,
        issueDate,
        schoolNumber: selectedStudent?.nationalId || "",
        presentDays: context?.attendanceSummary.presentDays ?? 0,
        absentDays: context?.attendanceSummary.absentDays ?? 0,
        lateDays: context?.attendanceSummary.lateDays ?? 0,
        earlyExitDays: context?.attendanceSummary.earlyExitDays ?? 0,
        behaviorLevel: context?.behaviorSummary.suggestedLevel || "GOOD",
        teacherNotes: context?.behaviorSummary.noteSuggestions[0] || "",
        teacherSignature: "",
        principalSignature: schoolInfo?.managerName || "",
        average: null,
        grade: "",
        result: resultFromAverage(average),
        saved: false,
        published: false,
        subjectRows: []
      });
      isHydratingRef.current = false;
      return;
    }

    setCertificateId(record.id || "");
    setSchoolNumber(record.schoolNumber || selectedStudent?.nationalId || "");
    setPresentDays(String(record.presentDays ?? 0));
    setAbsentDays(String(record.absentDays ?? 0));
    setLateDays(String(record.lateDays ?? 0));
    setEarlyExitDays(String(record.earlyExitDays ?? 0));
    setBehaviorLevel(record.behaviorLevel || "GOOD");
    setTeacherNotes(record.teacherNotes || "");
    setTeacherSignature(record.teacherSignature || "");
    setPrincipalSignature(record.principalSignature || schoolInfo?.managerName || "");
    setResult(record.result || "PASS");
    setSaved(Boolean(record.saved));
    setPublished(Boolean(record.published));
    setLegacySubjectRows(
      (record.subjectRows as CertificateMarkRow[] | undefined)?.length
        ? (record.subjectRows as CertificateMarkRow[]).map((row) => ({
            id:
              row.id || row.subjectId || row.subjectName || `${row.subjectName || "subject"}-${row.subjectId || "row"}`,
            subjectId: row.subjectId || "",
            subjectName: row.subjectName || "",
            mark: row.mark || "",
            maxScore: row.maxScore || 0,
            grade: row.grade || "",
            note: row.note || ""
          }))
        : []
    );
    setCertificateStatus(t("certificates.saved"));
    lastSavedSnapshotRef.current = certificateStateSnapshot({
      studentId: record.studentId,
      certificateType: record.certificateType,
      academicYear: record.academicYear,
      issueDate: record.issueDate,
      schoolNumber: record.schoolNumber || selectedStudent?.nationalId || "",
      presentDays: record.presentDays ?? 0,
      absentDays: record.absentDays ?? 0,
      lateDays: record.lateDays ?? 0,
      earlyExitDays: record.earlyExitDays ?? 0,
      behaviorLevel: record.behaviorLevel || "GOOD",
      teacherNotes: record.teacherNotes || "",
      teacherSignature: record.teacherSignature || "",
      principalSignature: record.principalSignature || schoolInfo?.managerName || "",
      average: record.average ?? null,
      grade: record.grade || "",
      result: record.result || "PASS",
      saved: Boolean(record.saved),
      published: Boolean(record.published),
      subjectRows: (record.subjectRows as CertificateMarkRow[] | undefined) || []
    });
    isHydratingRef.current = false;
  }

  function hasMeaningfulCertificateContent() {
    const defaultSchoolNumber = selectedStudent?.nationalId?.trim() || "";
    const currentSchoolNumber = schoolNumber.trim();
    const defaultPrincipalSignature = schoolInfo?.managerName?.trim() || "";
    const currentPrincipalSignature = principalSignature.trim();

    return Boolean(
      certificateRows.length ||
      (currentSchoolNumber && currentSchoolNumber !== defaultSchoolNumber) ||
      Number.parseInt(presentDays, 10) > 0 ||
      Number.parseInt(absentDays, 10) > 0 ||
      Number.parseInt(lateDays, 10) > 0 ||
      Number.parseInt(earlyExitDays, 10) > 0 ||
      behaviorLevel !== "GOOD" ||
      teacherNotes.trim() ||
      teacherSignature.trim() ||
      (currentPrincipalSignature && currentPrincipalSignature !== defaultPrincipalSignature) ||
      result !== "PASS" ||
      saved ||
      published
    );
  }

  async function saveCertificate(
    nextFlags: Partial<Pick<StudentCertificate, "saved" | "published" | "result">> = {},
    quiet = false,
    force = false
  ) {
    if (!selectedStudentId || !selectedClassId) {
      setPageMessage(t("certificates.selectStudentFirst"));
      return false;
    }

    const payload = buildCertificateRecord({
      saved: nextFlags.saved ?? saved,
      published: nextFlags.published ?? published,
      result: nextFlags.result ?? result
    });

    if (!force && !certificateId && !hasMeaningfulCertificateContent()) {
      return false;
    }

    setSaving(true);
    try {
      const response = await somApi.students.certificate.save(payload);
      const savedCertificate = response.data;
      hydrateCertificate(savedCertificate);
      lastSavedSnapshotRef.current = certificateStateSnapshot({
        studentId: savedCertificate.studentId,
        certificateType: savedCertificate.certificateType,
        academicYear: savedCertificate.academicYear,
        issueDate: savedCertificate.issueDate,
        schoolNumber: savedCertificate.schoolNumber || selectedStudent?.nationalId || "",
        presentDays: savedCertificate.presentDays ?? 0,
        absentDays: savedCertificate.absentDays ?? 0,
        lateDays: savedCertificate.lateDays ?? 0,
        earlyExitDays: savedCertificate.earlyExitDays ?? 0,
        behaviorLevel: savedCertificate.behaviorLevel || "GOOD",
        teacherNotes: savedCertificate.teacherNotes || "",
        teacherSignature: savedCertificate.teacherSignature || "",
        principalSignature: savedCertificate.principalSignature || schoolInfo?.managerName || "",
        average: savedCertificate.average ?? null,
        grade: savedCertificate.grade || "",
        result: savedCertificate.result || "PASS",
        saved: Boolean(savedCertificate.saved),
        published: Boolean(savedCertificate.published),
        subjectRows: (savedCertificate.subjectRows as CertificateMarkRow[] | undefined) || []
      });
      setCertificateStatus(t("certificates.saved"));
      if (!quiet) setPageMessage(t("certificates.saved"));
      return true;
    } catch {
      setPageMessage(t("certificates.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!selectedStudentId) {
      setCertificateContext(null);
      hydrateCertificate(null, null);
      return;
    }

    let active = true;
    isHydratingRef.current = true;
    setPageMessage("");
    setCertificateStatus(t("common.loading"));
    Promise.allSettled([
      somApi.students.certificate.get(selectedStudentId, certificateType, academicYear),
      somApi.students.certificate.context(selectedStudentId)
    ])
      .then(([certificateResult, contextResult]) => {
        if (!active) return;
        const certificate = certificateResult.status === "fulfilled" ? certificateResult.value.data : null;
        const context = contextResult.status === "fulfilled" ? contextResult.value.data : null;
        setCertificateContext(context);
        if (certificateResult.status === "rejected") {
          setPageMessage(t("certificates.loadFailed"));
        }
        hydrateCertificate(certificate, context);
      })
      .catch(() => {
        if (!active) return;
        setPageMessage(t("certificates.loadFailed"));
        setCertificateContext(null);
        hydrateCertificate(null, null);
      });

    return () => {
      active = false;
    };
  }, [selectedStudentId, certificateType, academicYear]);

  useEffect(() => {
    if (!selectedStudentId || isHydratingRef.current) return;
    if (!hasMeaningfulCertificateContent() && !certificateId) return;

    const snapshot = certificateStateSnapshot(
      buildCertificateRecord({
        saved,
        published,
        result
      })
    );

    if (snapshot === lastSavedSnapshotRef.current) return;
    if (saveTimeoutRef.current !== null) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      void saveCertificate({}, true);
    }, 800);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    selectedStudentId,
    certificateType,
    academicYear,
    issueDate,
    schoolNumber,
    presentDays,
    absentDays,
    lateDays,
    behaviorLevel,
    teacherNotes,
    teacherSignature,
    principalSignature,
    result,
    saved,
    published,
    average,
    gradeKey,
    certificateRows
  ]);

  useEffect(() => {
    if (isHydratingRef.current || certificateId || !selectedStudentId) return;
    if (behaviorLevelTouchedRef.current) return;
    setBehaviorLevel(suggestedBehaviorLevel);
  }, [certificateId, selectedStudentId, suggestedBehaviorLevel]);

  useEffect(() => {
    if (isHydratingRef.current || certificateId || !selectedStudentId) return;
    if (resultTouchedRef.current) return;
    setResult(suggestedResult);
  }, [certificateId, selectedStudentId, suggestedResult]);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    },
    []
  );

  async function handleSaveSelectedCertificate() {
    if (!selectedStudent) {
      setPageMessage(t("certificates.selectStudentFirst"));
      return;
    }
    const saved = await saveCertificate({}, false, true);
    if (saved) {
      setPageMessage(t("certificates.saved"));
    }
  }

  function buildPrintableBody() {
    const translateWithFallback = (key: string, fallback: Record<string, string>) => {
      const translated = t(key);
      if (translated && translated !== key) return translated;
      return fallback[language] || fallback.en || key;
    };

    const typeLabel = certificateTypeLabel(t, language, certificateType);
    const curriculumLabel = t(
      curriculumOptions.find((option) => option.value === curriculumType)?.labelKey ||
        "certificates.curriculum.palestinian"
    );
    const verbalEvaluationLabel = translateWithFallback("certificates.verbalEvaluation", {
      ar: "التقييم",
      he: "הערכה",
      en: "Evaluation"
    });
    const noSubjectsLabel = translateWithFallback("certificates.noSubjects", {
      ar: "لا توجد مواد بعد",
      he: "אין מקצועות עדיין",
      en: "No subjects yet"
    });
    const noNotesLabel = translateWithFallback("certificates.noTeacherNotes", {
      ar: "لا توجد ملاحظات",
      he: "אין הערות",
      en: "No notes"
    });
    const presentDaysLabel = translateWithFallback("certificates.presentDays", {
      ar: "أيام الحضور",
      he: "ימי נוכחות",
      en: "Present days"
    });
    const lateDaysLabel = translateWithFallback("certificates.lateDays", {
      ar: "أيام التأخر",
      he: "ימי איחור",
      en: "Late days"
    });
    const absentDaysLabel = translateWithFallback("certificates.absentDays", {
      ar: "أيام الغياب",
      he: "ימי היעדרות",
      en: "Absent days"
    });
    const earlyExitDaysLabel = translateWithFallback("certificates.earlyExitDays", {
      ar: "أيام المغادرة المبكرة",
      he: "ימי יציאה מוקדמת",
      en: "Early exit days"
    });
    const rows = certificatePrintableRows
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(row.subjectName || subjects.find((item) => item.id === row.subjectId)?.name || t("certificates.subjectPlaceholder"))}</td>
          <td>${escapeHtml(row.currentMark || row.comparisonMark || "-")}</td>
          <td>${escapeHtml(t(row.grade || gradeKey))}</td>
        </tr>
      `
      )
      .join("");

    const attendanceTotal = certificateContext?.attendanceSummary.totalDays ?? 0;
    const parsedEarlyExitDays = Number.parseInt(earlyExitDays, 10);
    const inferredLeaveDays = Math.max(
      attendanceTotal -
        Number.parseInt(presentDays, 10) -
        Number.parseInt(absentDays, 10) -
        Number.parseInt(lateDays, 10) -
        (Number.isFinite(parsedEarlyExitDays) ? parsedEarlyExitDays : 0),
      0
    );
    const displayedEarlyExitDays = Number.isFinite(parsedEarlyExitDays) ? parsedEarlyExitDays : inferredLeaveDays;
    const averageText = average === null ? "-" : average.toFixed(1);
    const finalResultText = t(resultLabelKey(result));
    const behaviorText = t(behaviorLabelKey(behaviorLevel));

    return `
      <section class="certificate-print-sheet" dir="${language === "en" ? "ltr" : "rtl"}">
        <header class="certificate-print-header">
          <div class="certificate-ministry-text">
            <strong>${escapeHtml(t("certificates.schoolLabel"))}</strong>
            <span>${escapeHtml(schoolInfo?.institutionCode || "")}</span>
          </div>
          <div class="certificate-school-brand">
            <div class="certificate-school-emblem" aria-hidden="true">SOM</div>
            <h1>${escapeHtml(schoolName)}</h1>
            <p>${escapeHtml(schoolInfo?.address || "")}</p>
          </div>
          <div class="certificate-ministry-text certificate-ministry-text--left">
            <strong>${escapeHtml(t("certificates.issueDate"))}</strong>
            <span>${escapeHtml(issueDate)}</span>
          </div>
        </header>

        <div class="certificate-title-ribbon">${escapeHtml(typeLabel)}</div>

        <section class="certificate-student-data">
          <div class="certificate-avatar" aria-hidden="true"></div>
          <div class="certificate-data-grid">
            <div><span>${escapeHtml(t("certificates.studentName"))}</span><strong>${escapeHtml(selectedStudentName)}</strong></div>
            <div><span>${escapeHtml(t("students.nationalId"))}</span><strong>${escapeHtml(selectedStudent?.nationalId || "-")}</strong></div>
            <div><span>${escapeHtml(t("common.class"))}</span><strong>${escapeHtml(selectedClassName)}</strong></div>
            <div><span>${escapeHtml(t("certificates.sectionLabel"))}</span><strong>${escapeHtml(selectedClassSection)}</strong></div>
            <div><span>${escapeHtml(t("certificates.curriculumType"))}</span><strong>${escapeHtml(curriculumLabel)}</strong></div>
            <div><span>${escapeHtml(t("certificates.academicYear"))}</span><strong>${escapeHtml(academicYear)}</strong></div>
          </div>
        </section>

        <table class="certificate-print-table">
          <thead>
            <tr>
              <th>${escapeHtml(t("common.subject"))}</th>
              <th>${escapeHtml(t("certificates.mark"))}</th>
              <th>${escapeHtml(verbalEvaluationLabel)}</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="3">${escapeHtml(noSubjectsLabel)}</td></tr>`}</tbody>
        </table>

        <section class="certificate-result-panel">
          <div>
            <span>${escapeHtml(t("certificates.average"))}</span>
            <strong>${escapeHtml(averageText)}</strong>
          </div>
          <div>
            <span>${escapeHtml(t("certificates.result"))}</span>
            <strong class="${result === "INCOMPLETE" || result === "REVIEW" ? "is-review" : "is-pass"}">${escapeHtml(finalResultText)}</strong>
          </div>
        </section>

        <h3 class="certificate-section-ribbon">${escapeHtml(t("certificates.attendanceTitle"))}</h3>
        <table class="certificate-print-attendance">
          <thead>
            <tr>
              <th>${escapeHtml(presentDaysLabel)}</th>
              <th>${escapeHtml(absentDaysLabel)}</th>
              <th>${escapeHtml(lateDaysLabel)}</th>
              <th>${escapeHtml(earlyExitDaysLabel)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(String(Number.parseInt(presentDays, 10) || 0))}</td>
              <td>${escapeHtml(String(Number.parseInt(absentDays, 10) || 0))}</td>
              <td>${escapeHtml(String(Number.parseInt(lateDays, 10) || 0))}</td>
              <td>${escapeHtml(String(displayedEarlyExitDays))}</td>
            </tr>
          </tbody>
        </table>

        <h3 class="certificate-section-ribbon">${escapeHtml(t("certificates.notesTitle"))}</h3>
        <section class="certificate-print-notes">
          <section class="certificate-print-note"><strong>${escapeHtml(t("certificates.homeroomNotes"))}</strong><p>${escapeHtml(teacherNotes.trim() || noNotesLabel)}</p></section>
          <section class="certificate-print-note"><strong>${escapeHtml(t("certificates.behaviorEvaluation"))}</strong><p>${escapeHtml(behaviorText)}</p></section>
        </section>

        <div class="certificate-print-signatures">
          <div><span>توقيع مربي/ة الصف</span><strong>${escapeHtml(teacherSignature || t("common.notSet"))}</strong></div>
          <div><span>توقيع مدير/ة المدرسة</span><strong>${escapeHtml(principalSignature || schoolInfo?.managerName || t("common.notSet"))}</strong></div>
        </div>
      </section>
    `;
  }

  function handlePreview() {
    setShowPreview(true);
  }

  function buildPrintableHtml() {
    return `<!doctype html>
<html lang="${language}" dir="${language === "en" ? "ltr" : "rtl"}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t("certificates.title"))}</title>
  <style>@page { size: A4 portrait; margin: 10mm; }</style>
</head>
<body>${buildPrintableBody()}</body>
</html>`;
  }

  async function handlePrint() {
    setShowPreview(true);
    void buildPrintableHtml();
    await saveCertificate({}, true);
    window.setTimeout(() => window.print(), 120);
  }

  return (
    <div className="page student-certificates-page" data-e2e="student-certificates-page">
      <h2>{t("certificates.title")}</h2>

      <div className="certificate-page-status no-print">
        {saving ? <div className="form-message" role="status">{t("certificates.saving")}</div> : null}
        {!saving && certificateStatus ? <div className="form-message" role="status">{certificateStatus}</div> : null}
        {loading ? <div className="form-message" role="status">{t("common.loading")}</div> : null}
        {pageMessage ? <div className="form-message" role="status">{pageMessage}</div> : null}
        {readOnly ? <div className="form-message certificate-warning" role="status">{t("users.readOnly")}</div> : null}
      </div>

      <div
        className={
          showPreview
            ? "certificate-layout certificate-layout--preview-open"
            : "certificate-layout certificate-layout--preview-closed"
        }
      >
        <div className="certificate-controls-column no-print">
          <fieldset
            className="certificate-controls-fieldset"
            disabled={readOnly}
            style={{ border: 0, margin: 0, padding: 0, minInlineSize: 0 }}
          >
            <Card title={t("certificates.classDetailsTitle")}>
              <div className="certificate-grid certificate-grid--certificate-details">
                <label>
                  <span>{t("common.class")}</span>
                  <select
                    data-e2e="certificate-class-select"
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                  >
                    <option value="">{t("students.selectClass")}</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {localizeClassName(item.name, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("certificates.curriculumType")}</span>
                  <select
                    data-e2e="certificate-curriculum-select"
                    value={curriculumType}
                    onChange={(event) => setCurriculumType(event.target.value as CurriculumType)}
                  >
                    {curriculumOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="certificate-type-field">
                  <span>{t("certificates.type")}</span>
                  <select
                    data-e2e="certificate-type-select"
                    value={certificateType}
                    onChange={(event) => setCertificateType(event.target.value as CertificateType)}
                  >
                    {certificateTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="certificate-grid certificate-grid--two">
                <label>
                  <span>{t("certificates.academicYear")}</span>
                  <input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} />
                </label>
                <label>
                  <span>{t("certificates.issueDate")}</span>
                  <input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
                </label>
              </div>
            </Card>

            <Card title={t("certificates.studentsSelectionTitle")}>
              <div className="certificate-selection-summary">
                <span>
                  {t("certificates.selectedStudentsCount")}: {selectedClassStudents.length}
                </span>
                <button
                  data-e2e="certificate-select-all"
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (students.length === 0) return;
                    setSelectedStudentIds((previous) =>
                      previous.length === students.length
                        ? []
                        : students.map((item) => item.id).filter((id): id is string => Boolean(id))
                    );
                    setSelectedStudentId((previous) =>
                      previous && students.some((item) => item.id === previous) ? previous : students[0]?.id || ""
                    );
                  }}
                  disabled={!selectedClassId || students.length === 0}
                >
                  {selectedClassStudents.length === students.length && students.length > 0
                    ? t("certificates.clearSelection")
                    : t("certificates.selectAllStudents")}
                </button>
              </div>
              <div className="certificate-table-wrap">
                <table className="certificate-table certificate-student-table">
                  <thead>
                    <tr>
                      <th>{t("certificates.studentSelection")}</th>
                      <th>{t("certificates.studentName")}</th>
                      <th>{t("students.nationalId")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          {selectedClassId ? t("homework.noStudents") : t("certificates.selectClassFirst")}
                        </td>
                      </tr>
                    )}
                    {students.map((item, index) => {
                      const studentId = item.id || `student-${index}`;
                      const isChecked = selectedStudentIds.includes(studentId);
                      const isActive = selectedStudentId === studentId;
                      return (
                        <tr
                          key={studentId}
                          data-e2e={`certificate-student-row-${studentId}`}
                          className={isChecked ? "certificate-student-row selected" : "certificate-student-row"}
                          onClick={() => setSelectedStudentId(studentId)}
                        >
                          <td onClick={(event) => event.stopPropagation()}>
                            <label className="certificate-student-checkbox">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) => {
                                  const nextChecked = event.target.checked;
                                  setSelectedStudentIds((previous) => {
                                    if (nextChecked) {
                                      return previous.includes(studentId) ? previous : [...previous, studentId];
                                    }
                                    return previous.filter((id) => id !== studentId);
                                  });
                                  if (nextChecked) {
                                    setSelectedStudentId(studentId);
                                  } else if (studentId === selectedStudentId) {
                                    const nextActive = selectedStudentIds.find((id) => id !== studentId) || "";
                                    setSelectedStudentId(nextActive);
                                  }
                                }}
                              />
                              <span>
                                {isActive ? t("certificates.activeStudent") : t("certificates.selectStudent")}
                              </span>
                            </label>
                          </td>
                          <td>{item.name}</td>
                          <td>{item.nationalId || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title={t("certificates.attendanceTitle")}>
              <div className="certificate-grid certificate-attendance-strip">
                <label>
                  <span>{t("certificates.presentDays")}</span>
                  <input
                    type="number"
                    min="0"
                    value={presentDays}
                    onChange={(event) => setPresentDays(event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("certificates.absentDays")}</span>
                  <input
                    type="number"
                    min="0"
                    value={absentDays}
                    onChange={(event) => setAbsentDays(event.target.value)}
                  />
                </label>
                <label>
                  <span>{t("certificates.lateDays")}</span>
                  <input type="number" min="0" value={lateDays} onChange={(event) => setLateDays(event.target.value)} />
                </label>
                <label>
                  <span>{t("certificates.earlyExitDays")}</span>
                  <input
                    type="number"
                    min="0"
                    value={earlyExitDays}
                    onChange={(event) => setEarlyExitDays(event.target.value)}
                  />
                </label>
              </div>
              <div className="certificate-grid certificate-attendance-strip certificate-attendance-strip--wide">
                <label>
                  <span>{t("certificates.behaviorEvaluation")}</span>
                  <select
                    value={behaviorLevel}
                    onChange={(event) => {
                      behaviorLevelTouchedRef.current = true;
                      setBehaviorLevel(event.target.value as BehaviorLevel);
                    }}
                  >
                    {behaviorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t("certificates.result")}</span>
                  <select
                    value={result}
                    onChange={(event) => {
                      resultTouchedRef.current = true;
                      setResult(event.target.value as CertificateResult);
                    }}
                  >
                    {certificateResultOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="behavior-template-section certificate-note-bank">
                <div className="behavior-template-title">
                  <strong>{t("certificates.homeroomNotes")}</strong>
                </div>
                <div className="behavior-template-grid">
                  {(certificateContext?.behaviorSummary.noteSuggestions || []).map((note) => (
                    <button
                      key={note}
                      type="button"
                      className={teacherNotes === note ? "behavior-template-chip active" : "behavior-template-chip"}
                      onClick={() => setTeacherNotes(note)}
                    >
                      {note}
                    </button>
                  ))}
                </div>
                <label className="certificate-textarea-field">
                  <textarea
                    value={teacherNotes}
                    onChange={(event) => setTeacherNotes(event.target.value)}
                    placeholder={t("certificates.teacherNotesPlaceholder")}
                    aria-label={t("certificates.homeroomNotes")}
                    aria-live="polite"
                  />
                </label>
              </div>
            </Card>

            <Card title={t("certificates.signaturesTitle")}>
              <div className="certificate-grid certificate-grid--two">
                <label>
                  <span>{t("certificates.teacherSignature")}</span>
                  <input
                    value={teacherSignature}
                    onChange={(event) => setTeacherSignature(event.target.value)}
                    placeholder={t("certificates.teacherSignaturePlaceholder")}
                  />
                </label>
                <label>
                  <span>{t("certificates.principalSignature")}</span>
                  <input
                    value={principalSignature || schoolInfo?.managerName || ""}
                    onChange={(event) => setPrincipalSignature(event.target.value)}
                    placeholder={t("certificates.principalSignaturePlaceholder")}
                  />
                </label>
              </div>
              <div className="certificate-saving-row">
                <button type="button" className="secondary" onClick={handlePreview} disabled={!selectedStudent || loading}>
                  <Eye size={18} />
                  <span>{t("certificates.previewAction")}</span>
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void handleSaveSelectedCertificate()}
                  disabled={readOnly || !selectedStudent || loading || saving || classReviewLoading}
                >
                  <Save size={18} />
                  <span>{t("certificates.approve")}</span>
                </button>
                <button type="button" onClick={() => void handlePrint()} disabled={!selectedStudent || loading || saving}>
                  <Printer size={18} />
                  <span>{t("certificates.printPdf")}</span>
                </button>
              </div>
            </Card>
          </fieldset>
        </div>

        {showPreview && (
          <div className="certificate-preview-column">
            <Card title={t("certificates.previewTitle")}>
              <div
                data-e2e="certificate-preview-shell"
                className="certificate-preview-shell"
                dangerouslySetInnerHTML={{ __html: buildPrintableBody() }}
              />
            </Card>
          </div>
        )}
      </div>

      {showClassReview && (
        <Card
          title={t("certificates.classReviewTitle")}
          actions={
            <div className="certificate-top-actions no-print">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setShowClassReview(false);
                  setClassReviewError("");
                }}
              >
                <span>{t("common.close")}</span>
              </button>
            </div>
          }
        >
          {classReviewLoading && (
            <div className="form-message" role="status">
              {t("common.loading")}
            </div>
          )}
          {!classReviewLoading && classReviewError && (
            <div className="form-message" role="status">
              {classReviewError}
            </div>
          )}
          {!classReviewLoading && !classReviewError && classCertificateReview.length === 0 && (
            <div className="form-message" role="status">
              {t("certificates.classReviewEmpty")}
            </div>
          )}
          {!classReviewLoading && !classReviewError && classCertificateReview.length > 0 && (
            <div className="certificate-review-list">
              {classCertificateReview.map((item) => (
                <div key={item.studentId} className="certificate-review-card">
                  <div className="certificate-review-header">
                    <strong>{item.studentName}</strong>
                    <span>
                      {selectedClassName} - {item.section} - {item.nationalId}
                    </span>
                  </div>
                  <table className="certificate-review-table">
                    <thead>
                      <tr>
                        <th>{t("common.subject")}</th>
                        <th>{t("certificates.mark")}</th>
                        <th>{t("certificates.average")}</th>
                        <th>{t("certificates.grade")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.rows.map((row) => (
                        <tr key={`${item.studentId}-${row.id}`}>
                          <td>{row.subjectName}</td>
                          <td>{row.currentMark || "-"}</td>
                          <td>{typeof row.average === "number" ? row.average.toFixed(1) : "-"}</td>
                          <td>{t(row.grade || "certificates.grades.pending")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="certificate-review-meta">
                    <div>
                      <strong>{t("certificates.average")}</strong>
                      <span>{item.average === null ? "-" : item.average.toFixed(1)}</span>
                    </div>
                    <div>
                      <strong>{t("certificates.result")}</strong>
                      <span>{t(resultLabelKey(item.result))}</span>
                    </div>
                    <div>
                      <strong>{t("certificates.behaviorEvaluation")}</strong>
                      <span>{t(behaviorLabelKey(item.behaviorLevel))}</span>
                    </div>
                    <div>
                      <strong>{t("certificates.homeroomNotes")}</strong>
                      <span>{item.teacherNotes || t("common.none")}</span>
                    </div>
                  </div>
                  <div className="certificate-review-meta certificate-review-meta--attendance">
                    <div>
                      <strong>{t("certificates.presentDays")}</strong>
                      <span>{item.attendanceSummary.presentDays}</span>
                    </div>
                    <div>
                      <strong>{t("certificates.absentDays")}</strong>
                      <span>{item.attendanceSummary.absentDays}</span>
                    </div>
                    <div>
                      <strong>{t("certificates.lateDays")}</strong>
                      <span>{item.attendanceSummary.lateDays}</span>
                    </div>
                    <div>
                      <strong>{t("certificates.earlyExitDays")}</strong>
                      <span>{item.attendanceSummary.earlyExitDays}</span>
                    </div>
                    <div>
                      <strong>{t("certificates.teacherSignature")}</strong>
                      <span>{item.teacherSignature || t("common.none")}</span>
                    </div>
                    <div>
                      <strong>{t("certificates.principalSignature")}</strong>
                      <span>{item.principalSignature || t("common.none")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
