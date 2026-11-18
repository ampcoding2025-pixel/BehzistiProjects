import type { DiskType, MakeOverUiType } from "./types";
import { ACTIVE_SUPPLY_LOCATIONS } from "./supply-locations";

/** Map SupplyLocation → Armaghan UI Type (calc.html). */
function uiTypeForSupply(keyword: string | null, id: number): MakeOverUiType | undefined {
  if (!keyword) return undefined;
  const k = keyword.toLowerCase().replace(/\s+/g, "");
  if (id === 2 || k.includes("shabane")) return "shabane";
  if (id === 9 || k.startsWith("rozaneh") || k.includes("rozane")) return "roozane";
  if (id === 8 || k.includes("moraghebat")) return "moraghebat";
  if (id === 7 || id === 65 || k.includes("khadamatdarmanzel")) return "visit";
  if (
    k.includes("etyad") ||
    k.includes("etiad") ||
    k.includes("cbr") ||
    k.includes("hemayati") ||
    id === 43 ||
    id === 111
  ) {
    return "etiad";
  }
  return "roozane";
}

const MOSTAMARI: DiskType[] = [
  {
    id: "mst-base",
    family: "mostamari",
    groupFa: "مستمری — محاسبه SQL",
    titleFa: "مستمری (اعتبارات سازمان)",
    description: "محاسبه تراکنش مستمری و تهیه فایل اکسل پرداخت به حساب افراد",
    calcProcs: ["CalculateTransaction"],
    scriptSteps: [
      "EXEC AmarDB.CalculateTransaction(@TrId)",
      "تهیه لیست شبا / اکسل در پنل",
    ],
    output: "excel_download",
    notes: "Ky=Mst_131500",
    requiresExistingTransaction: true,
  },
  {
    id: "mst-hadafmandi",
    family: "mostamari",
    groupFa: "مستمری — محاسبه SQL",
    titleFa: "افزایش مستمری (هدفمندی)",
    description: "CalculateHadafmandi — در ۱۴۰۴ اغلب با مستمری تجمیع می‌شود",
    calcProcs: ["CalculateHadafmandi"],
    scriptSteps: ["EXEC AmarDB.CalculateHadafmandi(@TrId)", "اکسل پرداخت"],
    output: "excel_download",
    notes: "Ky=Mst_HDF",
    requiresExistingTransaction: true,
  },
  {
    id: "mst-hagh-family",
    family: "mostamari",
    groupFa: "مستمری — محاسبه SQL",
    titleFa: "حق پرستاری خانواده محور",
    description: "CalculateHaghParastariFamily + لیست شبا",
    calcProcs: ["CalculateHaghParastariFamily"],
    scriptSteps: ["EXEC AmarDB.CalculateHaghParastariFamily(@TrId)", "اکسل شبا"],
    output: "excel_download",
    notes: "Ky=Mst_F_PRSTRI",
    requiresExistingTransaction: true,
  },
  {
    id: "mst-hagh-spinal",
    family: "mostamari",
    groupFa: "مستمری — محاسبه SQL",
    titleFa: "حق پرستاری ضایعه نخاعی",
    description: "CalculateHaghParastari + لیست شبا",
    calcProcs: ["CalculateHaghParastari"],
    scriptSteps: ["EXEC AmarDB.CalculateHaghParastari(@TrId)", "اکسل شبا"],
    output: "excel_download",
    notes: "Ky=Mst_PARASTARI",
    requiresExistingTransaction: true,
  },
  {
    id: "mst-emdad",
    family: "mostamari",
    groupFa: "مستمری — محاسبه SQL",
    titleFa: "کمک هزینه امداد",
    description: "CalculateEmdad + بررسی شبا تکراری",
    calcProcs: ["CalculateEmdad"],
    scriptSteps: [
      "بررسی IBN تکراری (خواندنی)",
      "EXEC AmarDB.CalculateEmdad(@TrId)",
      "اکسل شبا",
    ],
    output: "excel_download",
    notes: "Ky=Mst_Emdad",
    requiresExistingTransaction: true,
  },
];

