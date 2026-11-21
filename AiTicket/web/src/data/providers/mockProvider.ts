import { mockAdminCenter } from "@/data/mock/admin";
import { mockAiPerformance } from "@/data/mock/aiPerformance";
import { mockAnswerIntelligence } from "@/data/mock/answers";
import { mockCategoryExplorer } from "@/data/mock/categories";
import { mockExecutiveDashboard } from "@/data/mock/executive";
import { mockKpiMonitoring } from "@/data/mock/kpiCatalog";
import { mockRelationKpiCatalog, mockRelationKpiDrill } from "@/data/mock/relationKpiCatalog";
import { mockReportsCenter } from "@/data/mock/reports";
import { mockRequestAnalytics } from "@/data/mock/requests";
import { mockTopicExplorer } from "@/data/mock/topics";
import type { AnalyticsQueryFilters } from "@/data/filters";
import type {
  AdminCenterData,
  AiPerformanceData,
  AnalyticsDataProvider,
  AnswerIntelligenceData,
  CategoryExplorerData,
  ExecutiveDashboardData,
  KpiMonitoringData,
  RelationKpiCatalogData,
  RelationKpiDrillData,
  RelationKpiDrillDimension,
  ReportsCenterData,
  RequestAnalyticsData,
  TopicExplorerData,
  CookieWorkflowData,
  UserRateTrendData,
  UserRequestsData,
  UserWorkDistributionData,
  UserWorkloadRole,
} from "@/data/providers/types";

