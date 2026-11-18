/**
 * Live Armaghan integration map (read-only discovery 2026-11-14).
 * Front: http://10.1.0.10  · API: http://10.1.0.16/  · Diskette: http://10.1.0.17//Diskette
 * SQL primary: 10.1.0.155 / AmarDB — replica 10.1.0.157; lab DB_Mostamary @ 10.0.28.10
 */

export const ARMAGHAN = {
  uiBase: "http://10.1.0.10",
  apiBase: "http://10.1.0.16/",
  disketteBase: "http://10.1.0.17//Diskette",
  transactionsRoute: "/#/app/centers/makeovers/transactions",
  db: "AmarDB",
  dbReplicaNote: "DB_Mostamary is a replication of AmarDB",
  sqlHost: "10.1.0.157",
} as const;

export const MAKEOVER_API = {
  listTransactions: "GET MakeOver/GetPayedTransaction",
  registerTransaction: "POST MakeOver/RegisterTransaction?title=",
  calculate: "POST MakeOver/Calculate  body: { Id, Title, Type, TransactionId, SupplyLocationId:[-100] }",
  personList: "POST Diskette/GetListMakeover?id={transactionId}",
  bankDisk: "POST Diskette/GetMakeOver?id={transactionId}",
  download: "GET {disketteBase}/Download?filename=",
  supplyLocations: "GET MakeOver/ViewSupplyLocations",
} as const;

/** Exact labels from Armaghan `views/centers/makeovers/calc.html`. */
export const UI_CALC_TYPES = [
  { value: "shabane", label: "محاسبه یارانه مراکز شبانه روزی" },
  { value: "roozane", label: "محاسبه یارانه مراکز روزانه" },
  { value: "moraghebat", label: "محاسبه یارانه مراکز مراقبت در منزل" },
  { value: "visit", label: "محاسبه یارانه مراکز ویزیت در منزل" },
  { value: "etiad", label: "محاسبه یارانه مراکز ترک اعتیاد" },
  { value: "list", label: "تهیه لیست افراد" },
  { value: "diskette", label: "تهیه دیسکت بانک" },
] as const;

/** Armaghan «جدید» only prompts for title — type is chosen later in calc modal. */
export const ARMAGHAN_NEW_FLOW = [
  "لیست تراکنش‌ها → دکمه جدید → confirm → prompt عنوان",
  "API: POST MakeOver/RegisterTransaction?title=",
  "بعداً روی ردیف: کلید محاسبه → انتخاب «نوع محاسبه» از ۷ گزینه",
  "API: POST MakeOver/Calculate با Type + SupplyLocationId=[-100]",
] as const;

/** Seamless flow: PayDiskPanel orchestrates; Armaghan remains system of record for یارانه. */
export const INTEGRATION_FLOW = {
  mostamari: [
    "کاربر نوع دیسکت + دوره را در پنل دیسکت پرداخت درخواست می‌کند",
    "Worker روی AmarDB (اصلی؛ DB_Mostamary رپلیکاست) اسکریپت‌های تأییدشده (Calculate*) را اجرا می‌کند",
    "کوئری تهیه لیست → Excel در پنل قابل دانلود است",
    "تاریخچه + لاگ در پنل ذخیره می‌شود (نه در ارمغان)",
  ],
  yarane: [
    "کاربر نوع یارانه + عنوان تراکنش را درخواست می‌کند",
    "Worker: RegisterTransaction روی API ارمغان (یا فقط لینک به تراکنش موجود)",
    "Worker: Calculate با Type مناسب / یا CalculateMarakezYarane(@TrId,@SupplyLocationId)",
    "GetListMakeover → CSV؛ وضعیت «تحویل به مالی»",
    "واحد مالی ادامه را در سامانه خودشان می‌دهد (دیسکت بانک اختیاری/خارج از پنل)",
  ],
} as const;
