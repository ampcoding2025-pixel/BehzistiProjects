import type {
  RelationKpiCatalogData,
  RelationKpiDrillData,
  RelationKpiDrillDimension,
  RelationKpiItem,
} from "@/data/providers/types";

function item(
  partial: Omit<RelationKpiItem, "breakdown" | "emptyBlocker" | "note" | "series" | "drillDimensions" | "chartType"> &
    Partial<
      Pick<RelationKpiItem, "emptyBlocker" | "note" | "breakdown" | "series" | "drillDimensions" | "chartType">
    >,
): RelationKpiItem {
  return {
    ...partial,
    chartType: partial.chartType ?? "gauge",
    series: partial.series ?? null,
    drillDimensions: partial.drillDimensions ?? [],
    emptyBlocker: partial.emptyBlocker ?? null,
    note: partial.note ?? null,
    breakdown: partial.breakdown ?? null,
  };
}

const trend = [
  { label: "2025/01", value: 2100 },
  { label: "2025/02", value: 2300 },
  { label: "2025/03", value: 2500 },
  { label: "2025/04", value: 2400 },
  { label: "2025/05", value: 2600 },
  { label: "2025/06", value: 2700 },
];

const items: RelationKpiItem[] = [
  item({
    id: "V1",
    rank: 1,
    tier: "tier1",
    tableGroup: "G1",
    name: "کل پرونده‌ها",
    definition: "تعداد Cookie در بازه",
    formula: "COUNT(Cookie)",
    tables: "Cookie",
    feasibility: "feasible",
    value: 193086,
    unit: "count",
    chartType: "line",
    series: trend,
    drillDimensions: ["department", "region", "channel", "subjectClass", "subject"],
    breakdown: [
      { name: "واحد الف", value: 12000 },
      { name: "واحد ب", value: 9000 },
      { name: "واحد ج", value: 7000 },
    ],
  }),
  item({
    id: "V3",
    rank: 20,
    tier: "tier2",
    tableGroup: "G1",
    name: "ترکیب طبقات",
    definition: "SubjectClass mix",
    formula: "COUNT by SubjectClass",
    tables: "SubjectClass",
    feasibility: "feasible",
    value: 9470,
    unit: "count",
    chartType: "hbar",
    breakdown: [
      { name: "راهنمایی", value: 136000 },
      { name: "شکایت", value: 48000 },
      { name: "گزارش", value: 6800 },
    ],
    drillDimensions: ["department", "region", "channel"],
  }),
  item({
    id: "A1",
    rank: 12,
    tier: "tier2",
    tableGroup: "G4",
    name: "پوشش پاسخ شهروندی",
    definition: "% پرونده با CookieFlowReplyCitizen",
    formula: "CookiesWithReply/Total×100",
    tables: "CookieFlow",
    feasibility: "feasible",
    value: 6.3,
    unit: "percent",
    chartType: "line",
    series: trend.map((p) => ({ ...p, value: 5 + p.value / 1000 })),
    drillDimensions: ["department", "region", "channel", "subjectClass", "subject"],
  }),
  item({
    id: "R9",
    rank: null,
    tier: "tier5",
    tableGroup: "G2",
    name: "رعایت SLA واقعی",
    definition: "مهلت در برابر اتمام",
    formula: "*DeadlineTime",
    tables: "Cookie/Flow/Cartable",
    feasibility: "empty",
    value: null,
    unit: "count",
    chartType: "none",
    emptyBlocker: "ستون‌های DeadlineTime خالی هستند",
    note: "Can't calculate (empty)",
  }),
];

export const mockRelationKpiCatalog: RelationKpiCatalogData = {
  meta: {
    source: "mock",
    label: "کاتالوگ کامل شاخص‌ها — نسخه نمایشی",
    periodLabel: "دوره نمایشی",
    note: "برای اندازه‌گیری زنده، حالت API را فعال کنید.",
    ruleSetVersion: "mock-relation-catalog",
  },
  counts: {
    feasible: items.filter((i) => i.feasibility === "feasible").length,
    needs_rules: items.filter((i) => i.feasibility === "needs_rules").length,
    weak_proxy: items.filter((i) => i.feasibility === "weak_proxy").length,
    empty: items.filter((i) => i.feasibility === "empty").length,
    audit: items.filter((i) => i.feasibility === "audit").length,
  },
  items,
};

export function mockRelationKpiDrill(
  code: string,
  dimension: RelationKpiDrillDimension,
): RelationKpiDrillData {
  const labels: Record<RelationKpiDrillDimension, string> = {
    department: "واحد سازمانی",
    region: "استان",
    channel: "کانال",
    subjectClass: "طبقه موضوع",
    subject: "موضوع",
  };
  return {
    code,
    dimension,
    dimensionLabel: labels[dimension],
    metricLabel: "مقدار نمایشی",
    unit: "count",
    canDrillFurther: dimension !== "subject",
    nextDimension: dimension === "region" ? "department" : dimension === "department" ? "subject" : null,
    periodLabel: "دوره نمایشی",
    points: [
      { key: "1", name: "نمونه الف", value: 4200 },
      { key: "2", name: "نمونه ب", value: 3100 },
      { key: "3", name: "نمونه ج", value: 1800 },
    ],
  };
}
