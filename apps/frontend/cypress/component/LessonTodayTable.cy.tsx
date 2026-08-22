import { LessonTodayTable } from "../../src/features/lessons/LessonTodayTable";
import type { LessonTodayRow } from "../../src/features/lessons/lessonTodayTypes";

const t = (key: string) =>
  ({
    "lessonToday.listTitle": "سجل الحصص",
    "common.period": "الحصة",
    "common.class": "الصف",
    "common.subject": "المادة",
    "lessonToday.titleField": "عنوان الدرس",
    "lessonToday.status": "الحالة",
    "lessonToday.summaryField": "الملخص",
    "lessonToday.empty": "لا توجد حصص بعد",
    "common.loading": "جارٍ التحميل",
    "common.actions": "الإجراءات",
    "common.edit": "تعديل",
    "common.delete": "حذف",
    "lessonToday.status.NOT_STARTED": "لم تبدأ",
    "lessonToday.status.IN_PROGRESS": "قيد التنفيذ",
    "lessonToday.status.COMPLETED": "مكتملة"
  })[key] ?? key;

const row: LessonTodayRow = {
  id: "lesson-1",
  teacherId: "teacher-1",
  classId: "class-1",
  subjectId: "subject-1",
  date: "2026-08-22",
  day: "السبت",
  period: 1,
  title: "مراجعة جدول الضرب",
  summary: "تمت المراجعة بنجاح",
  status: "COMPLETED",
  note: "",
  attachments: "",
  teacher: { id: "teacher-1", name: "أحمد" },
  class: { id: "class-1", name: "التاسع أ" },
  subject: { id: "subject-1", name: "رياضيات" }
};

describe("<LessonTodayTable />", () => {
  it("renders the period column and wires row actions", () => {
    const onEdit = cy.stub();
    const onDelete = cy.stub();

    cy.mount(
      <LessonTodayTable
        t={t}
        language="ar"
        rows={[row]}
        loading={false}
        savingLessonId={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    cy.contains("h2", "سجل الحصص").should("be.visible");
    cy.contains("th.lesson-period-column", "الحصة").should("be.visible");
    cy.contains("td.lesson-period-column", "1").should("be.visible");
    cy.contains("td", "التاسع أ").should("be.visible");
    cy.contains("td", "رياضيات").should("be.visible");
    cy.contains("td", "مكتملة").should("be.visible");

    cy.contains("button", "تعديل").click();
    cy.contains("button", "حذف").click();

    cy.wrap(onEdit).should((spy) => {
      expect(spy).to.have.been.calledOnce;
      expect(spy.firstCall.args[0]).to.deep.equal(row);
    });
    cy.wrap(onDelete).should((spy) => {
      expect(spy).to.have.been.calledOnce;
      expect(spy.firstCall.args[0]).to.equal("lesson-1");
    });
  });

  it("hides actions in read-only mode", () => {
    const onEdit = cy.stub();
    const onDelete = cy.stub();

    cy.mount(
      <LessonTodayTable
        t={t}
        language="ar"
        rows={[row]}
        loading={false}
        savingLessonId={null}
        onEdit={onEdit}
        onDelete={onDelete}
        readOnly
      />
    );

    cy.contains("th", "الإجراءات").should("not.exist");
    cy.contains("button", "تعديل").should("not.exist");
    cy.contains("button", "حذف").should("not.exist");
    cy.contains("td.lesson-period-column", "1").should("be.visible");
  });
});
