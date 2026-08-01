# DATA Map and Information Classification

This document classifies the main stored data in SOM PRO according to the ministry-oriented categories:

- `public` = safe to show to authorized school users in normal UI flows.
- `internal` = operational or structural data that should stay inside the system.
- `personal` = identifies a person or belongs to a specific person.
- `sensitive` = educational, behavioral, academic, attendance, or health-related data that may harm a student or staff member if exposed.
- `confidential` = security, secret, audit, export, backup, license, token, or integrity data.

## Rules

- Free-text fields are treated as `sensitive` unless they are clearly operational metadata.
- Audit records are always `confidential`.
- Export and backup files are always `confidential`.
- Desktop-local storage must not contain `personal`, `sensitive`, or `confidential` school data.
- Relation fields inherit the classification of the underlying entity and are considered internal reference metadata.

## School and Identity

| Model              | Field                    | Class        |
| ------------------ | ------------------------ | ------------ |
| School             | name                     | public       |
| School             | semelMosad               | internal     |
| School             | city                     | public       |
| School             | district                 | public       |
| School             | status                   | internal     |
| School             | address                  | public       |
| School             | managerName              | personal     |
| School             | institutionCode          | confidential |
| School             | isActive                 | internal     |
| User               | schoolId                 | internal     |
| User               | name                     | personal     |
| User               | fullName                 | personal     |
| User               | email                    | personal     |
| User               | phone                    | personal     |
| User               | password                 | confidential |
| User               | passwordHash             | confidential |
| User               | externalIdentityProvider | confidential |
| User               | externalUserId           | confidential |
| User               | ministryUserId           | confidential |
| User               | mfaEnabled               | confidential |
| User               | status                   | internal     |
| User               | lastLoginAt              | confidential |
| User               | role                     | internal     |
| Role               | schoolId                 | internal     |
| Role               | name                     | internal     |
| Role               | description              | internal     |
| Permission         | key                      | internal     |
| Permission         | description              | internal     |
| UserRoleAssignment | schoolId                 | internal     |
| UserRoleAssignment | userId                   | internal     |
| UserRoleAssignment | roleId                   | internal     |
| RolePermission     | roleId                   | internal     |
| RolePermission     | permissionId             | internal     |

## School Configuration

| Model            | Field         | Class    |
| ---------------- | ------------- | -------- |
| SchoolSettings   | schoolId      | internal |
| SchoolSettings   | workingDays   | internal |
| SchoolSettings   | offDays       | internal |
| SchoolSettings   | periodsPerDay | internal |
| SchoolSettings   | maxTeachers   | internal |
| SchoolSettings   | notes         | internal |
| PeriodDefinition | schoolId      | internal |
| PeriodDefinition | period        | internal |
| PeriodDefinition | label         | public   |
| PeriodDefinition | startTime     | public   |
| PeriodDefinition | endTime       | public   |
| PeriodDefinition | isActive      | internal |

## Teachers, Classes, Students

| Model       | Field                 | Class        |
| ----------- | --------------------- | ------------ |
| Teacher     | schoolId              | internal     |
| Teacher     | name                  | personal     |
| Teacher     | userId                | internal     |
| Teacher     | employeeNumber        | personal     |
| Teacher     | externalId            | confidential |
| Teacher     | status                | internal     |
| Teacher     | nationalId            | personal     |
| Teacher     | specialty             | internal     |
| Teacher     | adminRole             | internal     |
| Teacher     | employmentRatio       | internal     |
| Teacher     | workDays              | internal     |
| Teacher     | preferredDays         | internal     |
| Teacher     | preferredClasses      | internal     |
| Teacher     | preferredPeriods      | internal     |
| Teacher     | releaseHours          | internal     |
| Teacher     | targetLoad            | internal     |
| Teacher     | notes                 | sensitive    |
| SchoolClass | schoolId              | internal     |
| SchoolClass | name                  | public       |
| SchoolClass | gradeLevel            | public       |
| SchoolClass | homeroomTeacherId     | internal     |
| SchoolClass | status                | internal     |
| SchoolClass | grade                 | public       |
| SchoolClass | section               | public       |
| Student     | schoolId              | internal     |
| Student     | classId               | internal     |
| Student     | name                  | personal     |
| Student     | firstName             | personal     |
| Student     | lastName              | personal     |
| Student     | internalStudentNumber | internal     |
| Student     | externalId            | confidential |
| Student     | status                | internal     |
| Student     | nationalId            | personal     |
| Student     | fatherName            | personal     |
| Student     | motherName            | personal     |
| Student     | residence             | personal     |
| Student     | fatherPhone           | personal     |
| Student     | motherPhone           | personal     |
| Student     | guardianPhone         | personal     |
| Student     | healthFund            | sensitive    |
| Student     | studentPhone          | personal     |

