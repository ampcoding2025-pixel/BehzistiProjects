import type { AnalyticsQueryFilters } from "@/data/filters";

export type KpiTone = "neutral" | "positive" | "warning" | "critical";

/** Feasibility vs Didban field inspection — drives honest UI badges. */
export type KpiFeasibility =
  | "feasible"
  | "needs_rules"
  | "unavailable"
  | "illustrative";

export type ExecutiveKpi = {
  id: string;
  label: string;
  value: number | null;
  unit?: "count" | "percent" | "days";
  deltaPercent?: number;
  tone?: KpiTone;
  hint?: string;
  feasibility?: KpiFeasibility;
};

export type TimePoint = { label: string; requests: number; complaints: number };

export type NamedValue = { name: string; value: number; id?: number | null };

export type WorkloadUser = {
  id?: number | null;
  name: string;
  value: number;
  /** Average elapsed hours including still-open items (display). */
  avgHours?: number | null;
  /** Sum of elapsed hours across all items — zone ratio = value / totalHours. */
  totalHours?: number | null;
  /** Finished items in this aggregate; 0 = open-only. */
  finishedCount?: number;
  /** Average hours on finished items only — scorecard speed when available. */
  avgHoursFinished?: number | null;
};

export type Insight = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "attention" | "opportunity";
};

export type AnswerCoverage = {
  /** Share of cases with non-empty CookieFlowReplyCitizen (availability only). */
  historicalAvailablePercent: number;
  /** Null when regulation/version validity model does not exist in Didban. */
  currentlyValidPercent: number | null;
  needsReviewPercent: number | null;
  validityStatus: "unavailable" | "estimated" | "measured";
  caveat: string;
  /** Decision split — complaint / guidance / ex-voice */
  complaintAvailablePercent?: number | null;
  guidanceAvailablePercent?: number | null;
  complaintExVoiceAvailablePercent?: number | null;
  voiceNoiseComplaintCount?: number | null;
  voiceNoiseShareOfComplaintsPercent?: number | null;
  autoRegisterComplaintCount?: number | null;
  autoRegisterComplaintCoveragePercent?: number | null;
};

export type DecisionInsight = Insight & { priority?: string };

export type DataSourceKind = "mock" | "didban";

export type ExecutiveDashboardData = {
  meta: {
    source: DataSourceKind;
    label: string;
    periodLabel: string;
    generatedAt: string;
    domainNote: string;
  };
  kpis: ExecutiveKpi[];
  volumeTrend: TimePoint[];
  categoryDistribution: NamedValue[];
  classDistribution: NamedValue[];
  orgUnitPerformance: NamedValue[];
  resolutionStatus: NamedValue[];
  channelDistribution: NamedValue[];
  answerCoverage: AnswerCoverage;
  emergingTopics: {
    rank: number;
    topic: string;
    count: number;
    growthPercent: number | null;
  }[];
  insights: DecisionInsight[];
  /** One-sentence Ch.1 Big Idea from feasible facts only */
  bigIdea?: string;
  /** Cache TTL hint for near-real-time UX (seconds) */
  freshnessSeconds?: number;
};

export type RequestAnalyticsData = {
  meta: {
    source: DataSourceKind;
    label: string;
    periodLabel: string;
  };
  summary: ExecutiveKpi[];
  byClass: NamedValue[];
  bySubjectGroup: NamedValue[];
  byChannel: NamedValue[];
  byRegion: NamedValue[];
  /** Totals proxy: باز = CookieFinishTime null · بسته‌شده = filled */
  openClosed: NamedValue[];
  /** Monthly buckets by CookieTime: requests registered vs closed (FinishTime filled) */
  openClosedTrend: { label: string; requests: number; closed: number }[];
  periodComparison: { label: string; current: number; previous: number }[];
  byWorkflowStep: NamedValue[];
  byFlowActor: WorkloadUser[];
  byFlowReferred: WorkloadUser[];
  byCartableUser: WorkloadUser[];
  byCallUser: WorkloadUser[];
  byCaseUser: WorkloadUser[];
  repeatedCandidates: {
    id: string;
    subject: string;
    count: number;
    method: string;
    note: string;
  }[];
};

export type TaxonomyLevel = "zone" | "nature" | "group" | "subject";