/** Exact options from Armaghan views/centers/makeovers/calc.html «نوع محاسبه». */
const ARMAGHAN_UI_ACTIONS: DiskType[] = [
  {
    id: "yrn-ui-shabane",
    family: "yarane",
    groupFa: "یارانه — نوع محاسبه ارمغان (calc.html)",
    titleFa: "محاسبه یارانه مراکز شبانه روزی",
    description: "همان گزینه shabane در مودال محاسبه ارمغان",
    makeOverType: "shabane",
    supplyLocationIds: [2],
    calcProcs: ["MakeOver.Calculate", "CalculateMarakezYarane"],
    scriptSteps: [
      "RegisterTransaction(title) — اگر TrId نباشد",
      "POST MakeOver/Calculate Type=shabane",
      "اختیاری: CalculateMarakezYarane(@TrId, SupplyLocationId=2)",
      "Diskette/GetListMakeover → تحویل مالی",
    ],
    output: "finance_handoff",
  },
  {
    id: "yrn-ui-roozane",
    family: "yarane",
    groupFa: "یارانه — نوع محاسبه ارمغان (calc.html)",
    titleFa: "محاسبه یارانه مراکز روزانه",
    description: "همان گزینه roozane در مودال محاسبه ارمغان",
    makeOverType: "roozane",
    supplyLocationIds: [9],
    calcProcs: ["MakeOver.Calculate", "CalculateMarakezYarane"],
    scriptSteps: [
      "RegisterTransaction(title) — اگر TrId نباشد",
      "POST MakeOver/Calculate Type=roozane",
      "اختیاری: CalculateMarakezYarane(@TrId, SupplyLocationId=9)",
      "Diskette/GetListMakeover → تحویل مالی",
    ],
    output: "finance_handoff",
  },
  {
    id: "yrn-ui-moraghebat",
    family: "yarane",
    groupFa: "یارانه — نوع محاسبه ارمغان (calc.html)",
    titleFa: "محاسبه یارانه مراکز مراقبت در منزل",
    description: "همان گزینه moraghebat در مودال محاسبه ارمغان",
    makeOverType: "moraghebat",
    supplyLocationIds: [8],
    calcProcs: ["MakeOver.Calculate", "CalculateMarakezYarane"],
    scriptSteps: [
      "RegisterTransaction(title) — اگر TrId نباشد",
      "POST MakeOver/Calculate Type=moraghebat",
      "CalculateMarakezYarane(@TrId, SupplyLocationId=8)",
      "Diskette/GetListMakeover → تحویل مالی",
    ],
    output: "finance_handoff",
  },
  {
    id: "yrn-ui-visit",
    family: "yarane",
    groupFa: "یارانه — نوع محاسبه ارمغان (calc.html)",
    titleFa: "محاسبه یارانه مراکز ویزیت در منزل",
    description: "همان گزینه visit در مودال محاسبه ارمغان",
    makeOverType: "visit",
    supplyLocationIds: [7],
    calcProcs: ["MakeOver.Calculate", "CalculateMarakezYarane"],
    scriptSteps: [
      "RegisterTransaction(title) — اگر TrId نباشد",
      "POST MakeOver/Calculate Type=visit",
      "CalculateMarakezYarane(@TrId, SupplyLocationId=7)",
      "Diskette/GetListMakeover → تحویل مالی",
    ],
    output: "finance_handoff",
  },
  {
    id: "yrn-ui-etiad",
    family: "yarane",
    groupFa: "یارانه — نوع محاسبه ارمغان (calc.html)",
    titleFa: "محاسبه یارانه مراکز ترک اعتیاد",
    description: "همان گزینه etiad در مودال محاسبه ارمغان (CBR / مدیریت مورد / …)",
    makeOverType: "etiad",
    supplyLocationIds: [39, 43, 50, 51],
    calcProcs: ["MakeOver.Calculate", "CalculateMarakezYarane"],
    scriptSteps: [
      "RegisterTransaction(title) — اگر TrId نباشد",
      "POST MakeOver/Calculate Type=etiad",
      "CalculateMarakezYarane با SupplyLocation مربوطه",
      "Diskette/GetListMakeover → تحویل مالی",
    ],
    output: "finance_handoff",
  },
  {
    id: "yrn-ui-list",
    family: "yarane",
    groupFa: "یارانه — نوع محاسبه ارمغان (calc.html)",
    titleFa: "تهیه لیست افراد",
    description: "همان گزینه list — روی تراکنش موجود Key2/CSV می‌سازد",
    makeOverType: "list",
    calcProcs: ["MakeOver.GetListMakeover"],
    scriptSteps: [
      "نیاز به شناسه تراکنش موجود",
      "POST MakeOver/Calculate Type=list  یا  Diskette/GetListMakeover?id=",
      "دانلود CSV افراد",
    ],
    output: "person_list_csv",
    requiresExistingTransaction: true,
  },
  {
    id: "yrn-ui-diskette",
    family: "yarane",
    groupFa: "یارانه — نوع محاسبه ارمغان (calc.html)",
    titleFa: "تهیه دیسکت بانک",
    description: "همان گزینه diskette — معمولاً ادامه با واحد مالی (Key3)",
    makeOverType: "diskette",
    calcProcs: ["MakeOver.GetMakeOver"],
    scriptSteps: [
      "نیاز به شناسه تراکنش موجود (پس از لیست)",
      "POST Diskette/GetMakeOver?id=",
      "دانلود دیسکت بانک (خارج از پنل ترجیحی)",
    ],
    output: "finance_handoff",
    requiresExistingTransaction: true,
    notes: "طبق brief مدیر: تحویل به مالی؛ دیسکت بانک اختیاری در پنل",
  },
];