## Attendance and Notifications

| Model               | Field           | Class        |
| ------------------- | --------------- | ------------ |
| StudentAttendance   | schoolId        | internal     |
| StudentAttendance   | studentId       | internal     |
| StudentAttendance   | date            | public       |
| StudentAttendance   | day             | public       |
| StudentAttendance   | status          | sensitive    |
| StudentAttendance   | lateAt          | sensitive    |
| StudentNotification | schoolId        | internal     |
| StudentNotification | studentId       | personal     |
| StudentNotification | eventType       | internal     |
| StudentNotification | channel         | internal     |
| StudentNotification | recipientType   | internal     |
| StudentNotification | status          | internal     |
| StudentNotification | title           | internal     |
| StudentNotification | message         | confidential |
| StudentNotification | recipientPhones | personal     |
| StudentNotification | recipientNames  | personal     |
| StudentNotification | payload         | confidential |
| StudentNotification | errorMessage    | confidential |
| StudentNotification | sentAt          | internal     |

## Academic and Behavior Records

| Model                 | Field          | Class     |
| --------------------- | -------------- | --------- |
| StudentAcademicRecord | schoolId       | internal  |
| StudentAcademicRecord | studentId      | internal  |
| StudentAcademicRecord | subjectId      | internal  |
| StudentAcademicRecord | date           | public    |
| StudentAcademicRecord | day            | public    |
| StudentAcademicRecord | tone           | sensitive |
| StudentAcademicRecord | strengths      | sensitive |
| StudentAcademicRecord | weaknesses     | sensitive |
| StudentAcademicRecord | assignments    | sensitive |
| StudentAcademicRecord | lessonProgress | sensitive |
| StudentAcademicRecord | certificate    | sensitive |
| StudentAcademicRecord | note           | sensitive |
| StudentBehaviorRecord | schoolId       | internal  |
| StudentBehaviorRecord | studentId      | internal  |
| StudentBehaviorRecord | date           | public    |
| StudentBehaviorRecord | day            | public    |
| StudentBehaviorRecord | category       | internal  |
| StudentBehaviorRecord | tone           | sensitive |
| StudentBehaviorRecord | template       | sensitive |
| StudentBehaviorRecord | note           | sensitive |

## Certificates and Grading

