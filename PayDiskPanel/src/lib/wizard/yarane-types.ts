import { ACTIVE_SUPPLY_LOCATIONS } from "@/lib/supply-locations";

/** Ops-doc یارانه types (مراحل تهیه دیسکت یارانه مراکز) — primary picker. */
export type YaraneDocType = {
  supplyLocationId: number;
  titleFa: string;
  shortFa: string;
  fromDoc: boolean;
};

export const YARANE_DOC_TYPES: YaraneDocType[] = [
  { supplyLocationId: 2, shortFa: "شبانه روزی", titleFa: "یارانه مراکز غیر دولتی شبانه روزی توانبخشی", fromDoc: true },
  { supplyLocationId: 3, shortFa: "فرزندان / کودکان", titleFa: "یارانه فرزندان نگهداری‌شده در مراکز کودکان و نوجوانان", fromDoc: true },
  { supplyLocationId: 7, shortFa: "ویزیت در منزل", titleFa: "یارانه مراکز ارائه خدمات توانبخشی در منزل", fromDoc: true },
  { supplyLocationId: 8, shortFa: "مراقبت در منزل", titleFa: "یارانه مراکز مراقبت در منزل", fromDoc: true },
  { supplyLocationId: 9, shortFa: "روزانه توانبخشی", titleFa: "یارانه مراکز غیر دولتی روزانه توانبخشی", fromDoc: true },
  { supplyLocationId: 25, shortFa: "خانه حمایتی سالمندان", titleFa: "یارانه خانه‌های حمایتی توانبخشی سالمندان", fromDoc: true },
  { supplyLocationId: 35, shortFa: "خانه حمایتی روانی", titleFa: "یارانه خانه‌های حمایتی بیماران روانی مزمن", fromDoc: true },
  { supplyLocationId: 39, shortFa: "توانمندسازی اعتیاد", titleFa: "یارانه مراکز توانمندسازی و صیانت اجتماعی بهبودیافتگان اعتیاد", fromDoc: true },
  { supplyLocationId: 43, shortFa: "مدیریت مورد", titleFa: "یارانه مرکز مدیریت مورد", fromDoc: true },
  { supplyLocationId: 50, shortFa: "CBR شهری", titleFa: "برنامه توانبخشی مبتنی بر جامعه شهری (CBR)", fromDoc: true },
  { supplyLocationId: 51, shortFa: "CBR روستایی", titleFa: "برنامه توانبخشی مبتنی بر جامعه (CBR) روستایی", fromDoc: true },
  { supplyLocationId: 66, shortFa: "بهبود تغذیه روزانه", titleFa: "یارانه کمک‌هزینه بهبود تغذیه خدمت‌گیرندگان مراکز روزانه", fromDoc: true },
];

const DOC_IDS = new Set(YARANE_DOC_TYPES.map((t) => t.supplyLocationId));

/** Extra active MakeOverSupplyLocation rows not listed in the ops-doc monthly set. */
export const YARANE_EXTRA_TYPES: YaraneDocType[] = ACTIVE_SUPPLY_LOCATIONS.filter(
  (s) => !DOC_IDS.has(s.id),
).map((s) => ({
  supplyLocationId: s.id,
  shortFa: s.titleFa.length > 40 ? `${s.titleFa.slice(0, 38)}…` : s.titleFa,
  titleFa: s.titleFa,
  fromDoc: false,
}));

export function getYaraneDocType(supplyLocationId: number) {
  return (
    YARANE_DOC_TYPES.find((t) => t.supplyLocationId === supplyLocationId) ||
    YARANE_EXTRA_TYPES.find((t) => t.supplyLocationId === supplyLocationId) ||
    null
  );
}

export function isKnownYaraneSupply(supplyLocationId: number) {
  return !!getYaraneDocType(supplyLocationId);
}

export const WIZARD_STEPS = [
  { id: "family", label: "خانواده دیسکت", optional: false },
  { id: "type", label: "محل تأمین اعتبار", optional: false },
  { id: "calculate", label: "محاسبه", optional: false },
  { id: "check", label: "بررسی صحت", optional: false },
  { id: "list", label: "لیست افراد", optional: true },
  { id: "approve", label: "تایید", optional: false },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/** سقف/کف: تنظیمات › مبالغ یارانه (نه مرحله ویزارد). */

/** Infer where to open the wizard for an existing MakeOver transaction. */
export function inferWizardStep(opts: {
  payedRows: number;
  key2?: string | null;
}): WizardStepId {
  const hasList = opts.key2 != null && String(opts.key2).trim() !== "";
  if (hasList) return "approve";
  if (Number(opts.payedRows) > 0) return "check";
  return "calculate";
}

export function nextWizardStep(id: WizardStepId): WizardStepId | null {
  const i = WIZARD_STEPS.findIndex((s) => s.id === id);
  if (i < 0 || i >= WIZARD_STEPS.length - 1) return null;
  return WIZARD_STEPS[i + 1].id;
}
