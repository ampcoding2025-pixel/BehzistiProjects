import { filtersToQuery, type MgmtFilters } from "@/data/filters";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5088";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${body.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

function path(endpoint: string, filters: MgmtFilters) {
  return `/api/v1/management/${endpoint}${filtersToQuery(filters)}`;
}

export type ApiMeta = {
  source: string;
  generatedAt: string;
  periodLabel: string;
  warnings?: string[] | null;
};

export type ApiKpi = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  secondaryValue?: number | null;
  secondaryUnit?: string | null;
  previousValue?: number | null;
  deltaPercent?: number | null;
  tone: string;
  definition: string;
  confidence: string;
};

export type ApiNamed = { name: string; value: number };

export type ApiThroughput = {
  label: string;
  inflow: number;
  finished: number;
  netChange: number;
};

export type ApiTopicChange = {
  id: string;
  name: string;
  count: number;
  sharePercent: number;
  deltaPercent: number | null;
  trend: string;
  priority: string;
};

export type ApiAlert = {
  id: string;
  change: string;
  where: string;
  impact: string;
  suggestedReview: string;
  severity: string;
};

export type ApiPriority = {
  id: string;
  title: string;
  evidence: string;
  relatedUnitOrProvince: string;
  trend: string;
  suggestedAction: string;
};

export type OverviewData = {
  meta: ApiMeta;
  ruleSetVersion: string;
  kpis: ApiKpi[];
  throughputTrend: ApiThroughput[];
  topChangingTopics: ApiTopicChange[];
  topAttentionProvinces: ApiNamed[];
  alerts: ApiAlert[];
  priorities: ApiPriority[];
  mapMetric: { metricId: string; metricLabel: string; provinces: ApiNamed[] };
};

export type DemandData = {
  meta: ApiMeta;
  inflowTrend: ApiThroughput[];
  byClass: ApiNamed[];
  topics: ApiTopicChange[];
  topSubjects: ApiNamed[];
};

export type ResolutionData = {
  meta: ApiMeta;
  kpis: ApiKpi[];
  throughputTrend: ApiThroughput[];
  stepsDistribution: ApiNamed[];
  slaNote: string;
};

export type BacklogData = {
  meta: ApiMeta;
  kpis: ApiKpi[];
  ageBuckets: ApiNamed[];
  units: {
    name: string;
    openCount: number;
    medianAgeDays: number | null;
    over90: number;
    trend: string;
  }[];
  throughputTrend: ApiThroughput[];
};

export type ProvincesData = {
  meta: ApiMeta;
  provinces: {
    id: number;
    name: string;
    cases: number;
    complaintShare: number;
    finishRate: number;
    medianDays: number | null;
    openCount: number;
    pursuitRate: number;
  }[];
  selectedTrend: ApiNamed[];
};

export type QualityData = {
  meta: ApiMeta;
  ruleSetVersion: string;
  metrics: {
    id: string;
    label: string;
    fillPercent: number | null;
    status: string;
    note: string;
  }[];
  definitions: string[];
  qualityAlerts: ApiAlert[];
};

export type CriticalData = {
  meta: ApiMeta;
  issues: ApiTopicChange[];
  investigationSteps: string[];
  hypotheses: ApiAlert[];
};

export const managementApi = {
  overview: (f: MgmtFilters) => getJson<OverviewData>(path("overview", f)),
  demand: (f: MgmtFilters) => getJson<DemandData>(path("demand", f)),
  resolution: (f: MgmtFilters) => getJson<ResolutionData>(path("resolution", f)),
  backlog: (f: MgmtFilters) => getJson<BacklogData>(path("backlog", f)),
  provinces: (f: MgmtFilters) => getJson<ProvincesData>(path("provinces", f)),
  quality: (f: MgmtFilters) => getJson<QualityData>(path("quality", f)),
  critical: (f: MgmtFilters) => getJson<CriticalData>(path("critical", f)),
};