export type CategorySample = {
  id: string;
  caption: string;
  className: string;
  status: string;
};

export type CategoryNode = {
  id: string;
  level: TaxonomyLevel;
  name: string;
  count: number;
  growthPercent: number;
  complaintSharePercent?: number;
  samples?: CategorySample[];
  children?: CategoryNode[];
};

export type CategoryExplorerData = {
  meta: {
    source: DataSourceKind;
    label: string;
    periodLabel: string;
    note: string;
  };
  summary: ExecutiveKpi[];
  tree: CategoryNode[];
};

export type TopicSample = {
  id: string;
  caption: string;
  className: string;
};

export type { AnalyticsQueryFilters } from "@/data/filters";

export type TopicCluster = {
  id: string;
  name: string;
  size: number;
  sharePercent: number;
  growthPercent: number | null;
  coherence: number;
  method: string;
  keywords: string[];
  linkedSubjectNames: string[];
  evolution: { label: string; count: number }[];
  samples: TopicSample[];
};

export type TopicRelationEdge = {
  source: string;
  target: string;
  weight: number;
  reason: string;
};

export type TopicExplorerData = {
  meta: {
    source: DataSourceKind;
    label: string;
    periodLabel: string;
    modelStatus: "planned" | "offline_batch" | "production" | "taxonomy_baseline";
    caveat: string;
  };
  summary: ExecutiveKpi[];
  clusters: TopicCluster[];
  relations: TopicRelationEdge[];
};

export type AnswerValidityStatus =
  | "available_unvalidated"
  | "validity_unknown"
  | "needs_expert_review"
  | "no_answer";

export type HistoricalAnswerCase = {
  id: string;
  requestCaption: string;
  requestClass: string;
  subjectName: string;
  departmentName: string;
  requestDate: string;
  answerDate: string | null;
  answerExcerpt: string | null;
  similarityScore: number | null;
  similarCaseId: string | null;
  validity: AnswerValidityStatus;
  validityNote: string;
};

export type CoverageDimensionRow = {
  id: string;
  name: string;
  eligible: number;
  withReply: number;
  coveragePercent: number;
};

export type AnswerIntelligenceData = {
  meta: {
    source: DataSourceKind;
    label: string;
    periodLabel: string;
    caveat: string;
  };
  summary: ExecutiveKpi[];
  coverageBreakdown: {
    totalEligible: number;
    withCitizenReply: number;
    withOperatorNoteOnly: number;
    withNoTextAnswer: number;
    currentlyValid: number | null;
    needsReview: number | null;
  };
  coverageTrend: { label: string; availablePercent: number }[];
  frequentAnswers: {
    id: string;
    topic: string;
    reuseCount: number;
    lastUsed: string;
    validity: AnswerValidityStatus;
  }[];
  cases: HistoricalAnswerCase[];
  /** Top volume dimensions with Availability % — for diagnosis / action */
  coverageByDepartment: CoverageDimensionRow[];
  coverageBySubject: CoverageDimensionRow[];
};

export type KpiGroup = "volume" | "resolution" | "operational" | "knowledge" | "ai" | "cx";

export type DictionaryFeasibility =
  | "feasible"
  | "needs_rules"
  | "weak_proxy"
  | "unavailable"
  | "planned_m2";

export type KpiDictionaryItem = {
  id: string;
  code: string;
  group: KpiGroup;
  name: string;
  definition: string;
  formula: string;
  requiredFields: string[];
  aggregation: string;
  timeDimension: string;
  filters: string[];
  interpretation: string;
  limitations: string;
  feasibility: DictionaryFeasibility;
  latestValue: number | null;
  unit: "count" | "percent" | "days" | "ratio";
  trend: { label: string; value: number }[];
};

export type KpiMonitoringData = {
  meta: {
    source: DataSourceKind;
    label: string;
    periodLabel: string;
    note: string;
  };
  counts: Record<DictionaryFeasibility, number>;
  items: KpiDictionaryItem[];
};

/** Relation-first catalog (docs/17) with live or mock measurements. */
export type RelationKpiFeasibility =
  | "feasible"
  | "needs_rules"
  | "weak_proxy"
  | "empty"
  | "audit";

export type RelationKpiTier = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";

export type RelationKpiChartType = "line" | "hbar" | "gauge" | "pie" | "none";

