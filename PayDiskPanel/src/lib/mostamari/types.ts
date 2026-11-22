import type { AllowedSqlProc } from "@/lib/worker/whitelist";
import { MOSTAMARI_KY_BY_TYPE } from "@/lib/auth/disk-types";

export type MostamariTypeId =
  | "mst-base"
  | "mst-hadafmandi"
  | "mst-hagh-family"
  | "mst-hagh-spinal"
  | "mst-emdad";

/**
 * Logical ops steps from «مراحل تهیه دیسکت مستمری».
 * Pipelines below pick which apply per transaction type.
 */
export type MostamariStepId =
  | "type"
  | "define"
  | "sayahMatch"
  | "calculate"
  | "report"
  | "ibn"
  | "payList"
  | "pairSync"
  | "bankPrep"
  | "approve"
  | "postPay";

export type MostamariStepDef = {
  id: MostamariStepId;
  /** Persian UI label */
  label: string;
  /** Short English (tooltips / docs) */
  labelEn: string;
  /** Operator may skip without blocking approve */
  optional?: boolean;
  /** Shown under the step panel */
  hintFa?: string;
  hintEn?: string;
};

export const MOSTAMARI_STEP_CATALOG: Record<MostamariStepId, MostamariStepDef> = {
  type: {
    id: "type",
    label: "نوع",
    labelEn: "Type",
  },
  define: {
    id: "define",
    label: "تعریف",
    labelEn: "Define",
  },
  sayahMatch: {
    id: "sayahMatch",
    label: "تطبیق شبا",
    labelEn: "Sayah Sheba match",
    hintFa:
      "قبل از محاسبه، تطبیق شبا و کد ملی در سامانه سیاح (بانک مرکزی) تا از عدم تطابق جلوگیری شود.",
    hintEn:
      "CBI Sayah Sheba↔NID match via NIX before Calculate — catch mismatches early.",
  },
  calculate: {
    id: "calculate",
    label: "محاسبه",
    labelEn: "Calculate",
  },
  report: {
    id: "report",
    label: "گزارش مبلغ",
    labelEn: "Money report",
    hintFa: "توزیع مبلغ و گزارش IsDead=0 قبل از اکسل.",
    hintEn: "Histogram by Money (+ IsDead=0). Catch bad amounts before Excel.",
  },
  ibn: {
    id: "ibn",
    label: "شبا تکراری",
    labelEn: "IBN duplicates",
    optional: true,
    hintFa: "بررسی حساب تکراری در IBN_AccountNumber قبل از لیست پرستاری/امداد.",
    hintEn:
      "Ops: check IBN_AccountNumber duplicates before nursing/emdad pay lists (double-pay risk).",
  },
  payList: {
    id: "payList",
    label: "لیست پرداخت",
    labelEn: "Pay list",
    hintFa: "نمونه PayedContinusPayment + شبا؛ NID به صورت text.",
    hintEn: "PayedContinusPayment + Sheba sample. Keep NID as text (leading zeros).",
  },
  pairSync: {
    id: "pairSync",
    label: "هم‌ترازی",
    labelEn: "Pair sync",
    optional: true,
    hintFa: "مقایسه مستمری ↔ افزایش؛ حذف تفاوت‌ها دستی و پس از ساعت کاری.",
    hintEn:
      "Compare base ↔ hadafmandi PersonIds. Diff DELETE stays manual/lab after hours.",
  },
  bankPrep: {
    id: "bankPrep",
    label: "دیسکت بانک",
    labelEn: "Bank disk prep",
    optional: true,
    hintFa: "فاقد شبا + فایل‌های ۱۰۰هزارتایی (خروجی آفلاین).",
    hintEn:
      "Null-IBN quarantine + 100k Excel chunks (export still offline). Skip if merged amounts / no disk.",
  },
  approve: {
    id: "approve",
    label: "تایید",
    labelEn: "Approve",
    hintFa: "ثبت Ky و Year=YYYYMM و پذیرنده. کنسل فقط Ky=CANCELLED.",
    hintEn: "SET Ky, Year=YYYYMM, Acceptor*. Cancelled → Ky=CANCELLED only.",
  },
  postPay: {
    id: "postPay",
    label: "پس از پرداخت",
    labelEn: "Post-pay",
    optional: true,
    hintFa: "برگشتی‌ها و یادآوری به‌روزرسانی سالانه مبالغ.",
    hintEn: "Returns (برگشتی) as negative Money; annual amount updates are yearly ops.",
  },
};

