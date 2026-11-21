"use client";

import { usePathname } from "next/navigation";
import { CalendarRange, Building2, Filter, Download, RotateCcw } from "lucide-react";
import { useDashboardFilters } from "@/data/DashboardFilterContext";
import { SUBJECT_CLASS_OPTIONS, type PeriodKey } from "@/data/filters";
import { cn, formatFaDate, formatFaMonthLabel, formatFaNumber } from "@/lib/utils";

/** Static labels for chips — avoid `periodToRange()` (uses `new Date`) during render/prerender */
const PERIOD_CHIP_LABELS: Record<PeriodKey, string> = {
  "1m": "ماه گذشته",
  all: "کل دوره تاریخی",
  "30d": "۳۰ روز اخیر",
  "90d": "۹۰ روز اخیر",
  ytd: "از ابتدای سال",
};

const titles: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "داشبورد مدیریتی",
    subtitle: "نمای مدیریتی حجم پرونده و پوشش دانش — پایش و تحقیق Outside-In",
  },
  "/analytics/requests": {
    title: "تحلیل درخواست‌ها و شکایات",
    subtitle: "",
  },
  "/analytics/categories": {
    title: "کاوش دسته‌بندی",
    subtitle: "درخت Zone → Nature → Group → Subject بر اساس ابعاد دیده‌بان",
  },
  "/analytics/topics": {
    title: "کاوش موضوع و خوشه",
    subtitle: "پایه تاکسونومی Subject (نه NLP) + تحول زمانی",
  },
  "/knowledge/answers": {
    title: "هوش پاسخ تاریخی",
    subtitle: "پوشش پاسخ موجود در برابر اعتبار قانونی — بدون ادعای ۷۰٪ تأییدنشده",
  },
  "/performance/kpi": {
    title: "پایش شاخص‌ها",
    subtitle: "کاتالوگ KPI با تعریف، فرمول، فیلدها و وضعیت امکان‌سنجی دیده‌بان",
  },
  "/performance/kpi-catalog": {
    title: "کاتالوگ کامل شاخص‌ها",
    subtitle: "همه KPIهای قابل استخراج از روابط جداول + اندازه‌گیری زنده یا وضعیت خالی",
  },
  "/reports/standard": {
    title: "گزارش‌های استاندارد",
    subtitle: "کاتالوگ گزارش‌های سازمانی با خروجی PDF/Excel نمایشی",
  },
  "/reports/export": {
    title: "مرکز خروجی",
    subtitle: "صف jobهای خروجی و وضعیت دانلودهای نمایشی",
  },
  "/ai/performance": {
    title: "عملکرد مدل‌های هوش مصنوعی",
    subtitle: "پوسته پایش — بدون ادعای دقت عملیاتی تا ارزیابی واقعی",
  },
  "/admin/users": {
    title: "کاربران و نقش‌ها",
    subtitle: "پوسته Identity — مدیریت واقعی در فاز بعدی",
  },
  "/admin/sources": {
    title: "منابع داده",
    subtitle: "وضعیت دیده‌بان و منابع تحلیلی برنامه‌ریزی‌شده",
  },
  "/admin/integration": {
    title: "پایش یکپارچه‌سازی",
    subtitle: "سلامت اتصال، Provider و جاب‌های تجمیع",
  },
  "/admin/audit": {
    title: "لاگ ممیزی",
    subtitle: "رویدادهای دسترسی و خروجی — نمونه نمایشی",
  },
  "/admin/settings": {
    title: "تنظیمات سامانه",
    subtitle: "زبان، Provider، ماسک PII — ذخیره هنوز فعال نیست",
  },
};

const selectFocus =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1";