const SUPPLY_DISK_TYPES: DiskType[] = ACTIVE_SUPPLY_LOCATIONS.map((s) => {
  const ui = uiTypeForSupply(s.keyword, s.id);
  return {
    id: `yrn-sl-${s.id}`,
    family: "yarane" as const,
    groupFa: "یارانه — محل تأمین (MakeOverSupplyLocation)",
    titleFa: s.titleFa,
    description: `SupplyLocationId=${s.id} · Keyword=${s.keyword}${ui ? ` · UI Type≈${ui}` : ""}`,
    makeOverType: ui,
    supplyLocationIds: [s.id],
    calcProcs: ["CalculateMarakezYarane", "MakeOver.Calculate"] as DiskType["calcProcs"],
    scriptSteps: [
      "RegisterTransaction(title) — اگر TrId نباشد (مثل دکمه جدید ارمغان)",
      `EXEC/API CalculateMarakezYarane(@TransactionId, @SupplyLocationId=${s.id})`,
      ui ? `یا POST MakeOver/Calculate Type=${ui}` : "MakeOver/Calculate با Type مناسب",
      "Diskette/GetListMakeover → تحویل مالی",
    ],
    output: "finance_handoff" as const,
    notes: s.keyword ?? undefined,
  };
});

/** Full selectable catalog for /request/new and /catalog. */
export const DISK_CATALOG: DiskType[] = [
  ...MOSTAMARI,
  ...ARMAGHAN_UI_ACTIONS,
  ...SUPPLY_DISK_TYPES,
];

export function getDiskType(id: string) {
  return DISK_CATALOG.find((d) => d.id === id);
}

export function catalogGroups() {
  const order = [
    "مستمری — محاسبه SQL",
    "یارانه — نوع محاسبه ارمغان (calc.html)",
    "یارانه — محل تأمین (MakeOverSupplyLocation)",
  ];
  const map = new Map<string, DiskType[]>();
  for (const d of DISK_CATALOG) {
    const g = d.groupFa || (d.family === "mostamari" ? "مستمری" : "یارانه");
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(d);
  }
  return order
    .filter((g) => map.has(g))
    .map((g) => ({ group: g, items: map.get(g)! }));
}