export type MostamariTypeDef = {
  id: MostamariTypeId;
  titleFa: string;
  shortFa: string;
  ky: string;
  proc: AllowedSqlProc;
  /** Pipeline after type is chosen (includes type as first step for stepper). */
  pipeline: MostamariStepId[];
  note?: string;
  noteEn?: string;
};

/**
 * Per-type orchestration from the ops document.
 * Optional steps appear in the pipeline but can be skipped in the UI.
 */
export const MOSTAMARI_TYPES: MostamariTypeDef[] = [
  {
    id: "mst-base",
    shortFa: "مستمری سازمان",
    titleFa: "مستمری از محل اعتبارات سازمان",
    ky: MOSTAMARI_KY_BY_TYPE["mst-base"],
    proc: "CalculateTransaction",
    pipeline: [
      "type",
      "define",
      "sayahMatch",
      "calculate",
      "report",
      "payList",
      "pairSync",
      "bankPrep",
      "approve",
      "postPay",
    ],
    note: "مستمری پایه؛ در صورت نیاز با افزایش هم‌تراز شود.",
  },
  {
    id: "mst-hadafmandi",
    shortFa: "افزایش مستمری",
    titleFa: "افزایش مستمری از محل هدفمندی",
    ky: MOSTAMARI_KY_BY_TYPE["mst-hadafmandi"],
    proc: "CalculateHadafmandi",
    pipeline: [
      "type",
      "define",
      "sayahMatch",
      "calculate",
      "report",
      "pairSync",
      "approve",
      "postPay",
    ],
    note: "در ۱۴۰۴ اغلب با مستمری تجمیع؛ برای سقف بودجه ممکن است دو تراکنش و کنسل یکی لازم باشد.",
  },
  {
    id: "mst-hagh-family",
    shortFa: "حق پرستاری خانواده",
    titleFa: "حق پرستاری خانواده محور",
    ky: MOSTAMARI_KY_BY_TYPE["mst-hagh-family"],
    proc: "CalculateHaghParastariFamily",
    pipeline: [
      "type",
      "define",
      "sayahMatch",
      "calculate",
      "report",
      "ibn",
      "payList",
      "bankPrep",
      "approve",
      "postPay",
    ],
    note: "همان مسیر تعریف؛ قبل از لیست، شباهای تکراری را بررسی کنید.",
  },
  {
    id: "mst-hagh-spinal",
    shortFa: "حق پرستاری نخاعی",
    titleFa: "حق پرستاری ضایعه نخاعی",
    ky: MOSTAMARI_KY_BY_TYPE["mst-hagh-spinal"],
    proc: "CalculateHaghParastari",
    pipeline: [
      "type",
      "define",
      "sayahMatch",
      "calculate",
      "report",
      "ibn",
      "payList",
      "bankPrep",
      "approve",
      "postPay",
    ],
    note: "همان مسیر تعریف؛ قبل از لیست، شباهای تکراری را بررسی کنید.",
  },
  {
    id: "mst-emdad",
    shortFa: "کمک هزینه امداد",
    titleFa: "کمک هزینه امداد",
    ky: MOSTAMARI_KY_BY_TYPE["mst-emdad"],
    proc: "CalculateEmdad",
    pipeline: [
      "type",
      "define",
      "sayahMatch",
      "calculate",
      "report",
      "ibn",
      "payList",
      "bankPrep",
      "approve",
      "postPay",
    ],
    note: "همان مسیر تعریف؛ شبا تکراری و به‌روزرسانی شبای مددجویان جدید.",
  },
];