| Model              | Field              | Class        |
| ------------------ | ------------------ | ------------ |
| StudentCertificate | schoolId           | internal     |
| StudentCertificate | studentId          | internal     |
| StudentCertificate | certificateType    | internal     |
| StudentCertificate | academicYear       | public       |
| StudentCertificate | issueDate          | public       |
| StudentCertificate | schoolNumber       | internal     |
| StudentCertificate | presentDays        | sensitive    |
| StudentCertificate | absentDays         | sensitive    |
| StudentCertificate | lateDays           | sensitive    |
| StudentCertificate | behaviorLevel      | sensitive    |
| StudentCertificate | behaviorNote       | sensitive    |
| StudentCertificate | teacherNotes       | sensitive    |
| StudentCertificate | adminNotes         | confidential |
| StudentCertificate | teacherSignature   | confidential |
| StudentCertificate | principalSignature | confidential |
| StudentCertificate | average            | sensitive    |
| StudentCertificate | grade              | sensitive    |
| StudentCertificate | result             | sensitive    |
| StudentCertificate | approved           | internal     |
| StudentCertificate | published          | internal     |
| StudentCertificate | subjectRows        | confidential |
| StudentGradeScheme | schoolId           | internal     |
| StudentGradeScheme | classId            | internal     |
| StudentGradeScheme | subjectId          | internal     |
| StudentGradeScheme | certificateType    | internal     |
| StudentGradeScheme | title              | internal     |
| StudentGradeScheme | maxScore           | internal     |
| StudentGradeScheme | sections           | confidential |
| StudentGradeEntry  | schoolId           | internal     |
| StudentGradeEntry  | classId            | internal     |
| StudentGradeEntry  | subjectId          | internal     |
| StudentGradeEntry  | certificateType    | internal     |
| StudentGradeEntry  | rows               | confidential |
| GradeRecord        | schoolId           | internal     |
| GradeRecord        | studentId          | internal     |
| GradeRecord        | classId            | internal     |
| GradeRecord        | subjectId          | internal     |
| GradeRecord        | teacherId          | internal     |
| GradeRecord        | gradeValue         | sensitive    |
| GradeRecord        | gradeType          | internal     |
| GradeRecord        | note               | sensitive    |
| GradeRecord        | gradedAt           | internal     |

## Lessons, Homework, Exams, and Classroom Logs

| Model                     | Field           | Class        |
| ------------------------- | --------------- | ------------ |
| TeacherLessonToday        | schoolId        | internal     |
| TeacherLessonToday        | teacherId       | internal     |
| TeacherLessonToday        | classId         | internal     |
| TeacherLessonToday        | subjectId       | internal     |
| TeacherLessonToday        | date            | public       |
| TeacherLessonToday        | day             | public       |
| TeacherLessonToday        | period          | internal     |
| TeacherLessonToday        | title           | sensitive    |
| TeacherLessonToday        | summary         | sensitive    |
| TeacherLessonToday        | status          | internal     |
| TeacherLessonToday        | note            | sensitive    |
| TeacherLessonToday        | attachments     | confidential |
| TeacherHomework           | schoolId        | internal     |
| TeacherHomework           | teacherId       | internal     |
| TeacherHomework           | classId         | internal     |
| TeacherHomework           | subjectId       | internal     |
| TeacherHomework           | date            | public       |
| TeacherHomework           | day             | public       |
| TeacherHomework           | kind            | internal     |
| TeacherHomework           | title           | sensitive    |
| TeacherHomework           | description     | sensitive    |
| TeacherHomework           | dueDate         | public       |
| TeacherHomework           | attachment      | confidential |
| TeacherHomework           | notes           | sensitive    |
| TeacherHomeworkSubmission | schoolId        | internal     |
| TeacherHomeworkSubmission | homeworkId      | internal     |
| TeacherHomeworkSubmission | studentId       | internal     |
| TeacherHomeworkSubmission | status          | internal     |
| TeacherHomeworkSubmission | note            | sensitive    |
| TeacherHomeworkSubmission | grade           | sensitive    |
| TeacherExam               | schoolId        | internal     |
| TeacherExam               | teacherId       | internal     |
| TeacherExam               | classId         | internal     |
| TeacherExam               | subjectId       | internal     |
| TeacherExam               | date            | public       |
| TeacherExam               | day             | public       |
| TeacherExam               | title           | internal     |
| TeacherExam               | startTime       | public       |
| TeacherExam               | endTime         | public       |
| TeacherExam               | room            | public       |
| TeacherExam               | notes           | sensitive    |
| TeacherExam               | instructions    | sensitive    |
| Lesson                    | schoolId        | internal     |
| Lesson                    | classId         | internal     |
| Lesson                    | subjectId       | internal     |
| Lesson                    | teacherId       | internal     |
| Lesson                    | lessonDate      | public       |
| Lesson                    | startTime       | public       |
| Lesson                    | endTime         | public       |
| Lesson                    | roomId          | internal     |
| Lesson                    | timetableSlotId | internal     |
| AttendanceRecord          | schoolId        | internal     |
| AttendanceRecord          | lessonId        | internal     |
| AttendanceRecord          | studentId       | internal     |
| AttendanceRecord          | status          | sensitive    |
| AttendanceRecord          | note            | sensitive    |
| AttendanceRecord          | recordedBy      | internal     |
| AttendanceRecord          | recordedAt      | internal     |
| ClassroomLog              | schoolId        | internal     |
| ClassroomLog              | lessonId        | internal     |
| ClassroomLog              | classId         | internal     |
| ClassroomLog              | subjectId       | internal     |
| ClassroomLog              | teacherId       | internal     |
| ClassroomLog              | topic           | sensitive    |
| ClassroomLog              | logText         | sensitive    |

