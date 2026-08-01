import type { SchoolClass, StudentCertificateType, Subject } from "@som/shared";

export type GradeSection = {
  id: string;
  name: string;
  percentage: number;
  outOf: number;
};

export type GradeScheme = {
  id?: string;
  classId: string;
  subjectId: string;
  certificateType: StudentCertificateType;
  title?: string | null;
  maxScore: number;
  sections: GradeSection[];
};

export type GradeSchemeResponse = {
  data: GradeScheme | null;
};

export type GradeSchemeAssignment = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  weeklyPeriods: number;
};

export type GradeSchemeContextTeacher = {
  id: string;
  name: string;
};

export type GradeSchemeContextResponse = {
  teacher: GradeSchemeContextTeacher | null;
  assignments: GradeSchemeAssignment[];
  classes: SchoolClass[];
  subjects: Subject[];
};

export type GradeEntryStudentMarks = Record<string, string>;

export type GradeEntryRows = Record<string, GradeEntryStudentMarks>;

export type GradeEntry = {
  id?: string;
  classId: string;
  subjectId: string;
  certificateType: StudentCertificateType;
  rows: GradeEntryRows;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type GradeEntryResponse = {
  data: GradeEntry | null;
};

export const gradeCertificateTypeOptions: Array<{ value: StudentCertificateType; labelKey: string; termKey: string }> =
  [
    { value: "TERM1_BIMONTHLY", labelKey: "gradeEntry.marksTerm1Bimonthly", termKey: "certificates.term1" },
    { value: "TERM1_FINAL", labelKey: "gradeEntry.marksTerm1Final", termKey: "certificates.term1" },
    { value: "TERM2_BIMONTHLY", labelKey: "gradeEntry.marksTerm2Bimonthly", termKey: "certificates.term2" },
    { value: "TERM2_FINAL", labelKey: "gradeEntry.marksTerm2Final", termKey: "certificates.term2" }
  ];

function localizedSectionLabels(_certificateType: StudentCertificateType) {
  return {
    dailyExam: {
      ar: "امتحان يومي",
      en: "Daily exam",
      he: "מבחן יומי"
    },
    attendanceParticipation: {
      ar: "حضور ومشاركة",
      en: "Attendance and participation",
      he: "נוכחות והשתתפות"
    },
    bimonthlyExam: {
      ar: "امتحان شهرين",
      en: "Bimonthly exam",
      he: "מבחן דו-חודשי"
    },
    finalExam: {
      ar: "امتحان نهائي",
      en: "Final exam",
      he: "מבחן סופי"
    }
  };
}

type Locale = "ar" | "en" | "he";

function localizedSectionText(value: { ar: string; en: string; he: string }, language: Locale) {
  return value[language] || value.ar;
}

export function defaultGradeSections(certificateType: StudentCertificateType, language: Locale = "ar"): GradeSection[] {
  const labels = localizedSectionLabels(certificateType);
  const sharedSections = [
    { id: "daily-exam", name: localizedSectionText(labels.dailyExam, language), percentage: 10, outOf: 10 },
    {
      id: "attendance-participation",
      name: localizedSectionText(labels.attendanceParticipation, language),
      percentage: 10,
      outOf: 10
    }
  ];

  if (certificateType === "TERM1_BIMONTHLY" || certificateType === "TERM2_BIMONTHLY") {
    return [
      ...sharedSections,
      { id: "bimonthly-exam", name: localizedSectionText(labels.bimonthlyExam, language), percentage: 20, outOf: 20 }
    ];
  }

  return [
    ...sharedSections,
    { id: "final-exam", name: localizedSectionText(labels.finalExam, language), percentage: 40, outOf: 40 }
  ];
}

export function createGradeSection(id: string): GradeSection {
  return { id, name: "", percentage: 10, outOf: 10 };
}

export function formatGradeSchemeSections(sections: GradeSection[]) {
  return sections
    .map((section) => `${section.name || "-"} ${Number(section.percentage) || 0}% · ${Number(section.outOf) || 0}`)
    .join(" • ");
}
