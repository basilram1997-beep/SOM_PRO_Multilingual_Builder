import { useEffect, useMemo, useState } from "react";
import type { SchoolClass, Student, Subject } from "@som/shared";
import { sortSchoolClasses } from "@som/shared";
import { somApi } from "../../api/somApi";
import type { AppLanguage } from "../teachers/teacherTypes";
import type { AuthUser } from "../../pages/auth/LoginPage";
import {
  createGradeSection,
  defaultGradeSections,
  gradeCertificateTypeOptions,
  type GradeScheme,
  type GradeSchemeAssignment,
  type GradeSection
} from "./gradeEntryTypes";

function makeId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
}

function firstTypeForTerm(term: "TERM1" | "TERM2") {
  return (
    gradeCertificateTypeOptions.find(
      (option) => option.termKey === (term === "TERM1" ? "certificates.term1" : "certificates.term2")
    )?.value || "TERM1_BIMONTHLY"
  );
}

function firstSubjectForClass(assignments: GradeSchemeAssignment[], classId: string, subjects: Subject[]) {
  const assignment = assignments.find((item) => item.classId === classId);
  if (assignment) return assignment.subjectId || "";
  return subjects[0]?.id || "";
}

function gradeEntryFallbackMessage(language: AppLanguage, arabic: string, english: string, hebrew: string) {
  if (language === "en") return english;
  if (language === "he") return hebrew;
  return arabic;
}

function totalScoreForType(type: GradeScheme["certificateType"], language: AppLanguage) {
  return defaultGradeSections(type, language as "ar" | "en" | "he").reduce(
    (sum, section) => sum + (Number(section.percentage) || 0),
    0
  );
}

