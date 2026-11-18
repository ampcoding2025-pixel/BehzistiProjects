import type { DiskRequest, GapItem } from "./types";

export const MOCK_REQUESTS: DiskRequest[] = [
  {
    id: "REQ-1405-081",
    diskTypeId: "yrn-cbr-rural",
    title: "CBR روستایی - 18 آبان",
    periodLabel: "آبان ۱۴۰۵",
    requestedBy: "مریم علی‌پور",
    requestedAt: "1405/08/23 10:12",
    status: "handed_to_finance",
    armaghanTransactionId: 835,
    fileName: undefined,
    logTail: ["RegisterTransaction skipped (existing Id=835)", "CalculateMarakezYarane SupplyLocationId=51 OK"],
  },
  {
    id: "REQ-1405-080",
    diskTypeId: "yrn-case-mgmt",
    title: "یارانه مرکز مدیریت مورد 10 آبان 1405",
    periodLabel: "آبان ۱۴۰۵",
    requestedBy: "مریم علی‌پور",
    requestedAt: "1405/08/10 14:40",
    status: "ready",
    armaghanTransactionId: 818,
    fileName: "1e152ba8-ab40-4ada-8dc1-3a2c5c98c169-Marakez-CSV-Zihesab-818.csv",
    logTail: ["GetListMakeover OK", "DownloadURL ready"],
  },
  {
    id: "REQ-1405-079",
    diskTypeId: "mst-base",
    title: "مستمری مهر ۱۴۰۴",
    periodLabel: "مهر ۱۴۰۴",
    requestedBy: "اپراتور ستاد",
    requestedAt: "1404/07/28 18:05",
    status: "ready",
    armaghanTransactionId: 10794,
    fileName: "mostamari-mehr1404.xlsx",
    logTail: ["CalculateTransaction @TrId=10713", "Excel export 1,584,438 rows"],
  },
  {
    id: "REQ-1405-078",
    diskTypeId: "mst-emdad",
    title: "کمک هزینه امداد",
    periodLabel: "آذر ۱۴۰۴",
    requestedBy: "اپراتور ستاد",
    requestedAt: "1404/09/02 11:20",
    status: "failed",
    armaghanTransactionId: 10705,
    errorMessage: "IBN تکراری در IBN_AccountNumber — پرداخت متوقف شد",
    logTail: ["CalculateEmdad OK", "duplicate AccountNumber check FAILED"],
  },
  {
    id: "REQ-1405-077",
    diskTypeId: "yrn-children",
    title: "یارانه مراکز فرزندان",
    periodLabel: "آبان ۱۴۰۵",
    requestedBy: "اپراتور ستاد",
    requestedAt: "1405/08/20 09:00",
    status: "running",
    logTail: ["queued worker…", "CalculateMarakezYarane started"],
  },
];

export const GAPS: GapItem[] = [
  {
    id: "g1",
    severity: "blocker",
    title: "اتصال Worker به AmarDB @ 10.1.0.157",
    detail:
      "AmarDB منبع اصلی است؛ DB_Mostamary رپلیکای آن است. برای Calculate* نیاز به EXECUTE روی SPها و حساب کنترل‌شده است.",
  },
  {
    id: "g2",
    severity: "blocker",
    title: "توکن/سرویس‌اکانت ارمغان API",
    detail:
      "API روی 10.1.0.16 با auth ارمغان است. برای Register/Calculate/GetList نیاز به service account ستادی (نه لاگین تعاملی CAPTCHA) داریم.",
  },
  {
    id: "g3",
    severity: "blocker",
    title: "فهرست کامل ۳۸–۴۰ نوع دیسکت",
    detail:
      "کاتالوگ فعلی نمونه است. باید با واحد مالی/حوزه‌ها لیست نهایی انواع دیسکت ماهانه را قفل کنیم.",
  },
  {
    id: "g4",
    severity: "needed",
    title: "نگاشت Type UI ↔ SupplyLocationId",
    detail:
      "مودال ارمغان Type متنی می‌فرستد و SupplyLocationId=[-100] می‌گذارد؛ کوئری‌های دستی SupplyLocationId واقعی دارند. باید مشخص شود کدام مسیر رسمی است.",
  },
  {
    id: "g5",
    severity: "needed",
    title: "جدول داخلی درخواست‌ها + لاگ",
    detail:
      "MakeOverTransactions تاریخچه «چه کسی درخواست داده» ندارد. پنل نیاز به DB خودش (SQLite/SQL) برای Request/Status/Log دارد.",
  },
  {
    id: "g6",
    severity: "needed",
    title: "Auth محدود به ۶ نفر + فقط اینترانت",
    detail:
      "SSO یا لیست سفید IP ساختمان ستاد + نقش operator / finance_viewer / admin.",
  },
  {
    id: "g7",
    severity: "needed",
    title: "قالب اکسل مستمری تأییدشده",
    detail:
      "ستون‌های NIDMadadjo، شبا، Bank، Marhale و … از کوئری ops doc باید به قالب ثابت تبدیل شوند.",
  },
  {
    id: "g8",
    severity: "nice",
    title: "لینک عمیق به تراکنش ارمغان",
    detail:
      "از روی armaghanTransactionId به صفحه تراکنش/دانلود ارمغان لینک بدهیم تا مالی بدون جستجو ادامه دهد.",
  },
];