export type RelationKpiDrillDimension =
  | "department"
  | "region"
  | "channel"
  | "subjectClass"
  | "subject";

export type RelationKpiSeriesPoint = { label: string; value: number };

export type RelationKpiItem = {
  id: string;
  rank: number | null;
  tier: RelationKpiTier;
  tableGroup: string;
  name: string;
  definition: string;
  formula: string;
  tables: string;
  feasibility: RelationKpiFeasibility;
  value: number | null;
  unit: "count" | "percent" | "days" | "ratio";
  emptyBlocker: string | null;
  note: string | null;
  breakdown: NamedValue[] | null;
  chartType: RelationKpiChartType;
  series: RelationKpiSeriesPoint[] | null;
  drillDimensions: RelationKpiDrillDimension[];
};

export type RelationKpiCatalogData = {
  meta: {
    source: DataSourceKind;
    label: string;
    periodLabel: string;
    note: string;
    ruleSetVersion: string;
  };
  counts: Record<RelationKpiFeasibility, number>;
  items: RelationKpiItem[];
};

export type RelationKpiDrillPoint = {
  key: string;
  name: string;
  value: number;
  secondaryValue?: number | null;
};

export type RelationKpiDrillData = {
  code: string;
  dimension: RelationKpiDrillDimension;
  dimensionLabel: string;
  metricLabel: string;
  unit: "count" | "percent" | "days" | "ratio";
  canDrillFurther: boolean;
  nextDimension: RelationKpiDrillDimension | null;
  points: RelationKpiDrillPoint[];
  periodLabel: string;
};

export type ReportFormat = "pdf" | "xlsx";
export type ReportStatus = "ready_stub" | "needs_live_data" | "planned";

export type StandardReport = {
  id: string;
  name: string;
  description: string;
  category: "executive" | "category" | "unit" | "knowledge" | "period";
  formats: ReportFormat[];
  status: ReportStatus;
  lastGeneratedLabel: string;
  dependsOnKpis: string[];
};

export type ExportJob = {
  id: string;
  reportName: string;
  format: ReportFormat;
  requestedAt: string;
  status: "queued" | "done_stub" | "failed_stub";
  note: string;
};

export type ReportsCenterData = {
  meta: {
    source: "mock";
    label: string;
    note: string;
  };
  reports: StandardReport[];
  recentExports: ExportJob[];
};

export type AiMetricStatus = "not_measured" | "demo_placeholder" | "live";

export type AiMetricCard = {
  id: string;
  label: string;
  value: number | null;
  unit: "percent" | "count" | "ms" | "score";
  status: AiMetricStatus;
  hint: string;
};

export type AiPerformanceData = {
  meta: {
    source: "mock";
    label: string;
    modelName: string;
    modelVersion: string;
    lifecycle: "not_trained" | "offline_eval" | "shadow" | "production";
    caveat: string;
  };
  metrics: AiMetricCard[];
  confusionMatrix: {
    labels: string[];
    /** rows = actual, cols = predicted — demo placeholder only */
    matrix: number[][];
    status: AiMetricStatus;
  };
  confidenceBins: { label: string; count: number }[];
  driftSeries: { label: string; score: number | null }[];
  readinessChecklist: { id: string; label: string; done: boolean }[];
};

export type AdminRoleName =
  | "executive"
  | "analytics"
  | "supervisor"
  | "expert"
  | "admin";

export type AdminUser = {
  id: string;
  name: string;
  role: AdminRoleName;
  unit: string;
  status: "active" | "disabled";
  lastLoginLabel: string;
};

export type DataSourceItem = {
  id: string;
  name: string;
  engine: string;
  database: string;
  accessMode: "read_only" | "denied" | "unknown";
  status: "connected_stub" | "unreachable_stub" | "not_configured";
  note: string;
};

export type IntegrationCheck = {
  id: string;
  name: string;
  status: "ok_stub" | "warn_stub" | "fail_stub" | "pending";
  detail: string;
  checkedAt: string;
};

export type AuditLogItem = {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  result: "success" | "denied" | "error";
};

export type AdminSettings = {
  uiLanguage: string;
  defaultTheme: string;
  dataProvider: string;
  piiMasking: boolean;
  mockBanner: boolean;
  notes: string[];
};