/** Fallback stepper before a type is chosen. */
export const MOSTAMARI_STEPS_UNTIL_TYPE: MostamariStepId[] = ["type", "define"];

export function getMostamariType(id: string | null | undefined) {
  return MOSTAMARI_TYPES.find((t) => t.id === id) || null;
}

export function inferMostamariTypeFromKy(ky: string | null | undefined) {
  const k = (ky || "").trim();
  if (!k) return null;
  return MOSTAMARI_TYPES.find((t) => t.ky.toLowerCase() === k.toLowerCase()) || null;
}

/** Normalize Arabic/Persian letters + strip ZWNJ so title matching works on legacy titles. */
export function normalizeFaText(text: string) {
  return (text || "")
    .replace(/[\u200c\u200d\u200e\u200f\u0640]/g, "") // ZWNJ/ZWMJ/marks/tatweel
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

/**
 * Guess panel type from title/description when Ky is null (common on older txns).
 * Autism nursing → spinal pipeline (same CalculateHaghParastari family in ops).
 */
export function inferMostamariTypeFromTitle(
  text: string | null | undefined,
): MostamariTypeId | null {
  const t = normalizeFaText(String(text || ""));
  if (!t.trim()) return null;
  if (/خانواده|family|f_prstri|f-prstri/.test(t)) return "mst-hagh-family";
  if (/اتیسم|اوتيسم|اوتیسم|autism|otesm/.test(t)) return "mst-hagh-spinal";
  if (/نخاع|spinal|پرستاری|پرستاري|parastari|hagh/.test(t)) return "mst-hagh-spinal";
  if (/امداد|emdad/.test(t)) return "mst-emdad";
  if (/هدفمند|hadaf|افزایش|افزايش/.test(t)) return "mst-hadafmandi";
  if (/مستمری|مستمري|mostamari|mst_131500/.test(t)) return "mst-base";
  return null;
}

/** Ky first, then title/description. */
export function inferMostamariType(opts: {
  ky?: string | null;
  title?: string | null;
  description?: string | null;
}) {
  return (
    inferMostamariTypeFromKy(opts.ky) ||
    inferMostamariTypeFromTitle(
      `${opts.title || ""} ${opts.description || ""}`,
    ) ||
    null
  );
}

export function pipelineForType(typeId: MostamariTypeId | "" | null | undefined): MostamariStepDef[] {
  const t = typeId ? getMostamariType(typeId) : null;
  const ids =
    t?.pipeline ??
    ["type", "define", "sayahMatch", "calculate", "report", "payList", "approve"];
  return ids.map((id) => MOSTAMARI_STEP_CATALOG[id]);
}

export function stepIndexInPipeline(
  pipeline: MostamariStepDef[],
  id: MostamariStepId,
) {
  return pipeline.findIndex((s) => s.id === id);
}

export function nextPipelineStep(
  pipeline: MostamariStepDef[],
  id: MostamariStepId,
): MostamariStepId | null {
  const i = stepIndexInPipeline(pipeline, id);
  if (i < 0 || i >= pipeline.length - 1) return null;
  return pipeline[i + 1].id;
}

export function prevPipelineStep(
  pipeline: MostamariStepDef[],
  id: MostamariStepId,
): MostamariStepId | null {
  const i = stepIndexInPipeline(pipeline, id);
  if (i <= 0) return null;
  return pipeline[i - 1].id;
}

/** @deprecated use pipelineForType — kept for old imports */
export const MOSTAMARI_STEPS = pipelineForType("mst-base");

export function nextMostamariStep(id: MostamariStepId): MostamariStepId | null {
  return nextPipelineStep(MOSTAMARI_STEPS, id);
}

/** Convenience: nursing/emdad need IBN step in pipeline */
export function typeNeedsIbn(typeId: MostamariTypeId | "" | null) {
  const p = pipelineForType(typeId);
  return p.some((s) => s.id === "ibn");
}
