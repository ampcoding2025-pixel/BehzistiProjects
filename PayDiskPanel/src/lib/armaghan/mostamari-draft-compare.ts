import { getReadPool, sql } from "@/lib/db/pool";
import { isCalcDraftEnabled } from "@/lib/lab/calc-draft";

export type DraftLiveDiff = {
  field: string;
  labelFa: string;
  draft: string;
  live: string;
  match: boolean;
};

function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-US");
}

function moneyKey(rows: Array<{ cnt?: unknown; Money?: unknown }>) {
  return [...rows]
    .map((r) => ({ cnt: Number(r.cnt) || 0, Money: Number(r.Money) || 0 }))
    .sort((a, b) => b.Money - a.Money)
    .map((r) => `${r.Money}:${r.cnt}`)
    .join("|");
}

type Metrics = {
  cnt: number;
  moneySum: number | null;
  hist: Array<{ cnt: number; Money: number }>;
};

async function metricsFrom(table: string, trId: number): Promise<Metrics> {
  const pool = await getReadPool();
  const sumRs = await pool.request().input("id", sql.Int, trId).query(`
    SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
    FROM ${table} WITH (NOLOCK)
    WHERE TransactionId = @id
  `);
  const histRs = await pool.request().input("id", sql.Int, trId).query(`
    SELECT COUNT_BIG(*) AS cnt, Money
    FROM ${table} WITH (NOLOCK)
    WHERE TransactionId = @id
    GROUP BY Money
    ORDER BY Money DESC
  `);
  return {
    cnt: Number(sumRs.recordset[0]?.cnt || 0),
    moneySum:
      sumRs.recordset[0]?.moneySum == null
        ? null
        : Number(sumRs.recordset[0].moneySum),
    hist: (histRs.recordset || []).map((r) => ({
      cnt: Number(r.cnt) || 0,
      Money: Number(r.Money) || 0,
    })),
  };
}

/**
 * Compare draft calc rows vs live PayedContinusPayment for the same TrId.
 * Correct check after Approve/Promote (draft kept until next Calculate*_Draft).
 */
export async function compareMostamariDraftVsLive(trId: number) {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("شناسه تراکنش نامعتبر");
  }
  if (!isCalcDraftEnabled()) {
    return {
      ok: true as const,
      kind: "draft-vs-live" as const,
      trId,
      draftEnabled: false,
      diffs: [] as DraftLiveDiff[],
      mismatchCount: 0,
      allMatch: false,
      messageFa:
        "حالت پیش‌نویس خاموش است (PAYDISK_CALC_DRAFT) — مقایسه پیش‌نویس↔زنده در دسترس نیست.",
    };
  }

  const draft = await metricsFrom("dbo.PayedContinusPayment_Draft", trId);
  const live = await metricsFrom("dbo.PayedContinusPayment", trId);

  const diffs: DraftLiveDiff[] = [];
  const push = (
    field: string,
    labelFa: string,
    d: string,
    l: string,
    match: boolean,
  ) => diffs.push({ field, labelFa, draft: d, live: l, match });

  if (draft.cnt <= 0 && live.cnt <= 0) {
    return {
      ok: true as const,
      kind: "draft-vs-live" as const,
      trId,
      draftEnabled: true,
      draft,
      live,
      diffs,
      mismatchCount: 0,
      allMatch: false,
      messageFa:
        "نه پیش‌نویس و نه ردیف زنده برای این تراکنش هست — ابتدا محاسبه پیش‌نویس و سپس تایید/ارتقا.",
    };
  }
  if (draft.cnt <= 0) {
    return {
      ok: true as const,
      kind: "draft-vs-live" as const,
      trId,
      draftEnabled: true,
      draft,
      live,
      diffs,
      mismatchCount: 1,
      allMatch: false,
      messageFa:
        "پیش‌نویس خالی است (ممکن است با محاسبهٔ بعدی پاک شده باشد). فقط ردیف زنده موجود است.",
    };
  }
  if (live.cnt <= 0) {
    return {
      ok: true as const,
      kind: "draft-vs-live" as const,
      trId,
      draftEnabled: true,
      draft,
      live,
      diffs,
      mismatchCount: 1,
      allMatch: false,
      messageFa:
        "پیش‌نویس آماده است ولی هنوز به PayedContinusPayment ارتقا داده نشده — اول تایید را بزنید.",
    };
  }

  push("cnt", "تعداد ردیف", fmtNum(draft.cnt), fmtNum(live.cnt), draft.cnt === live.cnt);
  push(
    "moneySum",
    "جمع مبلغ",
    fmtNum(draft.moneySum),
    fmtNum(live.moneySum),
    draft.moneySum === live.moneySum,
  );
  push(
    "moneyHist",
    "توزیع مبلغ",
    moneyKey(draft.hist) || "—",
    moneyKey(live.hist) || "—",
    moneyKey(draft.hist) === moneyKey(live.hist),
  );

  const mismatchCount = diffs.filter((d) => !d.match).length;
  return {
    ok: true as const,
    kind: "draft-vs-live" as const,
    trId,
    draftEnabled: true,
    draft,
    live,
    diffs,
    mismatchCount,
    allMatch: mismatchCount === 0,
    messageFa:
      mismatchCount === 0
        ? `پیش‌نویس و ردیف‌های درج‌شده در DB برای #${trId} یکسان‌اند (تعداد/مبلغ/توزیع).`
        : `اختلاف پیش‌نویس ↔ زنده برای #${trId}: ${mismatchCount.toLocaleString("fa-IR")} مورد.`,
    noteFa:
      "مقایسهٔ درست پس از تایید: PayedContinusPayment_Draft ↔ PayedContinusPayment همان تراکنش (نه dry-run ContinusPayment و نه تراکنش نمونه).",
  };
}
