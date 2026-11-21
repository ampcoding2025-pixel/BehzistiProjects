"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/EChart";
import { KpiCard } from "@/components/ui/KpiCard";
import { Panel } from "@/components/ui/Panel";
import { managementApi, type BacklogData } from "@/data/api";
import { useFilters } from "@/data/FilterContext";
import { formatFaNumber, formatFaPercent } from "@/lib/utils";

export function BacklogPage() {
  const router = useRouter();
  const { filters, setDepartmentId } = useFilters();
  const [data, setData] = useState<BacklogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgeId, setSelectedAgeId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [selectedWorkflowRegionId, setSelectedWorkflowRegionId] = useState<number | null>(null);
  const [selectedStageKey, setSelectedStageKey] = useState<string | null>(null);
  const [operatorSearch, setOperatorSearch] = useState("");
  const [operatorPage, setOperatorPage] = useState(0);
  const ageBucket = selectedAgeId?.startsWith("age-") ? selectedAgeId : null;
  const workflowRegionId = selectedWorkflowRegionId ?? filters.regionId;
  const statusKey = (statusId: number | null) => statusId == null ? "unknown" : String(statusId);

  const selectedUnit = data?.units.find((unit) => unit.departmentId === selectedDepartmentId);
  const ageValue = (row: BacklogData["units"][number]) => {
    switch (selectedAgeId) {
      case "age-lt7": return row.ageLt7;
      case "age-7-30": return row.age7To30;
      case "age-30-90": return row.age30To90;
      case "age-90p": return row.over90;
      default: return row.openCount;
    }
  };
  const regionAgeValue = (row: BacklogData["regions"][number]) => {
    switch (selectedAgeId) {
      case "age-lt7": return row.ageLt7;
      case "age-7-30": return row.age7To30;
      case "age-30-90": return row.age30To90;
      case "age-90p": return row.over90;
      default: return row.ageLt7 + row.age7To30 + row.age30To90 + row.over90;
    }
  };
  const topUnits = useMemo(
    () => [...(data?.units ?? [])]
      .sort((a, b) => ageValue(a) - ageValue(b))
      .slice(-12),
    [data, selectedAgeId],
  );
  const regionRows = useMemo(() => {
    const grouped = new Map<number, { name: string; value: number }>();
    for (const row of data?.regions ?? []) {
      if (selectedDepartmentId != null && row.departmentId !== selectedDepartmentId) continue;
      const current = grouped.get(row.regionId) ?? { name: row.regionName, value: 0 };
      current.value += regionAgeValue(row);
      grouped.set(row.regionId, current);
    }
    return [...grouped.entries()]
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => a.value - b.value);
  }, [data, selectedAgeId, selectedDepartmentId]);

  const ageRows = useMemo(() => {
    if (!selectedUnit) return data?.ageBuckets ?? [];
    return [
      { name: "کمتر از ۷ روز", value: selectedUnit.ageLt7 },
      { name: "۷ تا ۳۰ روز", value: selectedUnit.age7To30 },
      { name: "۳۰ تا ۹۰ روز", value: selectedUnit.age30To90 },
      { name: "بیش از ۹۰ روز", value: selectedUnit.over90 },
    ];
  }, [data, selectedUnit]);
  const stageRows = useMemo(
    () => (data?.stages ?? [])
      .filter((stage) => workflowRegionId == null || stage.regionId === workflowRegionId)
      .sort((a, b) => b.caseCount - a.caseCount || b.flowCount - a.flowCount),
    [data, workflowRegionId],
  );
  const stageOperatorRows = useMemo(
    () => (data?.stageOperators ?? [])
      .filter((operator) => workflowRegionId == null || operator.regionId === workflowRegionId)
      .filter((operator) => selectedStageKey == null || statusKey(operator.statusId) === selectedStageKey)
      .filter((operator) => selectedDepartmentId == null || operator.departmentId === selectedDepartmentId)
      .sort((a, b) => b.caseCount - a.caseCount ||
        (b.averageStageDurationHours ?? -1) - (a.averageStageDurationHours ?? -1)),
    [data, selectedDepartmentId, selectedStageKey, workflowRegionId],
  );
  const operatorRows = useMemo(() => {
    const search = operatorSearch.trim();
    return (data?.operators ?? [])
      .filter((operator) => selectedDepartmentId == null || operator.departmentId === selectedDepartmentId)
      .filter((operator) => {
        if (!search) return true;
        return String(operator.operatorId).includes(search) ||
          operator.departmentName.toLocaleLowerCase("fa").includes(search.toLocaleLowerCase("fa"));
      })
      .filter((operator) => {
        switch (selectedAgeId) {
          case "age-lt7": return operator.openAgeLt7 > 0;
          case "age-7-30": return operator.openAge7To30 > 0;
          case "age-30-90": return operator.openAge30To90 > 0;
          case "age-90p": return operator.openAge90Plus > 0;
          default: return true;
        }
      })
      .sort((a, b) => b.openCases - a.openCases ||
        (b.averageElapsedHours ?? -1) - (a.averageElapsedHours ?? -1));
  }, [data, operatorSearch, selectedAgeId, selectedDepartmentId]);
  const operatorPageSize = 50;
  const operatorPageCount = Math.max(1, Math.ceil(operatorRows.length / operatorPageSize));
  const currentOperatorPage = Math.min(operatorPage, operatorPageCount - 1);
  const visibleOperatorRows = operatorRows.slice(
    currentOperatorPage * operatorPageSize,
    (currentOperatorPage + 1) * operatorPageSize,
  );

  useEffect(() => {
    let alive = true;
    managementApi
      .backlog(filters, ageBucket)
      .then((r) => alive && setData(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "خطا"));
    return () => {
      alive = false;
    };
  }, [filters, ageBucket]);

  useEffect(() => {
    setSelectedWorkflowRegionId(null);
    setSelectedStageKey(null);
  }, [filters.regionId]);

  const ageOpt = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: ageRows.map((b) => b.name) },
      yAxis: { type: "value" },
      series: [{
        type: "bar",
        data: ageRows.map((bucket) => ({
          value: bucket.value,
          itemStyle: {
            color: bucket.name === data.kpis.find((kpi) => kpi.id === selectedAgeId)?.label ? "#1d4ed8" : "#c2410c",
          },
        })),
        itemStyle: { color: "#c2410c" },
      }],
    };
  }, [ageRows, data, selectedAgeId]);

  const unitOpt = useMemo<EChartsOption>(() => {
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 150, right: 40, top: 8, bottom: 24 },
      xAxis: { type: "value" },
      yAxis: {
        type: "category",
        data: topUnits.map((r) => r.name),
        axisLabel: { width: 140, overflow: "truncate" },
      },
      series: [{
        type: "bar",
        data: topUnits.map((unit) => ({
          value: ageValue(unit),
          itemStyle: { color: unit.departmentId === selectedDepartmentId ? "#15803d" : "#1d4ed8" },
        })),
        barWidth: 12,
      }],
    };
  }, [topUnits, selectedAgeId, selectedDepartmentId]);

  const regionOpt = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 120, right: 40, top: 8, bottom: 24 },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      data: regionRows.map((row) => row.name),
      axisLabel: { width: 110, overflow: "truncate" },
    },
    series: [{
      type: "bar",
      data: regionRows.map((row) => ({
        value: row.value,
        itemStyle: { color: row.id === workflowRegionId ? "#15803d" : "#0f766e" },
      })),
      barWidth: 12,
    }],
  }), [regionRows, workflowRegionId]);

  const stageOpt = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 165, right: 36, top: 8, bottom: 24 },
    legend: { data: ["پرونده‌های یکتا", "میانگین زمان مرحله (ساعت)"], top: 0 },
    yAxis: {
      type: "category",
      data: stageRows.map((row) => row.stageName),
      axisLabel: { width: 150, overflow: "truncate" },
    },
    xAxis: [
    { type: "value", name: "پرونده", position: "bottom" },
    { type: "value", name: "میانگین ساعت", position: "top", splitLine: { show: false } },
    ],
    series: [
    {
      name: "پرونده‌های یکتا",
      type: "bar",
      xAxisIndex: 0,
      data: stageRows.map((row) => ({
        name: row.stageName,
        value: row.caseCount,
        itemStyle: {
          color: statusKey(row.statusId) === selectedStageKey ? "#15803d" : "#7c3aed",
        },
      })),
      barWidth: 14,
    },
    {
      name: "میانگین زمان مرحله (ساعت)",
      type: "line",
      xAxisIndex: 1,
      data: stageRows.map((row) => ({
        name: row.stageName,
        value: row.averageStageDurationHours,
      })),
      symbolSize: 7,
      itemStyle: { color: "#ea580c" },
      lineStyle: { color: "#ea580c", width: 2 },
    },
    ],
  }), [selectedStageKey, stageRows]);

  if (error) return <pre className="rounded-lg bg-red-50 p-4 text-xs text-red-900 whitespace-pre-wrap">{error}</pre>;
  if (!data) return <div className="py-20 text-center text-sm text-[var(--muted)]">در حال بارگذاری…</div>;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {data.kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            {...kpi}
            onClick={() => {
              setSelectedAgeId((current) => current === kpi.id ? null : kpi.id);
              setSelectedDepartmentId(null);
              setSelectedWorkflowRegionId(null);
              setSelectedStageKey(null);
              setOperatorPage(0);
            }}
            selected={selectedAgeId === kpi.id}
          />
        ))}
      </section>
      {selectedAgeId || selectedDepartmentId != null || selectedWorkflowRegionId != null || selectedStageKey != null ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {selectedAgeId ? (
            <span className="rounded bg-blue-50 px-2 py-1 text-blue-800">
              بازه سن: {data.kpis.find((kpi) => kpi.id === selectedAgeId)?.label}
            </span>
          ) : null}
          {selectedUnit ? (
            <span className="rounded bg-green-50 px-2 py-1 text-green-800">
              واحد: {selectedUnit.name}
            </span>
          ) : null}
          {selectedWorkflowRegionId != null ? (
            <span className="rounded bg-teal-50 px-2 py-1 text-teal-800">
              استان تحلیل گردش: {regionRows.find((row) => row.id === selectedWorkflowRegionId)?.name ?? selectedWorkflowRegionId}
            </span>
          ) : null}
          {selectedStageKey != null ? (
            <span className="rounded bg-violet-50 px-2 py-1 text-violet-800">
              مرحله: {stageRows.find((row) => statusKey(row.statusId) === selectedStageKey)?.stageName ?? "انتخاب‌شده"}
            </span>
          ) : null}
          <button
            type="button"
            className="text-blue-700 underline"
            onClick={() => {
              setSelectedAgeId(null);
              setSelectedDepartmentId(null);
              setSelectedWorkflowRegionId(null);
              setSelectedStageKey(null);
              setOperatorPage(0);
            }}
          >
            پاک کردن انتخاب نمودارها
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="سن پرونده‌های باز" subtitle={selectedUnit ? `توزیع سن در ${selectedUnit.name}` : undefined}>
          <EChart
            option={ageOpt}
            height={280}
            onEvents={{
              click: (event) => {
                const index = (event as { dataIndex?: number }).dataIndex;
                const ageIds = ["age-lt7", "age-7-30", "age-30-90", "age-90p"];
                const ageId = index == null ? undefined : ageIds[index];
                if (ageId) {
                  setSelectedAgeId((current) => current === ageId ? null : ageId);
                  setSelectedDepartmentId(null);
                  setSelectedWorkflowRegionId(null);
                  setSelectedStageKey(null);
                  setOperatorPage(0);
                }
              },
            }}
          />
        </Panel>
        <Panel
          title="تمرکز بار کاری واحدها"
          subtitle={`${selectedAgeId ? `فقط ${data.kpis.find((kpi) => kpi.id === selectedAgeId)?.label} · ` : ""}برای انتخاب واحد روی میله کلیک کنید`}
        >
          <EChart
            option={unitOpt}
            height={320}
            onEvents={{
              click: (p) => {
                const point = p as { dataIndex?: number; name?: string };
                const unit =
                  topUnits.find((row) => row.name === point.name) ??
                  (point.dataIndex == null ? undefined : topUnits[point.dataIndex]);
                if (unit?.departmentId != null) {
                  setSelectedDepartmentId((current) => current === unit.departmentId ? null : unit.departmentId);
                  setOperatorPage(0);
                }
              },
            }}
          />
        </Panel>
        <Panel
          title="توزیع پرونده‌های باز بر اساس استان"
          subtitle={`${selectedUnit ? `واحد ${selectedUnit.name} · ` : ""}${selectedAgeId ? data.kpis.find((kpi) => kpi.id === selectedAgeId)?.label : "همه سن‌ها"} · کلیک روی استان برای فیلتر`}
        >
          <EChart
            option={regionOpt}
            height={Math.max(320, Math.min(850, regionRows.length * 28))}
            onEvents={{
              click: (event) => {
                const point = event as { dataIndex?: number; name?: string };
                const region =
                  regionRows.find((row) => row.name === point.name) ??
                  (point.dataIndex == null ? undefined : regionRows[point.dataIndex]);
                if (region) {
                  setSelectedWorkflowRegionId((current) => current === region.id ? null : region.id);
                  setSelectedStageKey(null);
                }
              },
            }}
          />
        </Panel>
      </div>
      {workflowRegionId != null ? (
        <Panel
          title="توزیع پرونده‌های باز در مراحل گردش"
          subtitle={`${regionRows.find((row) => row.id === workflowRegionId)?.name ?? "استان انتخاب‌شده"} · ${ageBucket ? data.kpis.find((kpi) => kpi.id === ageBucket)?.label : "همه سن‌ها"} · گردش‌های تاریخی هر پرونده شمرده می‌شوند؛ برای دیدن مسئولان روی مرحله کلیک کنید`}
        >
          <p className="mb-2 text-xs leading-5 text-[var(--muted)]">
            ستون بنفش: تعداد پرونده‌های یکتا در مرحله؛ خط نارنجی: میانگین زمان سپری‌شده تا پایان گردش یا ثبت گردش بعدی (ساعت).
            اگر آخرین گردش پرونده باز باشد، زمان تا امروز محاسبه می‌شود. این زمان تقویمی است، نه ساعت کار فعال.
            نام اشخاص به‌دلیل نبود احراز هویت/مجوز نقش‌محور در این API نمایش داده نمی‌شود.
          </p>
          {stageRows.length > 0 ? (
            <EChart
              option={stageOpt}
              height={Math.max(260, Math.min(480, stageRows.length * 38))}
              onEvents={{
                click: (event) => {
                  const point = event as { dataIndex?: number; name?: string };
                  const stage = stageRows.find((row) => row.stageName === point.name) ??
                    (point.dataIndex == null ? undefined : stageRows[point.dataIndex]);
                  if (stage) {
                    const key = statusKey(stage.statusId);
                    setSelectedStageKey((current) => current === key ? null : key);
                  }
                },
              }}
            />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              برای این استان و بازه سنی، مرحله گردش ثبت‌شده‌ای در پرونده‌های باز پیدا نشد.
            </p>
          )}
        </Panel>
      ) : (
        <Panel title="تحلیل مرحله و مسئول رسیدگی">
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            ابتدا روی یک استان در نمودار بالا کلیک کنید تا تعداد پرونده‌های باز در هر مرحله را ببینید.
          </p>
        </Panel>
      )}
      {selectedStageKey != null ? (
        <Panel
          title="مسئولان مرحله انتخاب‌شده"
          subtitle="بر اساس گردش‌های ثبت‌شده در مرحله انتخاب‌شده؛ زمان از ثبت گردش تا پایان یا گردش بعدی است. شناسه و نقش ذخیره‌شده در همان گردش نمایش داده می‌شود."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="text-[11px] text-[var(--muted)]">
                <tr className="border-b">
                  <th className="px-2 py-2">شناسه مسئول</th>
                  <th className="px-2 py-2">نقش ثبت‌شده</th>
                  <th className="px-2 py-2">واحد مرحله</th>
                  <th className="px-2 py-2">پرونده‌های منتسب در این مرحله</th>
                  <th className="px-2 py-2">گردش‌های این مسئول</th>
                  <th className="px-2 py-2">میانگین زمان مرحله</th>
                </tr>
              </thead>
              <tbody>
                {stageOperatorRows.map((operator) => (
                  <tr
                    key={`${operator.regionId ?? "none"}-${operator.statusId ?? "unknown"}-${operator.operatorId}-${operator.roleId ?? "none"}-${operator.departmentId ?? "none"}`}
                    className="border-b border-slate-50"
                  >
                    <td className="px-2 py-2 font-medium tabular-nums">#{formatFaNumber(operator.operatorId)}</td>
                    <td className="px-2 py-2">{operator.roleName}</td>
                    <td className="px-2 py-2">{operator.departmentName}</td>
                    <td className="px-2 py-2 tabular-nums">{formatFaNumber(operator.caseCount)}</td>
                    <td className="px-2 py-2 tabular-nums">{formatFaNumber(operator.flowCount)}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {operator.averageStageDurationHours == null ? "—" : `${formatFaNumber(operator.averageStageDurationHours, 1)} ساعت`}
                    </td>
                  </tr>
                ))}
                {stageOperatorRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-sm text-[var(--muted)]">
                      برای این مرحله مسئول دارای شناسه ثبت نشده است.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
      <Panel title="عملکرد و موجودی واحدها">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-right text-sm">
            <thead className="text-[11px] text-[var(--muted)]">
              <tr className="border-b">
                <th className="px-2 py-2">واحد سازمانی</th>
                <th className="px-2 py-2">ورودی</th>
                <th className="px-2 py-2">مختومه</th>
                <th className="px-2 py-2">نرخ خاتمه</th>
                <th className="px-2 py-2">میانگین زمان خاتمه</th>
                <th className="px-2 py-2">پرونده باز</th>
                <th className="px-2 py-2">میانگین سن باز</th>
                <th className="px-2 py-2">بیش از ۹۰ روز</th>
                <th className="px-2 py-2">جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {data.units.slice(0, 15).map((u) => (
                <tr
                  key={u.departmentId ?? u.name}
                  className={`border-b border-slate-50 ${selectedDepartmentId === u.departmentId ? "bg-blue-50" : ""}`}
                >
                  <td className="px-2 py-2">{u.name}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(u.inflowCount)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(u.finishedCount)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaPercent(u.finishRate)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {u.averageResolutionDays == null ? "—" : `${formatFaNumber(u.averageResolutionDays, 1)} روز`}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(u.openCount)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {u.averageAgeDays == null ? "—" : `${formatFaNumber(u.averageAgeDays, 1)} روز`}
                  </td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(u.over90)}</td>
                  <td className="px-2 py-2">
                    {u.departmentId == null ? (
                      "—"
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDepartmentId(u.departmentId);
                          router.push("/resolution");
                        }}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        عملکرد رسیدگی
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="تحلیل مسئولان گردش کار"
        subtitle="فیلترهای بازه، استان، نوع موضوع و واحد از بالای صفحه روی این جدول اعمال می‌شوند. زمان = فاصله ثبت تا پایان هر مرحله، فقط مراحل پایان‌یافته."
        action={
          <label className="flex items-center gap-2 text-xs text-slate-600">
            جست‌وجو
            <input
              type="search"
              value={operatorSearch}
              onChange={(event) => {
                setOperatorSearch(event.target.value);
                setOperatorPage(0);
              }}
              placeholder="شناسه کاربر یا واحد"
              className="w-44 rounded-md border border-[var(--border)] px-2 py-1.5 text-sm"
              aria-label="جست‌وجوی مسئول گردش کار"
            />
          </label>
        }
      >
        <p className="mb-3 text-xs leading-5 text-[var(--muted)]">
          شناسه کاربر نمایش داده می‌شود و نام/اطلاعات تماس در این نمای بدون کنترل دسترسی نمایش داده نمی‌شود.
          پرونده باز فقط در صورت داشتن شناسه در آخرین گردش ثبت‌شده به آن منتسب می‌شود؛ بدون شناسه در این جدول نمی‌آید.
          انتخاب بازه سن فقط شمار پرونده‌های باز را محدود می‌کند؛ میانگین زمان مرحله برای همه مراحل پایان‌یافته فیلترشده است و به‌تنهایی علت تأخیر را اثبات نمی‌کند.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-right text-sm">
            <thead className="text-[11px] text-[var(--muted)]">
              <tr className="border-b">
                <th className="px-2 py-2">شناسه مسئول</th>
                <th className="px-2 py-2">واحد مرحله</th>
                <th className="px-2 py-2">مراحل</th>
                <th className="px-2 py-2">پرونده‌های پردازش‌شده</th>
                <th className="px-2 py-2">مراحل پایان‌یافته</th>
                <th className="px-2 py-2">میانگین زمان مرحله</th>
                <th className="px-2 py-2">{selectedAgeId ? "پرونده باز در بازه انتخابی" : "پرونده باز منتسب"}</th>
                <th className="px-2 py-2">میانگین سن همه پرونده‌های باز</th>
              </tr>
            </thead>
            <tbody>
              {visibleOperatorRows.map((operator) => (
                <tr key={`${operator.operatorId}-${operator.departmentId ?? "none"}`} className="border-b border-slate-50">
                  <td className="px-2 py-2 font-medium tabular-nums">#{formatFaNumber(operator.operatorId)}</td>
                  <td className="px-2 py-2">{operator.departmentName}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(operator.flowCount)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(operator.casesHandled)}</td>
                  <td className="px-2 py-2 tabular-nums">{formatFaNumber(operator.completedFlows)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {operator.averageElapsedHours == null ? "—" : `${formatFaNumber(operator.averageElapsedHours, 1)} ساعت`}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {selectedAgeId ? (
                      formatFaNumber(
                        selectedAgeId === "age-lt7" ? operator.openAgeLt7 :
                        selectedAgeId === "age-7-30" ? operator.openAge7To30 :
                        selectedAgeId === "age-30-90" ? operator.openAge30To90 :
                        operator.openAge90Plus,
                      )
                    ) : formatFaNumber(operator.openCases)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {operator.averageOpenAgeDays == null ? "—" : `${formatFaNumber(operator.averageOpenAgeDays, 1)} روز`}
                  </td>
                </tr>
              ))}
              {operatorRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-sm text-[var(--muted)]">
                    برای فیلترهای فعلی مسئول ثبت‌شده‌ای پیدا نشد.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {operatorRows.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
            <span>
              نمایش {formatFaNumber(currentOperatorPage * operatorPageSize + 1)}–
              {formatFaNumber(Math.min((currentOperatorPage + 1) * operatorPageSize, operatorRows.length))}
              {" "}از {formatFaNumber(operatorRows.length)} مسئول
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentOperatorPage === 0}
                onClick={() => setOperatorPage(currentOperatorPage - 1)}
                className="rounded border border-[var(--border)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                قبلی
              </button>
              <span>صفحه {formatFaNumber(currentOperatorPage + 1)} از {formatFaNumber(operatorPageCount)}</span>
              <button
                type="button"
                disabled={currentOperatorPage >= operatorPageCount - 1}
                onClick={() => setOperatorPage(currentOperatorPage + 1)}
                className="rounded border border-[var(--border)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
