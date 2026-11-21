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

function path(endpoint: string, filters: MgmtFilters, dateRange?: { from: string; to: string }) {
  const params = new URLSearchParams(filtersToQuery(filters));
  if (dateRange) {
    params.set("from", dateRange.from);
    params.set("to", dateRange.to);
  }
  const query = params.toString();
  return `/api/v1/management/${endpoint}${query ? `?${query}` : ""}`;
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
  byClass: { id: number; name: string; value: number }[];
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
    departmentId: number | null;
    name: string;
    inflowCount: number;
    finishedCount: number;
    finishRate: number;
    averageResolutionDays: number | null;
    openCount: number;
    averageAgeDays: number | null;
    ageLt7: number;
    age7To30: number;
    age30To90: number;
    over90: number;
    trend: string;
  }[];
  regions: {
    regionId: number;
    regionName: string;
    departmentId: number | null;
    ageLt7: number;
    age7To30: number;
    age30To90: number;
    over90: number;
  }[];
  stages: {
    regionId: number | null;
    regionName: string;
    statusId: number | null;
    stageName: string;
    caseCount: number;
    flowCount: number;
    averageStageDurationHours: number | null;
  }[];
  stageOperators: {
    regionId: number | null;
    regionName: string;
    statusId: number | null;
    stageName: string;
    operatorId: number;
    roleId: number | null;
    roleName: string;
    departmentId: number | null;
    departmentName: string;
    caseCount: number;
    flowCount: number;
    averageStageDurationHours: number | null;
  }[];
  operators: {
    operatorId: number;
    departmentId: number | null;
    departmentName: string;
    flowCount: number;
    casesHandled: number;
    completedFlows: number;
    averageElapsedHours: number | null;
    openCases: number;
    averageOpenAgeDays: number | null;
    openAgeLt7: number;
    openAge7To30: number;
    openAge30To90: number;
    openAge90Plus: number;
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
  demand: (f: MgmtFilters, dateRange?: { from: string; to: string }) =>
    getJson<DemandData>(path("demand", f, dateRange)),
  resolution: (f: MgmtFilters) => getJson<ResolutionData>(path("resolution", f)),
  backlog: (f: MgmtFilters, ageBucket?: string | null) => {
    const params = new URLSearchParams(filtersToQuery(f));
    if (ageBucket) params.set("ageBucket", ageBucket);
    return getJson<BacklogData>(`/api/v1/management/backlog?${params.toString()}`);
  },
  provinces: (f: MgmtFilters) => getJson<ProvincesData>(path("provinces", f)),
  quality: (f: MgmtFilters) => getJson<QualityData>(path("quality", f)),
  critical: (f: MgmtFilters) => getJson<CriticalData>(path("critical", f)),
};
