export type ReportParam = {
  key: string;
  label: string;
  type: "text" | "date" | "number";
  required?: boolean;
  placeholder?: string;
};

export type ReportDef = {
  id: string;
  group: "yarane" | "mostamari" | "quality";
  title: string;
  description: string;
  managerWhy: string;
  severity: "info" | "warn" | "critical";
  params: ReportParam[];
};

export const REPORTS: ReportDef[] = [
  {
    id: "yarane-pipeline-summary",
    group: "yarane",
    title: "خلاصه وضعیت پایپ‌لاین یارانه",
    description: "تعداد تراکنش‌ها: فقط ثبت / محاسبه‌شده بدون لیست / لیست آماده / دیسکت بانک",
    managerWhy: "تصویر کلی از گلوگاه‌ها قبل از تحویل به مالی (طبق brief مدیر).",
    severity: "info",
    params: [
      { key: "from", label: "از تاریخ", type: "date" },
      { key: "to", label: "تا تاریخ", type: "date" },
    ],
  },
  {
    id: "yarane-calc-no-list",
    group: "yarane",
    title: "محاسبه شده ولی بدون لیست افراد",
    description: "ردیف محاسبه دارد اما لیست افراد خالی است",
    managerWhy: "مرحله «تهیه لیست» جا مانده؛ تا قبل از لیست افراد نباید به مالی تحویل شود.",
    severity: "critical",
    params: [
      { key: "from", label: "از تاریخ", type: "date" },
      { key: "to", label: "تا تاریخ", type: "date" },
      { key: "limit", label: "حداکثر ردیف", type: "number", placeholder: "50" },
    ],
  },
  {
    id: "yarane-list-no-calc",
    group: "yarane",
    title: "لیست افراد بدون ردیف محاسبه",
    description: "لیست افراد پر است ولی ردیف محاسبه صفر است — ناسازگاری",
    managerWhy: "پرچم فایل لیست با داده محاسبه هم‌خوان نیست؛ نیاز بررسی دستی.",
    severity: "warn",
    params: [
      { key: "from", label: "از تاریخ", type: "date" },
      { key: "to", label: "تا تاریخ", type: "date" },
      { key: "limit", label: "حداکثر ردیف", type: "number", placeholder: "50" },
    ],
  },
  {
    id: "yarane-registered-only",
    group: "yarane",
    title: "فقط ثبت شده (بدون محاسبه و بدون لیست)",
    description: "تراکنش ساخته شده ولی هنوز Calculate / لیست انجام نشده",
    managerWhy: "درخواست‌های معلق که زمان تیم را می‌گیرند.",
    severity: "warn",
    params: [
      { key: "from", label: "از تاریخ", type: "date" },
      { key: "to", label: "تا تاریخ", type: "date" },
      { key: "limit", label: "حداکثر ردیف", type: "number", placeholder: "50" },
    ],
  },
  {
    id: "yarane-ready-for-finance",
    group: "yarane",
    title: "آماده تحویل به مالی (لیست افراد دارد)",
    description: "لیست افراد آماده است؛ دیسکت بانک در عمل اختیاری است",
    managerWhy: "همان نقطه تحویل که مدیر خواست: بعد از اسکریپت/لیست، ادامه با مالی.",
    severity: "info",
    params: [
      { key: "from", label: "از تاریخ", type: "date" },
      { key: "to", label: "تا تاریخ", type: "date" },
      { key: "limit", label: "حداکثر ردیف", type: "number", placeholder: "50" },
    ],
  },
  {
    id: "yarane-supply-catalog",
    group: "yarane",
    title: "کاتالوگ محل تامین اعتبار یارانه",
    description: "MakeOverSupplyLocation — مبنای انواع دیسکت یارانه",
    managerWhy: "مرجع قفل کردن فهرست ~۳۸–۴۰ نوع ماهانه از روی ۸۰ نوع موجود.",
    severity: "info",
    params: [],
  },
  {
    id: "mostamari-unconfirmed",
    group: "mostamari",
    title: "مستمری محاسبه‌شده بدون تایید Ky/Year",
    description: "پرداخت دارد ولی Ky یا Year خالی است (مرحله تایید سند عملیات)",
    managerWhy: "طبق سند: بعد از پرداخت باید Ky و Year ثبت شود؛ این‌ها هنوز تایید نشده‌اند.",
    severity: "critical",
    params: [
      { key: "from", label: "از تاریخ ثبت", type: "date" },
      { key: "to", label: "تا تاریخ ثبت", type: "date" },
      { key: "limit", label: "حداکثر ردیف", type: "number", placeholder: "50" },
    ],
  },
  {
    id: "mostamari-ky-distribution",
    group: "mostamari",
    title: "توزیع کدهای Ky مستمری",
    description: "شمارش PayedTransaction بر اساس Ky (Mst_131500، Emdad، …)",
    managerWhy: "هم‌خوانی با کدهای سند عملیات و کشف انواع اضافه/ناشناخته.",
    severity: "info",
    params: [],
  },
  {
    id: "mostamari-money-histogram",
    group: "mostamari",
    title: "هیستوگرام مبلغ یک تراکنش مستمری",
    description: "GROUP BY Money برای یک TransactionId (سند: گزارش مستمری)",
    managerWhy: "کنترل مبالغ نامتعارف قبل از دیسکت بانک/اکسل.",
    severity: "info",
    params: [
      {
        key: "transactionId",
        label: "شناسه تراکنش (خالی = آخرین مستمری)",
        type: "number",
        placeholder: "مثلاً 10825",
      },
    ],
  },
  {
    id: "mostamari-missing-ibn",
    group: "mostamari",
    title: "نمونه پرداخت‌ها بدون شبا (IBN)",
    description: "Join به IBN_AccountNumber تهی است — مانع دیسکت بانک در سند",
    managerWhy: "سند می‌گوید فاقد شبا جدا شود؛ این گزارش کاندیدها را نشان می‌دهد.",
    severity: "warn",
    params: [
      {
        key: "transactionId",
        label: "شناسه تراکنش (خالی = آخرین تاییدشده یا اخیر)",
        type: "number",
      },
      { key: "limit", label: "حداکثر ردیف", type: "number", placeholder: "50" },
    ],
  },
  {
    id: "ibn-duplicates",
    group: "quality",
    title: "شماره حساب تکراری در IBN_AccountNumber",
    description: "CTE تکراری سند — خطر پرداخت بیش از یک‌بار",
    managerWhy: "چک اجباری قبل از لیست حق پرستاری/امداد در سند عملیات.",
    severity: "critical",
    params: [{ key: "limit", label: "حداکثر ردیف", type: "number", placeholder: "100" }],
  },
  {
    id: "txn-person-diff",
    group: "quality",
    title: "تفاوت افراد بین دو تراکنش مستمری",
    description: "اشخاص در A که در B نیستند (نسخه فقط‌خواندنی مقایسه سند)",
    managerWhy: "قبل از یکسان‌سازی دستی؛ فقط گزارش برای تصمیم مدیر.",
    severity: "warn",
    params: [
      { key: "transactionIdA", label: "تراکنش A", type: "number", required: true },
      { key: "transactionIdB", label: "تراکنش B", type: "number", required: true },
      { key: "limit", label: "حداکثر ردیف", type: "number", placeholder: "50" },
    ],
  },
];

export function getReport(id: string) {
  return REPORTS.find((r) => r.id === id);
}
