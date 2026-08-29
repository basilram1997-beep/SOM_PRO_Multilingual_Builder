export type BehaviorTone = "POSITIVE" | "NEGATIVE";

export type BehaviorCategoryKey =
  "discipline" | "participation" | "respect" | "responsibility" | "teamwork" | "selfControl" | "safety";

export type BehaviorCategory = {
  key: BehaviorCategoryKey;
  labelKey: string;
  positive: string[];
  negative: string[];
};

const legacyBehaviorCategoryAliases: Record<string, BehaviorCategoryKey> = {
  الانضباط: "discipline",
  المشاركة: "participation",
  "المشاركة والتعلم": "participation",
  الاحترام: "respect",
  "الاحترام والتعامل مع الآخرين": "respect",
  المسؤولية: "responsibility",
  "المسؤولية والمحافظة على المقتنيات": "responsibility",
  "العمل الجماعي": "teamwork",
  "ضبط النفس": "selfControl",
  "ضبط النفس وإدارة المشاعر": "selfControl",
  السلامة: "safety",
  "السلامة والسلوك داخل المدرسة": "safety"
};

export const behaviorCategories: BehaviorCategory[] = [
  {
    key: "discipline",
    labelKey: "behavior.categories.discipline",
    positive: [
      "يلتزم بالحضور في الوقت المحدد.",
      "يدخل الصف بهدوء وانتظام.",
      "يلتزم بتعليمات المدرسة.",
      "يحافظ على الهدوء أثناء الشرح.",
      "ينتظر دوره في الحديث.",
      "يستأذن قبل مغادرة مكانه.",
      "يلتزم بالزي المدرسي.",
      "يحضر أدواته المدرسية كاملة."
    ],
    negative: [
      "يتأخر عن الحصة دون عذر.",
      "يدخل الصف بطريقة تسبب الإزعاج.",
      "لا يلتزم بالتعليمات المعلنة.",
      "يتحدث أثناء شرح المعلم.",
      "يقاطع المعلم أو زملاءه.",
      "يغادر مكانه دون استئذان.",
      "لا يلتزم بالزي المدرسي.",
      "يتكرر نسيانه للأدوات المدرسية."
    ]
  },
  {
    key: "participation",
    labelKey: "behavior.categories.participation",
    positive: [
      "يشارك بفاعلية في الحصة.",
      "يطرح أسئلة مرتبطة بالدرس.",
      "ينفذ المهام المطلوبة في الوقت المحدد.",
      "يبذل جهداً واضحاً في التعلم.",
      "يستجيب لتوجيهات المعلم.",
      "يركز أثناء الشرح.",
      "يطلب المساعدة بطريقة مناسبة.",
      "يراجع أخطاءه ويصححها.",
      "يحافظ على كتبه ودفاتره منظمة.",
      "يكمل واجباته بانتظام."
    ],
    negative: [
      "لا يشارك في الأنشطة الصفية.",
      "يطرح تعليقات غير مرتبطة بالدرس.",
      "يتأخر في تنفيذ المهام المطلوبة.",
      "لا يبذل جهداً كافياً في أداء المهمة.",
      "يتجاهل توجيهات المعلم.",
      "يتشتت بشكل متكرر أثناء الشرح.",
      "يمتنع عن طلب المساعدة عند الحاجة.",
      "يكرر الخطأ دون محاولة تصحيحه.",
      "لا يحافظ على تنظيم كتبه ودفاتره.",
      "لا يكمل واجباته المدرسية."
    ]
  },
  {
    key: "respect",
    labelKey: "behavior.categories.respect",
    positive: [
      "يتحدث مع الآخرين باحترام.",
      "يحترم آراء زملائه.",
      "يتقبل الاختلاف مع الآخرين.",
      "يقدم المساعدة لزملائه.",
      "يحافظ على خصوصية الآخرين.",
      "يعتذر عند ارتكاب خطأ.",
      "يتعامل بلطف مع زملائه.",
      "يحترم ممتلكات الآخرين.",
      "يشجع زملاءه على المشاركة.",
      "يتجنب النزاعات ويسعى للحوار."
    ],
    negative: [
      "يستخدم ألفاظاً غير مناسبة.",
      "يسخر من آراء زملائه.",
      "يتعامل بعدوانية عند الاختلاف.",
      "يرفض التعاون مع زملائه.",
      "يتدخل في خصوصيات الآخرين.",
      "يرفض الاعتذار عند الإساءة.",
      "يضايق زملاءه قولاً أو فعلاً.",
      "يستخدم ممتلكات الآخرين دون إذن.",
      "يحبط زملاءه أو يقلل من جهودهم.",
      "يثير النزاعات بين زملائه."
    ]
  },
  {
    key: "responsibility",
    labelKey: "behavior.categories.responsibility",
    positive: [
      "يتحمل مسؤولية أفعاله.",
      "يعيد الأدوات إلى مكانها.",
      "يحافظ على نظافة الصف.",
      "يحافظ على ممتلكات المدرسة.",
      "يستخدم الأدوات بطريقة آمنة.",
      "يعترف بالخطأ بصدق.",
      "يلتزم بالمهمة الموكلة إليه.",
      "يسلم الأعمال في موعدها."
    ],
    negative: [
      "يلقي اللوم على الآخرين.",
      "يترك الأدوات في غير مكانها.",
      "يلقي المخلفات في الصف.",
      "يسيء استخدام ممتلكات المدرسة.",
      "يستخدم الأدوات بطريقة غير آمنة.",
      "ينكر السلوك رغم وضوحه.",
      "يترك المهمة قبل إكمالها.",
      "يتكرر تأخره في تسليم الأعمال."
    ]
  },
  {
    key: "teamwork",
    labelKey: "behavior.categories.teamwork",
    positive: [
      "يتعاون مع أفراد المجموعة.",
      "يؤدي دوره في النشاط الجماعي.",
      "يستمع إلى أفكار زملائه.",
      "يشارك الأدوات والمواد مع الآخرين.",
      "يساعد المجموعة على إنجاز المهمة.",
      "يحترم توزيع الأدوار.",
      "يشجع الحلول المشتركة."
    ],
    negative: [
      "يرفض العمل ضمن المجموعة.",
      "لا يؤدي دوره في النشاط الجماعي.",
      "يفرض رأيه على المجموعة.",
      "يحتكر الأدوات والمواد.",
      "يشتت المجموعة عن إنجاز المهمة.",
      "يتدخل في أدوار زملائه دون اتفاق.",
      "يرفض الحلول المتفق عليها دون مبرر."
    ]
  },
  {
    key: "selfControl",
    labelKey: "behavior.categories.selfControl",
    positive: [
      "يعبر عن مشاعره بطريقة مناسبة.",
      "يهدأ عند التوجيه.",
      "يتقبل الملاحظات بهدوء.",
      "يتحكم في ردود أفعاله.",
      "يحاول حل المشكلة بالحوار.",
      "يتقبل الخسارة بروح رياضية.",
      "يعود إلى المهمة بعد التوجيه."
    ],
    negative: [
      "يعبر عن غضبه بطريقة مؤذية.",
      "يستمر في السلوك بعد التنبيه.",
      "يرفض الملاحظات بطريقة غير مناسبة.",
      "يتصرف باندفاع متكرر.",
      "يستخدم الصراخ أو التهديد لحل المشكلة.",
      "يتصرف بطريقة غير مناسبة عند الخسارة.",
      "يرفض العودة إلى المهمة بعد التوجيه."
    ]
  },
  {
    key: "safety",
    labelKey: "behavior.categories.safety",
    positive: [
      "يلتزم بقواعد السلامة.",
      "يتحرك بهدوء في الممرات.",
      "يستخدم المرافق بطريقة صحيحة.",
      "يبلغ عن المواقف غير الآمنة.",
      "يلتزم بتعليمات الإخلاء والطوارئ."
    ],
    negative: [
      "يخالف قواعد السلامة.",
      "يركض في الممرات بطريقة غير آمنة.",
      "يسيء استخدام مرافق المدرسة.",
      "يقوم بسلوك قد يعرضه أو يعرض الآخرين للخطر.",
      "لا يلتزم بتعليمات الإخلاء والطوارئ."
    ]
  }
];

export function getBehaviorCategory(key: string) {
  const normalizedKey = normalizeBehaviorCategoryKey(key);
  return behaviorCategories.find((category) => category.key === normalizedKey) || behaviorCategories[0];
}

export function getBehaviorTemplates(categoryKey: string, tone: BehaviorTone) {
  const category = getBehaviorCategory(categoryKey);
  return tone === "POSITIVE" ? category.positive : category.negative;
}

export function getBehaviorCategoryLabelKey(categoryKey: string) {
  return getBehaviorCategory(categoryKey).labelKey;
}

export function normalizeBehaviorCategoryKey(key: string) {
  return legacyBehaviorCategoryAliases[String(key || "").trim()] || String(key || "").trim();
}