export function useGradeEntry(currentUser: AuthUser, language: AppLanguage) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacher, setTeacher] = useState<{ id: string; name: string } | null>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<GradeSchemeAssignment[]>([]);
  const [term, setTerm] = useState<"TERM1" | "TERM2">("TERM1");
  const [certificateType, setCertificateType] = useState<GradeScheme["certificateType"]>("TERM1_BIMONTHLY");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [schemeId, setSchemeId] = useState("");
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState(60);
  const [sections, setSections] = useState<GradeSection[]>(
    defaultGradeSections("TERM1_BIMONTHLY", language as "ar" | "en" | "he")
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const currentTeacher = useMemo(() => (currentUser.role === "TEACHER" ? teacher : null), [currentUser.role, teacher]);
  const teacherClassIds = useMemo(
    () => new Set(teacherAssignments.map((assignment) => assignment.classId)),
    [teacherAssignments]
  );
  const accessibleClasses = useMemo(() => {
    if (currentUser.role !== "TEACHER") return classes;
    if (!currentTeacher) return [];
    if (teacherClassIds.size === 0) return [];
    return classes.filter((item) => {
      const id = item.id;
      if (!id) return false;
      return teacherClassIds.has(id);
    });
  }, [classes, currentTeacher, currentUser.role, teacherClassIds]);

  const selectedClassAccessible = useMemo(() => {
    if (!currentTeacher) return true;
    if (!classId) return true;
    return teacherClassIds.has(classId);
  }, [classId, currentTeacher, teacherClassIds]);

  const accessibleSubjects = useMemo(() => {
    if (!classId) return subjects;
    if (!currentTeacher) return subjects;
    if (!selectedClassAccessible) return [];
    const subjectIds = new Set(
      teacherAssignments
        .filter((assignment) => assignment.classId === classId)
        .map((assignment) => assignment.subjectId)
    );
    return subjects.filter((item) => Boolean(item.id) && subjectIds.has(item.id || ""));
  }, [classId, currentTeacher, selectedClassAccessible, subjects, teacherAssignments]);

  const selectedClass = useMemo(() => accessibleClasses.find((item) => item.id === classId) || null, [
    accessibleClasses,
    classId
  ]);
  const selectedSubject = useMemo(() => subjects.find((item) => item.id === subjectId) || null, [subjects, subjectId]);
  const selectedSubjectAccessible = useMemo(() => {
    if (!currentTeacher) return true;
    if (!subjectId) return true;
    return accessibleSubjects.some((item) => item.id === subjectId);
  }, [accessibleSubjects, currentTeacher, subjectId]);
  const selectedTypeOptions = useMemo(
    () =>
      gradeCertificateTypeOptions.filter(
        (option) => option.termKey === (term === "TERM1" ? "certificates.term1" : "certificates.term2")
      ),
    [term]
  );

  function applyDefault(type: GradeScheme["certificateType"]) {
    setTerm(type === "TERM1_BIMONTHLY" || type === "TERM1_FINAL" ? "TERM1" : "TERM2");
    setCertificateType(type);
    setSections(defaultGradeSections(type, language as "ar" | "en" | "he"));
    setMaxScore(totalScoreForType(type, language));
    setTitle("");
    setSchemeId("");
  }

  useEffect(() => {
    if (currentUser.role === "STUDENT" || currentUser.role === "PARENT") {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    somApi.students.gradeSchemes
      .context()
      .then((response) => {
        if (!active) return;
        const nextClasses = sortSchoolClasses((response.data?.classes || []) as SchoolClass[]);
        const nextSubjects = response.data?.subjects || [];
        const nextTeacher = response.data?.teacher || null;
        const nextAssignments = response.data?.assignments || [];
        setClasses(nextClasses);
        setSubjects(nextSubjects);
        setTeacher(nextTeacher);
        setTeacherAssignments(nextAssignments);

        const nextTeacherClassIds = new Set(nextAssignments.map((assignment) => assignment.classId));
        const nextAccessibleClasses =
          currentUser.role === "TEACHER"
            ? nextClasses.filter((item) => {
                const id = item.id;
                if (!id) return false;
                return nextTeacherClassIds.has(id);
              })
            : nextClasses;
        const nextClassId = nextAccessibleClasses[0]?.id || "";
        setClassId((previous) => {
          if (previous && nextAccessibleClasses.some((item) => item.id === previous)) {
            return previous;
          }
          return nextClassId;
        });
        setSubjectId(
          (previous) =>
            previous ||
            (currentUser.role === "TEACHER"
              ? firstSubjectForClass(
                  nextAssignments,
                  nextClasses.find((item) => nextAssignments.some((assignment) => assignment.classId === item.id))
                    ?.id ||
                    nextClasses[0]?.id ||
                    "",
                  nextSubjects
                )
              : nextSubjects[0]?.id || "")
        );
      })
      .catch(() => {
        if (!active) return;
        setMessage(
          gradeEntryFallbackMessage(
            language,
            "تعذر تحميل بيانات إدخال العلامات",
            "Could not load grade entry data",
            "לא ניתן לטעון את נתוני הזנת הציונים"
          )
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser.role, language]);

  useEffect(() => {
    if (!currentUser.studentId || currentUser.role === "TEACHER") return;

    let active = true;
    somApi.students
      .context(currentUser.studentId)
      .then((response) => {
        if (!active) return;
        const student = response.data?.student || null;
        const studentClass = response.data?.class || student?.class || null;
        const studentSubjects = response.data?.subjects || [];
        setClasses(studentClass ? [studentClass] : []);
        setSubjects(studentSubjects);
        setTeacherAssignments([]);
        setClassId(studentClass?.id || "");
        setSubjectId((previous) => {
          if (previous && studentSubjects.some((item) => item.id === previous)) return previous;
          return studentSubjects[0]?.id || "";
        });
      })
      .catch(() => {
        if (!active) return;
      });

    return () => {
      active = false;
    };
  }, [currentUser.role, currentUser.studentId]);

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      return;
    }

    if (!selectedClassAccessible) {
      setStudents([]);
      setSubjectId("");
      return;
    }

    let active = true;
    somApi.students
      .list(classId)
      .then((response) => {
        if (!active) return;
        setStudents(response.data || []);
      })
      .catch(() => {
        if (!active) return;
        setStudents([]);
      });
    return () => {
      active = false;
    };
  }, [classId, selectedClassAccessible]);

  useEffect(() => {
    if (!currentTeacher) return;
    if (!classId) return;
    if (!selectedClassAccessible) {
      setSubjectId("");
      return;
    }
    if (accessibleSubjects.length === 0) {
      setSubjectId("");
      return;
    }
    if (!subjectId || !accessibleSubjects.some((item) => item.id === subjectId)) {
      setSubjectId(accessibleSubjects[0]?.id || "");
    }
  }, [accessibleSubjects, classId, currentTeacher, selectedClassAccessible, subjectId]);

  useEffect(() => {
    if (currentUser.role === "STUDENT" || currentUser.role === "PARENT") {
      return;
    }

    if (!classId || !subjectId || !certificateType || !selectedClassAccessible || !selectedSubjectAccessible) {
      setSchemeId("");
      setTitle("");
      setSections(defaultGradeSections(certificateType, language as "ar" | "en" | "he"));
      setMaxScore(totalScoreForType(certificateType, language));
      return;
    }

    let active = true;
    setMessage("");
    setLoading(true);
    somApi.students.gradeSchemes
      .get(classId, subjectId, certificateType)
      .then((response) => {
        if (!active) return;
        const scheme = response.data || null;
        if (!scheme) {
          setSchemeId("");
          setTitle("");
          const nextSections = defaultGradeSections(certificateType, language as "ar" | "en" | "he");
          setSections(nextSections);
          setMaxScore(
            nextSections.reduce((sum, section) => sum + (Number(section.percentage) || 0), 0) ||
              totalScoreForType(certificateType, language)
          );
          return;
        }
        setSchemeId(scheme.id || "");
        setTitle(scheme.title || "");
        const nextSections =
          (scheme.sections || []).length > 0
            ? scheme.sections
            : defaultGradeSections(certificateType, language as "ar" | "en" | "he");
        setSections(nextSections);
        setMaxScore(
          nextSections.reduce((sum, section) => sum + (Number(section.percentage) || 0), 0) ||
            scheme.maxScore ||
            totalScoreForType(certificateType, language)
        );
      })
      .catch(() => {
        if (!active) return;
        setMessage(
          gradeEntryFallbackMessage(
            language,
            "تعذر تحميل خطة العلامات",
            "Could not load the grade scheme",
            "לא ניתן לטעון את תכנית הציונים"
          )
        );
        const nextSections = defaultGradeSections(certificateType, language as "ar" | "en" | "he");
        setSections(nextSections);
        setMaxScore(
          nextSections.reduce((sum, section) => sum + (Number(section.percentage) || 0), 0) ||
            totalScoreForType(certificateType, language)
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [classId, subjectId, certificateType, selectedClassAccessible, selectedSubjectAccessible, language]);

  function addSection() {
    setSections((previous) => [...previous, createGradeSection(makeId())]);
  }

  function updateSection(id: string, patch: Partial<GradeSection>) {
    setSections((previous) => previous.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  }

  function removeSection(id: string) {
    setSections((previous) => (previous.length > 1 ? previous.filter((section) => section.id !== id) : previous));
  }

  function setTermAndType(nextTerm: "TERM1" | "TERM2") {
    setTerm(nextTerm);
    applyDefault(firstTypeForTerm(nextTerm));
  }

  async function save() {
    if (!classId || !subjectId || !certificateType) {
      setMessage(
        gradeEntryFallbackMessage(
          language,
          "اختر الصف والمادة ونوع الشهادة أولًا",
          "Choose the class, subject, and certificate type first",
          "יש לבחור תחילה כיתה, מקצוע וסוג תעודה"
        )
      );
      return;
    }
    if (currentTeacher && !selectedClassAccessible) {
      setMessage(
        gradeEntryFallbackMessage(
          language,
          "لا تملك صلاحية تعديل هذا الصف",
          "You do not have permission to edit this class",
          "אין לך הרשאה לערוך כיתה זו"
        )
      );
      return;
    }
    if (currentTeacher && !selectedSubjectAccessible) {
      setMessage(
        gradeEntryFallbackMessage(
          language,
          "هذه المادة غير مرتبطة بهذا الصف أو بهذا المعلم",
          "This subject is not linked to this class or teacher",
          "המקצוע הזה לא משויך לכיתה או למורה הזה"
        )
      );
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload: GradeScheme = {
        id: schemeId || undefined,
        classId,
        subjectId,
        certificateType,
        title: title.trim() || null,
        maxScore,
        sections: sections.map((section) => ({
          ...section,
          name: section.name.trim(),
          percentage: Number(section.percentage) || 0,
          outOf: Number(section.outOf) || 0
        }))
      };
      const response = await somApi.students.gradeSchemes.save(payload);
      const saved = response.data;
      if (saved) {
        setSchemeId(saved.id || "");
        setTitle(saved.title || "");
        setSections(saved.sections || []);
        setMaxScore(saved.maxScore || maxScore);
        setMessage(
          gradeEntryFallbackMessage(language, "تم حفظ خطة العلامات", "Grade scheme saved", "תכנית הציונים נשמרה")
        );
      }
    } catch {
      setMessage(
        gradeEntryFallbackMessage(
          language,
          "تعذر حفظ خطة العلامات",
          "Could not save the grade scheme",
          "לא ניתן לשמור את תכנית הציונים"
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const totalWeight = sections.reduce((sum, section) => sum + (Number(section.percentage) || 0), 0);

    return {
    classes: accessibleClasses,
    students,
    subjects: accessibleSubjects,
    teacher,
    teacherAssignments,
    term,
    certificateType,
    classId,
    subjectId,
    title,
    maxScore,
    sections,
    loading,
    saving,
    message,
    selectedClass,
    selectedSubject,
    selectedTypeOptions,
    totalWeight,
    selectedClassAccessible,
    selectedSubjectAccessible,
    setClassId,
    setSubjectId,
    setTitle,
    setMaxScore,
    setTermAndType,
    setCertificateType: applyDefault,
    addSection,
    updateSection,
    removeSection,
    save
  };
}

export type GradeEntryState = ReturnType<typeof useGradeEntry>;