## Scheduling and Substitution

| Model              | Field               | Class     |
| ------------------ | ------------------- | --------- |
| TeacherAssignment  | schoolId            | internal  |
| TeacherAssignment  | teacherId           | internal  |
| TeacherAssignment  | classId             | internal  |
| TeacherAssignment  | subjectId           | internal  |
| TeacherAssignment  | weeklyPeriods       | internal  |
| HomeroomAssignment | schoolId            | internal  |
| HomeroomAssignment | teacherId           | internal  |
| HomeroomAssignment | classId             | internal  |
| HomeroomAssignment | weeklyDay           | public    |
| HomeroomAssignment | weeklyPeriod        | public    |
| HomeroomAssignment | isActive            | internal  |
| HomeroomAssignment | notes               | internal  |
| BaseScheduleSlot   | schoolId            | internal  |
| BaseScheduleSlot   | day                 | public    |
| BaseScheduleSlot   | period              | internal  |
| BaseScheduleSlot   | classId             | internal  |
| BaseScheduleSlot   | subjectId           | internal  |
| BaseScheduleSlot   | teacherId           | internal  |
| DailySchedule      | schoolId            | internal  |
| DailySchedule      | date                | public    |
| DailySchedule      | day                 | public    |
| DailyTeacherStatus | schoolId            | internal  |
| DailyTeacherStatus | dailyScheduleId     | internal  |
| DailyTeacherStatus | teacherId           | internal  |
| DailyTeacherStatus | type                | internal  |
| DailyTeacherStatus | fromPeriod          | internal  |
| DailyTeacherStatus | toPeriod            | internal  |
| DailyTeacherStatus | reason              | sensitive |
| Substitution       | schoolId            | internal  |
| Substitution       | dailyScheduleId     | internal  |
| Substitution       | period              | internal  |
| Substitution       | baseSlotId          | internal  |
| Substitution       | classId             | internal  |
| Substitution       | subjectId           | internal  |
| Substitution       | absentTeacherId     | internal  |
| Substitution       | substituteTeacherId | internal  |
| Substitution       | kind                | internal  |
| Substitution       | isManual            | internal  |
| Substitution       | note                | sensitive |
| DailyEvent         | schoolId            | internal  |
| DailyEvent         | dailyScheduleId     | internal  |
| DailyEvent         | type                | internal  |
| DailyEvent         | classId             | internal  |
| DailyEvent         | fromPeriod          | internal  |
| DailyEvent         | toPeriod            | internal  |
| DailyEvent         | color               | internal  |
| DailyEvent         | note                | sensitive |
| DutyAssignment     | schoolId            | internal  |
| DutyAssignment     | teacherId           | internal  |
| DutyAssignment     | day                 | public    |
| DutyAssignment     | startTime           | public    |
| DutyAssignment     | endTime             | public    |
| DutyAssignment     | place               | public    |
| DutyAssignment     | notes               | sensitive |
| DutyAssignment     | isActive            | internal  |
| DutyAssignment     | schoolClassId       | internal  |