export function Header() {
  const pathname = usePathname();
  const { filters, labels, setPeriod, setSubjectClassId, resetFilters, isDefaultFilters } =
    useDashboardFilters();
  const meta = titles[pathname] ?? {
    title: "پلتفرم هوش تحلیلی",
    subtitle: "نسخه اولیه Outside-In",
  };

  const classOption =
    SUBJECT_CLASS_OPTIONS.find((o) => o.id === filters.subjectClassId) ??
    (filters.subjectClassId != null
      ? {
          value: String(filters.subjectClassId),
          label: labels.subjectClass ?? `طبقه ${filters.subjectClassId}`,
          id: filters.subjectClassId,
        }
      : SUBJECT_CLASS_OPTIONS[0]);
  const periodLabel = PERIOD_CHIP_LABELS[filters.period];

  return (
    <header className="border-b border-[var(--border)] bg-white px-5 py-2.5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-700">{meta.title}</h2>
          {meta.subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{meta.subtitle}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-slate-700">
            <CalendarRange className="h-4 w-4 text-slate-400" aria-hidden />
            <select
              className={cn("bg-transparent", selectFocus)}
              value={filters.period}
              aria-label="بازه زمانی"
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            >
              <option value="1m">ماه گذشته</option>
              <option value="30d">۳۰ روز اخیر</option>
              <option value="90d">۹۰ روز اخیر</option>
              <option value="ytd">از ابتدای سال</option>
              <option value="all">کل دوره تاریخی</option>
            </select>
          </label>

          <label
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400"
            title="فیلتر واحد سازمانی پس از فهرست شناسه Department از API فعال می‌شود"
          >
            <Building2 className="h-4 w-4" aria-hidden />
            <select className="bg-transparent" disabled defaultValue="all" aria-label="واحد سازمانی">
              <option value="all">همه واحدها (غیرفعال)</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-slate-700">
            <Filter className="h-4 w-4 text-slate-400" aria-hidden />
            <select
              className={cn("bg-transparent", selectFocus)}
              value={classOption.value}
              aria-label="طبقه درخواست"
              onChange={(e) => {
                const opt = SUBJECT_CLASS_OPTIONS.find((o) => o.value === e.target.value);
                setSubjectClassId(opt?.id ?? null, opt?.label ?? null);
              }}
            >
              {filters.subjectClassId != null &&
              !SUBJECT_CLASS_OPTIONS.some((o) => o.id === filters.subjectClassId) ? (
                <option value={classOption.value}>{classOption.label}</option>
              ) : null}
              {SUBJECT_CLASS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={resetFilters}
            disabled={isDefaultFilters}
            aria-label="بازنشانی فیلترها به پیش‌فرض"
            title={
              isDefaultFilters
                ? "فیلترها در حالت پیش‌فرض هستند"
                : "بازگشت به ماه گذشته و همه طبقات"
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
              isDefaultFilters
                ? "cursor-not-allowed border-transparent text-slate-400"
                : "border-[var(--border)] bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            بازنشانی فیلترها
          </button>

          <button
            type="button"
            disabled
            title="خروجی پس از پایدار شدن فیلتر بازه فعال می‌شود"
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-dashed border-slate-300 bg-transparent px-3 py-2 text-sm font-medium text-slate-400"
          >
            <Download className="h-4 w-4" aria-hidden />
            خروجی گزارش (به‌زودی)
          </button>
        </div>
      </div>

      <div
        className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2.5"
        aria-label="فیلترهای فعال"
      >
        <span className="text-xs text-slate-500">فیلترهای فعال:</span>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800">
          بازه: {periodLabel}
        </span>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800">
          طبقه: {classOption.label}
        </span>
        {filters.channelId != null ? (
          <span className="rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900">
            کانال: {labels.channel ?? formatFaNumber(filters.channelId)}
          </span>
        ) : null}
        {filters.regionId != null ? (
          <span className="rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900">
            استان: {labels.region ?? formatFaNumber(filters.regionId)}
          </span>
        ) : null}
        {filters.subjectGroupId != null ? (
          <span className="rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900">
            گروه: {labels.subjectGroup ?? formatFaNumber(filters.subjectGroupId)}
          </span>
        ) : null}
        {filters.from && filters.to ? (
          <span className="rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900">
            ماه:{" "}
            {labels.month
              ? formatFaMonthLabel(labels.month)
              : `${formatFaDate(filters.from)} → ${formatFaDate(filters.to)}`}
          </span>
        ) : null}
        <span className="rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-400">
          واحد: همه (غیرفعال)
        </span>
      </div>
    </header>
  );
}