export type AdminCenterData = {
  meta: {
    source: "mock";
    label: string;
    note: string;
  };
  users: AdminUser[];
  roles: { id: AdminRoleName; label: string; permissions: string[] }[];
  dataSources: DataSourceItem[];
  integrations: IntegrationCheck[];
  auditLogs: AuditLogItem[];
  settings: AdminSettings;
};

export type UserWorkloadRole =
  | "flowActor"
  | "referUser"
  | "cartableUser"
  | "callUser"
  | "caseUser";

export type UserRatePoint = {
  label: string;
  load: number;
  avgHours: number | null;
  /** load / avgHours when avgHours > 0 */
  rate: number | null;
};

export type UserRateTrendData = {
  userId: number;
  role: UserWorkloadRole;
  name: string;
  formula: string;
  periodLabel: string;
  points: UserRatePoint[];
};

export type UserWorkDistributionData = {
  userId: number;
  role: UserWorkloadRole;
  name: string;
  periodLabel: string;
  /** باز / بسته‌شده */
  byState: NamedValue[];
  /** CookieStatus or SubjectClass mix */
  byType: NamedValue[];
};

export type UserRequestItem = {
  cookieId: number;
  subject: string;
  stepName: string;
  hours: number | null;
  isOpen: boolean;
  startTime: string | null;
  finishTime: string | null;
};

export type UserRequestsData = {
  userId: number;
  role: UserWorkloadRole;
  name: string;
  periodLabel: string;
  items: UserRequestItem[];
  stepHoursOpen: NamedValue[];
  stepHoursClosed: NamedValue[];
};

export type CookieWorkflowStepState = "done" | "current" | "remaining" | "skipped";

export type CookieWorkflowStep = {
  order: number;
  statusId: number;
  name: string;
  state: CookieWorkflowStepState;
  startTime: string | null;
  finishTime: string | null;
  hours: number | null;
  /** Sum of dwell through this step (done/current only) */
  cumulativeHours: number | null;
};

export type CookieWorkflowData = {
  cookieId: number;
  subject: string;
  subjectClassName: string;
  isOpen: boolean;
  currentStepName: string | null;
  steps: CookieWorkflowStep[];
  pathNote: string;
  /** CookieTime → finish/now — total time in the system */
  lifetimeHours: number | null;
};

export interface AnalyticsDataProvider {
  getExecutiveDashboard(
    filters?: AnalyticsQueryFilters,
    opts?: { fresh?: boolean },
  ): Promise<ExecutiveDashboardData>;
  getRequestAnalytics(filters?: AnalyticsQueryFilters): Promise<RequestAnalyticsData>;
  getUserRateTrend(
    userId: number,
    role: UserWorkloadRole,
    filters?: AnalyticsQueryFilters,
  ): Promise<UserRateTrendData>;
  getUserWorkDistribution(
    userId: number,
    role: UserWorkloadRole,
    filters?: AnalyticsQueryFilters,
  ): Promise<UserWorkDistributionData>;
  getUserRequests(
    userId: number,
    role: UserWorkloadRole,
    filters?: AnalyticsQueryFilters,
  ): Promise<UserRequestsData>;
  getCookieWorkflow(cookieId: number): Promise<CookieWorkflowData>;
  getCategoryExplorer(filters?: AnalyticsQueryFilters): Promise<CategoryExplorerData>;
  getTopicExplorer(filters?: AnalyticsQueryFilters): Promise<TopicExplorerData>;
  getAnswerIntelligence(filters?: AnalyticsQueryFilters): Promise<AnswerIntelligenceData>;
  getKpiMonitoring(filters?: AnalyticsQueryFilters): Promise<KpiMonitoringData>;
  getRelationKpiCatalog(filters?: AnalyticsQueryFilters): Promise<RelationKpiCatalogData>;
  getRelationKpiDrill(
    code: string,
    dimension: RelationKpiDrillDimension,
    filters?: AnalyticsQueryFilters,
    parent?: { dimension: RelationKpiDrillDimension; key: string } | null,
  ): Promise<RelationKpiDrillData>;
  getReportsCenter(): Promise<ReportsCenterData>;
  getAiPerformance(): Promise<AiPerformanceData>;
  getAdminCenter(): Promise<AdminCenterData>;
}