export const mockAnalyticsProvider: AnalyticsDataProvider = {
  async getExecutiveDashboard(
    _filters?: AnalyticsQueryFilters,
    _opts?: { fresh?: boolean },
  ): Promise<ExecutiveDashboardData> {
    await new Promise((r) => setTimeout(r, 120));
    return {
      ...mockExecutiveDashboard,
      bigIdea:
        "نسخه نمایشی: حجم و پوشش دانش برای طراحی UI است — برای تصمیم عملیاتی به حالت API وصل شوید.",
      emergingTopics: mockExecutiveDashboard.emergingTopics.map((t) => ({
        ...t,
        growthPercent: null,
      })),
    };
  },
  async getUserRateTrend(
    userId: number,
    role: UserWorkloadRole,
    _filters?: AnalyticsQueryFilters,
  ): Promise<UserRateTrendData> {
    await new Promise((r) => setTimeout(r, 80));
    const actor =
      mockRequestAnalytics.byFlowActor.find((u) => u.id === userId) ??
      mockRequestAnalytics.byCartableUser.find((u) => u.id === userId);
    const baseLoad = actor?.value ?? 400;
    const baseHours = actor?.avgHours ?? 2.5;
    const months = ["2025/06", "2025/07", "2025/08", "2025/09", "2025/10", "2025/11"];
    return {
      userId,
      role,
      name: actor?.name ?? `کاربر ${userId}`,
      formula: "نرخ = حجم ÷ میانگین ساعت (بار کاری بر واحد زمان)",
      periodLabel: "۶ ماه اخیر (mock)",
      points: months.map((label, i) => {
        const load = Math.round(baseLoad * (0.75 + i * 0.05));
        const avgHours = Math.max(0.8, Number(baseHours) + (i % 3) * 0.3 - 0.2);
        return { label, load, avgHours, rate: load / avgHours };
      }),
    };
  },

  async getUserWorkDistribution(
    userId: number,
    role: UserWorkloadRole,
    _filters?: AnalyticsQueryFilters,
  ): Promise<UserWorkDistributionData> {
    await new Promise((r) => setTimeout(r, 60));
    const actor =
      mockRequestAnalytics.byFlowActor.find((u) => u.id === userId) ??
      mockRequestAnalytics.byCartableUser.find((u) => u.id === userId);
    const total = actor?.value ?? 200;
    const closed = Math.round(total * 0.62);
    return {
      userId,
      role,
      name: actor?.name ?? `کاربر ${userId}`,
      periodLabel: "بازه فعلی (mock)",
      byState: [
        { name: "بسته‌شده", value: closed },
        { name: "باز", value: Math.max(0, total - closed) },
      ],
      byType: [
        { name: "رسیدگی توسط پردازش", value: Math.round(total * 0.4) },
        { name: "تایید نهایی", value: Math.round(total * 0.25) },
        { name: "انجام شد", value: Math.round(total * 0.2) },
        { name: "سایر", value: Math.round(total * 0.15) },
      ],
    };
  },

  async getCookieWorkflow(cookieId: number): Promise<CookieWorkflowData> {
    await new Promise((r) => setTimeout(r, 50));
    const isOpen = cookieId % 3 === 0;
    const names = ["ثبت", "ارجاع", "رسیدگی", "تایید نهایی", "انجام شد"];
    const currentIdx = isOpen ? 2 : names.length - 1;
    const dwell = [4, 12, 30, 8, 6];
    return {
      cookieId,
      subject: `موضوع نمونه ${cookieId}`,
      subjectClassName: "شکایت",
      isOpen,
      currentStepName: names[currentIdx]!,
      pathNote: "مسیر نمایشی از پرونده‌های بسته‌شده هم‌طبقه",
      lifetimeHours: dwell.slice(0, currentIdx + 1).reduce((a, b) => a + b, 0) + (isOpen ? 5 : 0),
      steps: names.map((name, i) => {
        const skipped = i === 1 && currentIdx > 1;
        const state = skipped
          ? ("skipped" as const)
          : !isOpen || i < currentIdx
            ? ("done" as const)
            : i === currentIdx
              ? ("current" as const)
              : ("remaining" as const);
        return {
          order: i + 1,
          statusId: 10 + i,
          name,
          state,
          startTime:
            !skipped && i <= currentIdx ? new Date(2025, 9, 1 + i).toISOString() : null,
          finishTime:
            !skipped && (i < currentIdx || !isOpen)
              ? new Date(2025, 9, 1 + i, 6).toISOString()
              : null,
          hours: !skipped && i <= currentIdx ? dwell[i]! : null,
          cumulativeHours:
            !skipped && i <= currentIdx
              ? Number(
                  dwell
                    .slice(0, i + 1)
                    .reduce((a, b, idx) => a + (idx === 1 && currentIdx > 1 ? 0 : b), 0)
                    .toFixed(1),
                )
              : null,
        };
      }),
    };
  },

  async getUserRequests(
    userId: number,
    role: UserWorkloadRole,
    _filters?: AnalyticsQueryFilters,
  ): Promise<UserRequestsData> {
    await new Promise((r) => setTimeout(r, 70));
    const actor =
      mockRequestAnalytics.byFlowActor.find((u) => u.id === userId) ??
      mockRequestAnalytics.byCartableUser.find((u) => u.id === userId);
    const name = actor?.name ?? `کاربر ${userId}`;
    const steps = ["رسیدگی توسط پردازش", "تایید نهایی", "انجام شد", "ارجاع"];
    const items = Array.from({ length: 12 }, (_, i) => {
      const isOpen = i % 3 === 0;
      const start = new Date(2025, 9, 1 + i);
      return {
        cookieId: 1000 + userId * 10 + i,
        subject: `موضوع نمونه ${i + 1}`,
        stepName: steps[i % steps.length]!,
        hours: Number((2 + (i % 5) * 1.4).toFixed(1)),
        isOpen,
        startTime: start.toISOString(),
        finishTime: isOpen ? null : new Date(start.getTime() + 36e5 * (3 + i)).toISOString(),
      };
    });
    const sumBy = (open: boolean) =>
      steps.map((step) => ({
        name: step,
        value: items
          .filter((x) => x.isOpen === open && x.stepName === step)
          .reduce((s, x) => s + (x.hours ?? 0), 0),
      })).filter((r) => r.value > 0);
    return {
      userId,
      role,
      name,
      periodLabel: "بازه فعلی (mock)",
      items,
      stepHoursOpen: sumBy(true),
      stepHoursClosed: sumBy(false),
    };
  },

  async getRequestAnalytics(filters?: AnalyticsQueryFilters): Promise<RequestAnalyticsData> {
    await new Promise((r) => setTimeout(r, 120));
    const base = mockRequestAnalytics;
    if (!filters) return base;

    const byClass =
      filters.subjectClassId == null
        ? base.byClass
        : base.byClass.filter((c) => c.id === filters.subjectClassId);
    const byChannel =
      filters.channelId == null
        ? base.byChannel
        : base.byChannel.filter((c) => c.id === filters.channelId);
    const byRegion =
      filters.regionId == null
        ? base.byRegion
        : base.byRegion.filter((c) => c.id === filters.regionId);
    const bySubjectGroup =
      filters.subjectGroupId == null
        ? base.bySubjectGroup
        : base.bySubjectGroup.filter((c) => c.id === filters.subjectGroupId);

    const total = byClass.reduce((s, r) => s + r.value, 0) || base.summary[0]?.value || 0;
    const complaints =
      byClass.find((c) => c.id === 1)?.value ??
      (filters.subjectClassId === 1 ? total : Math.round(total * 0.24));
    const guidance =
      byClass.find((c) => c.name.includes("راهنمایی"))?.value ?? Math.round(total * 0.68);

    const closed = Math.round(Number(total) * 0.85);
    const open = Math.max(0, Number(total) - closed);

    return {
      ...base,
      meta: {
        ...base.meta,
        label: `${base.meta.label} · فیلتر نمایشی`,
      },
      summary: [
        { ...base.summary[0], value: total },
        { ...base.summary[1], value: complaints },
        {
          ...base.summary[2],
          value: total ? Math.round((1000 * complaints) / total) / 10 : 0,
        },
        {
          ...base.summary[3],
          value: total ? Math.round((1000 * guidance) / total) / 10 : 0,
        },
      ],
      byClass,
      byChannel,
      byRegion,
      bySubjectGroup,
      openClosed: [
        { name: "باز", value: open },
        { name: "بسته‌شده", value: closed },
      ],
      openClosedTrend: base.openClosedTrend.map((p) => ({
        ...p,
        requests: Math.max(1, Math.round(p.requests * (Number(total) / 12480))),
        closed: Math.max(0, Math.round(p.closed * (closed / 10620))),
      })),
      byWorkflowStep:
        filters.cookieStatusId == null
          ? base.byWorkflowStep
          : base.byWorkflowStep.filter((s) => s.id === filters.cookieStatusId),
      byFlowActor:
        filters.flowUserId == null
          ? base.byFlowActor
          : base.byFlowActor.filter((s) => s.id === filters.flowUserId),
      byFlowReferred: base.byFlowReferred,
      byCartableUser:
        filters.cartableUserId == null
          ? base.byCartableUser
          : base.byCartableUser.filter((s) => s.id === filters.cartableUserId),
      byCallUser:
        filters.callUserId == null
          ? base.byCallUser
          : base.byCallUser.filter((s) => s.id === filters.callUserId),
      byCaseUser:
        filters.caseUserId == null
          ? base.byCaseUser
          : base.byCaseUser.filter((s) => s.id === filters.caseUserId),
      periodComparison: byClass.map((row) => ({
        label: row.name,
        current: row.value,
        previous: Math.round(row.value * 1.02),
      })),
    };
  },
  async getCategoryExplorer(_filters?: AnalyticsQueryFilters): Promise<CategoryExplorerData> {
    await new Promise((r) => setTimeout(r, 120));
    return mockCategoryExplorer;
  },
  async getTopicExplorer(_filters?: AnalyticsQueryFilters): Promise<TopicExplorerData> {
    await new Promise((r) => setTimeout(r, 120));
    return mockTopicExplorer;
  },
  async getAnswerIntelligence(_filters?: AnalyticsQueryFilters): Promise<AnswerIntelligenceData> {
    await new Promise((r) => setTimeout(r, 120));
    return mockAnswerIntelligence;
  },
  async getKpiMonitoring(_filters?: AnalyticsQueryFilters): Promise<KpiMonitoringData> {
    await new Promise((r) => setTimeout(r, 120));
    return mockKpiMonitoring;
  },
  async getRelationKpiCatalog(_filters?: AnalyticsQueryFilters): Promise<RelationKpiCatalogData> {
    await new Promise((r) => setTimeout(r, 120));
    return mockRelationKpiCatalog;
  },
  async getRelationKpiDrill(
    code: string,
    dimension: RelationKpiDrillDimension,
    _filters?: AnalyticsQueryFilters,
    _parent?: { dimension: RelationKpiDrillDimension; key: string } | null,
  ): Promise<RelationKpiDrillData> {
    await new Promise((r) => setTimeout(r, 80));
    return mockRelationKpiDrill(code, dimension);
  },
  async getReportsCenter(): Promise<ReportsCenterData> {
    await new Promise((r) => setTimeout(r, 120));
    return mockReportsCenter;
  },
  async getAiPerformance(): Promise<AiPerformanceData> {
    await new Promise((r) => setTimeout(r, 120));
    return mockAiPerformance;
  },
  async getAdminCenter(): Promise<AdminCenterData> {
    await new Promise((r) => setTimeout(r, 120));
    return mockAdminCenter;
  },
};
