import type { WorkloadUser } from "@/data/providers/types";

/** Finished-only hours for score; open-only → null (must not look fast). */
function performanceHours(row: WorkloadUser): number | null {
  if ((row.finishedCount ?? 0) <= 0) return null;
  if (row.avgHoursFinished != null && Number.isFinite(row.avgHoursFinished)) {
    return Number(row.avgHoursFinished);
  }
  return null;
}

export type PerformanceBand = "excellent" | "good" | "average" | "needs_attention";

export type ScoreBreakdown = {
  loadIndex: number;
  speedIndex: number | null;
  throughputIndex: number | null;
  score: number;
  band: PerformanceBand;
  formulaFa: string;
  loadNote: string;
  speedNote: string;
  throughputNote: string;
  cohortSize: number;
  maxLoad: number;
  medianAvgHours: number | null;
};

export type UserScorecardModel = {
  userId: number | null;
  name: string;
  roleLabel: string;
  volume: number;
  avgHours: number | null;
  breakdown: ScoreBreakdown;
  peerRank: number;
  peerCount: number;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function bandFor(score: number): PerformanceBand {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "average";
  return "needs_attention";
}

export function bandLabelFa(band: PerformanceBand): string {
  switch (band) {
    case "excellent":
      return "عالی";
    case "good":
      return "خوب";
    case "average":
      return "متوسط";
    case "needs_attention":
      return "نیاز به بهبود";
  }
}

export function bandToneClass(band: PerformanceBand): string {
  switch (band) {
    case "excellent":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "good":
      return "bg-sky-50 text-sky-950 border-sky-200";
    case "average":
      return "bg-amber-50 text-amber-950 border-amber-200";
    case "needs_attention":
      return "bg-rose-50 text-rose-950 border-rose-200";
  }
}

/**
 * Transparent manager score (0–100) within a peer cohort:
 *   Score = 0.40×Load + 0.60×Speed   (if avg hours available)
 *   Score = Load only               (if no timing)
 *
 * Load  = 100 × (volume / max volume in cohort)
 * Speed = 100 × min(1, medianAvgHours / userAvgHours)
 * Rate  = volume / avgHours
 */
export function scoreWorkloadUser(
  user: WorkloadUser,
  cohort: WorkloadUser[],
): ScoreBreakdown {
  const peers = cohort.filter((r) => r.value > 0);
  const maxLoad = Math.max(...peers.map((r) => r.value), 1);
  const loadIndex = clamp(100 * (user.value / maxLoad));

  const userHours = performanceHours(user);
  const hours = peers
    .map((r) => performanceHours(r))
    .filter((d): d is number => d != null && Number.isFinite(d) && d >= 0);
  const medHours = median(hours);

  let speedIndex: number | null = null;
  let speedNote =
    (user.finishedCount ?? 0) <= 0
      ? "فقط درخواست باز — سرعت از اتمام‌شده‌ها محاسبه نمی‌شود"
      : "میانگین ساعت اتمام برای این کاربر نیست — امتیاز فقط بر اساس حجم";
  if (userHours != null && medHours != null && medHours > 0) {
    const raw = 100 * Math.min(1, medHours / Math.max(userHours, 0.1));
    speedIndex = clamp(raw);
    speedNote =
      userHours <= medHours
        ? `سریع‌تر یا برابر میانه هم‌گروه روی اتمام‌شده‌ها (میانه ${medHours.toFixed(1)} ساعت)`
        : `کندتر از میانه هم‌گروه روی اتمام‌شده‌ها (میانه ${medHours.toFixed(1)} ساعت)`;
  }

  let throughputIndex: number | null = null;
  let throughputNote = "نیاز به میانگین ساعت اتمام دارد — نرخ = حجم ÷ زمان";
  if (userHours != null && userHours > 0) {
    const throughputs = peers
      .map((r) => {
        const h = performanceHours(r);
        return h != null && h > 0 ? r.value / h : null;
      })
      .filter((t): t is number => t != null);
    const maxTp = Math.max(...throughputs, 0.0001);
    const tp = user.value / userHours;
    throughputIndex = clamp(100 * (tp / maxTp));
    throughputNote = `نرخ = حجم ÷ ساعت‌اتمام → ${tp.toFixed(1)} (نسبت به بهترین هم‌گروه)`;
  }

  const score =
    speedIndex == null
      ? loadIndex
      : clamp(0.4 * loadIndex + 0.6 * speedIndex);

  const formulaFa =
    speedIndex == null
      ? "امتیاز = امتیاز حجم (زمان در دسترس نیست)"
      : "امتیاز = ۰.۴ × امتیاز حجم + ۰.۶ × امتیاز سرعت";

  return {
    loadIndex: Math.round(loadIndex * 10) / 10,
    speedIndex: speedIndex == null ? null : Math.round(speedIndex * 10) / 10,
    throughputIndex:
      throughputIndex == null ? null : Math.round(throughputIndex * 10) / 10,
    score: Math.round(score * 10) / 10,
    band: bandFor(score),
    formulaFa,
    loadNote: `حجم ${user.value} از بیشینه ${maxLoad} در هم‌گروه (${peers.length} نفر)`,
    speedNote,
    throughputNote,
    cohortSize: peers.length,
    maxLoad,
    medianAvgHours: medHours,
  };
}

export function buildUserScorecard(
  user: WorkloadUser,
  cohort: WorkloadUser[],
  roleLabel: string,
): UserScorecardModel {
  const breakdown = scoreWorkloadUser(user, cohort);
  const ranked = [...cohort]
    .filter((r) => r.value > 0)
    .map((r) => ({ id: r.id, score: scoreWorkloadUser(r, cohort).score }))
    .sort((a, b) => b.score - a.score);
  const peerRank = Math.max(
    1,
    ranked.findIndex((r) => r.id === user.id) + 1 || ranked.length,
  );

  return {
    userId: user.id ?? null,
    name: user.name,
    roleLabel,
    volume: user.value,
    // Score/rate use finished-only hours; open-only → null (not "fast")
    avgHours: performanceHours(user),
    breakdown,
    peerRank,
    peerCount: ranked.length,
  };
}