## Subjects and School Links

| Model          | Field      | Class    |
| -------------- | ---------- | -------- |
| Subject        | schoolId   | internal |
| Subject        | name       | public   |
| Subject        | code       | internal |
| Subject        | status     | internal |
| Subject        | isHomeroom | internal |
| TeacherSubject | schoolId   | internal |
| TeacherSubject | teacherId  | internal |
| TeacherSubject | subjectId  | internal |
| TeacherSubject | classId    | internal |

## Operations, Security, and Commercial Data

| Model             | Field             | Class        |
| ----------------- | ----------------- | ------------ |
| AuditLog          | schoolId          | internal     |
| AuditLog          | userId            | internal     |
| AuditLog          | action            | internal     |
| AuditLog          | entity            | internal     |
| AuditLog          | entityType        | internal     |
| AuditLog          | entityId          | internal     |
| AuditLog          | before            | confidential |
| AuditLog          | after             | confidential |
| AuditLog          | oldValue          | confidential |
| AuditLog          | newValue          | confidential |
| AuditLog          | accessResult      | internal     |
| AuditLog          | ipAddress         | confidential |
| AuditLog          | userAgent         | confidential |
| ReportExport      | schoolId          | internal     |
| ReportExport      | reportType        | internal     |
| ReportExport      | fileType          | internal     |
| ReportExport      | filePath          | confidential |
| ReportExport      | requestedBy       | internal     |
| ReportExport      | status            | internal     |
| ReportExport      | expiresAt         | internal     |
| BackupJob         | schoolId          | internal     |
| BackupJob         | backupType        | internal     |
| BackupJob         | status            | internal     |
| BackupJob         | filePath          | confidential |
| BackupJob         | checksum          | confidential |
| BackupJob         | encrypted         | confidential |
| BackupJob         | startedAt         | internal     |
| BackupJob         | finishedAt        | internal     |
| BackupJob         | createdBy         | internal     |
| LicenseActivation | schoolId          | internal     |
| LicenseActivation | licenseKeyHash    | confidential |
| LicenseActivation | schoolName        | public       |
| LicenseActivation | institutionCode   | confidential |
| LicenseActivation | plan              | internal     |
| LicenseActivation | status            | internal     |
| LicenseActivation | expiresAt         | internal     |
| LicenseActivation | maxDevices        | internal     |
| LicenseActivation | deviceFingerprint | confidential |
| LicenseActivation | activatedAt       | internal     |
| LicenseActivation | lastCheckAt       | internal     |
| LicenseActivation | readOnlyReason    | internal     |
| LicenseActivation | metadata          | confidential |

## Notes for free-text fields

- `notes`, `note`, `summary`, `description`, `instructions`, `logText`, `topic`, `strengths`, `weaknesses`, `lessonProgress`, `behaviorNote`, and similar fields are treated as `sensitive` unless a model-specific table above marks them as `internal` or `confidential`.
- Classroom notes and behavioral notes are always `sensitive`.
- Certificate text, academic observations, and teacher comments should be reviewed as sensitive school records.

## Desktop storage boundary

- Local Desktop storage may keep only non-sensitive bootstrap or UI preference data.
- Anything that can identify a student, teacher, parent, grade, attendance item, note, or export file must stay in Backend/PostgreSQL.
- If a future feature needs a new free-text field, it must be classified before implementation.

## Coverage note

- All currently defined stored fields in the product scope are classified in this map.
- No known school-data field is intentionally left without a classification.
- Any new model or field added later must be classified here before it is considered ready for implementation or release.
