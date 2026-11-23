import { getReadPool, sql } from "@/lib/db/pool";
import { inferMostamariType, type MostamariTypeId } from "@/lib/mostamari/types";

/** Same supply filter as lab optimized dbo.CalculateTransaction. */
export const CALC_TXN_SUPPLY_IDS = [
  1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
  26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38,
] as const;

export type SpAssertDiff = {
  field: string;
  labelFa: string;
  newSp: string;
  saved: string;
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

async function payedMetrics(trId: number): Promise<Metrics> {
  const pool = await getReadPool();
  const sumRs = await pool.request().input("id", sql.Int, trId).query(`
    SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
    FROM dbo.PayedContinusPayment WITH (NOLOCK)
    WHERE TransactionId = @id
  `);
  const histRs = await pool.request().input("id", sql.Int, trId).query(`
    SELECT COUNT_BIG(*) AS cnt, Money
    FROM dbo.PayedContinusPayment WITH (NOLOCK)
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

/** Dry-run of new CalculateTransaction INSERT source (no writes). */
async function newSpWouldMetrics(): Promise<Metrics> {
  const pool = await getReadPool();
  const list = CALC_TXN_SUPPLY_IDS.join(",");
  const sumRs = await pool.request().query(`
    SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
    FROM dbo.ContinusPayment AS P WITH (NOLOCK)
    WHERE P.ContinusPaymentSupplyLocationId IN (${list})
  `);
  const histRs = await pool.request().query(`
    SELECT COUNT_BIG(*) AS cnt, Money
    FROM dbo.ContinusPayment AS P WITH (NOLOCK)
    WHERE P.ContinusPaymentSupplyLocationId IN (${list})
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
 * Assert new CalculateTransaction dry-run vs a peer txn’s saved PayedContinusPayment.
 * Also compares current wizard txn (if calculated) to the same peer.
 * Read-only — never EXEC.
 */
export async function assertNewSpVsSavedPeer(opts: {
  trId: number;
  peerTrId: number;
  typeId?: MostamariTypeId | null;
}) {
  const { trId, peerTrId } = opts;
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("شناسه تراکنش جاری نامعتبر");
  }
  if (!Number.isFinite(peerTrId) || peerTrId <= 0) {
    throw new Error("شناسه تراکنش نمونه (ذخیره‌شده) نامعتبر");
  }

  const pool = await getReadPool();
  const peerHdr = await pool.request().input("id", sql.Int, peerTrId).query(`
    SELECT Id, Title, Ky, Year, Description, RelatedTo, RegistrationDate
    FROM dbo.PayedTransaction WITH (NOLOCK)
    WHERE Id = @id
  `);
  const peer = peerHdr.recordset[0] as Record<string, unknown> | undefined;
  if (!peer) throw new Error(`تراکنش نمونه #${peerTrId} یافت نشد`);

  const peerInferred = inferMostamariType({
    ky: peer.Ky != null ? String(peer.Ky) : null,
    title: peer.Title != null ? String(peer.Title) : null,
    description: peer.Description != null ? String(peer.Description) : null,
  });

  const currentType = opts.typeId || null;
  const peerIsBase =
    peerInferred?.id === "mst-base" ||
    String(peer.Ky || "").toLowerCase() === "mst_131500";
  const currentIsBase = !currentType || currentType === "mst-base";

  const saved = await payedMetrics(peerTrId);
  if (saved.cnt <= 0) {
    throw new Error(
      `تراکنش نمونه #${peerTrId} ردیف محاسبه‌شده در PayedContinusPayment ندارد`,
    );
  }

  const diffs: SpAssertDiff[] = [];
  const push = (
    field: string,
    labelFa: string,
    a: string,
    b: string,
    match: boolean,
  ) => diffs.push({ field, labelFa, newSp: a, saved: b, match });

  let newSp: Metrics | null = null;
  let driftNote: string | null = null;

  if (peerIsBase || currentIsBase) {
    newSp = await newSpWouldMetrics();
    push(
      "cnt",
      "تعداد ردیف (dry-run SP جدید ↔ ذخیره‌شده نمونه)",
      fmtNum(newSp.cnt),
      fmtNum(saved.cnt),
      newSp.cnt === saved.cnt,
    );
    push(
      "moneySum",
      "جمع مبلغ",
      fmtNum(newSp.moneySum),
      fmtNum(saved.moneySum),
      newSp.moneySum === saved.moneySum,
    );
    push(
      "moneyHist",
      "توزیع مبلغ",
      moneyKey(newSp.hist) || "—",
      moneyKey(saved.hist) || "—",
      moneyKey(newSp.hist) === moneyKey(saved.hist),
    );
    if (newSp.cnt !== saved.cnt || newSp.moneySum !== saved.moneySum) {
      driftNote =
        "اختلاف ممکن است به‌خاطر تغییر ContinusPayment بعد از تاریخ محاسبهٔ نمونه باشد (نه لزوماً باگ SP).";
    }
  } else {
    driftNote = `تراکنش نمونه نوع «${peerInferred?.shortFa || peer.Ky || "نامشخص"}» است — dry-run فقط برای مستمری سازمان (CalculateTransaction) است. مقایسهٔ ذخیره‌شدهٔ جاری با نمونه انجام می‌شود.`;
  }

  /** Current wizard txn (آبان / new run) vs peer saved */
  const current = await payedMetrics(trId);
  if (current.cnt > 0) {
    push(
      "curCnt",
      `تعداد ردیف تراکنش جاری #${trId} ↔ نمونه #${peerTrId}`,
      fmtNum(current.cnt),
      fmtNum(saved.cnt),
      current.cnt === saved.cnt,
    );
    push(
      "curMoney",
      "جمع مبلغ جاری ↔ نمونه",
      fmtNum(current.moneySum),
      fmtNum(saved.moneySum),
      current.moneySum === saved.moneySum,
    );
    push(
      "curHist",
      "توزیع مبلغ جاری ↔ نمونه",
      moneyKey(current.hist) || "—",
      moneyKey(saved.hist) || "—",
      moneyKey(current.hist) === moneyKey(saved.hist),
    );
  }

  if (!peerIsBase && currentIsBase) {
    push(
      "typeWarn",
      "نوع تراکنش نمونه",
      currentType || "mst-base",
      peerInferred?.id || String(peer.Ky || "—"),
      false,
    );
  }

  const mismatchCount = diffs.filter((d) => !d.match).length;
  const coreOk =
    newSp != null &&
    newSp.cnt === saved.cnt &&
    newSp.moneySum === saved.moneySum &&
    moneyKey(newSp.hist) === moneyKey(saved.hist);

  return {
    ok: true as const,
    readonly: true as const,
    kind: "sp-assert" as const,
    trId,
    peerTrId,
    peer: {
      title: peer.Title != null ? String(peer.Title) : null,
      ky: peer.Ky != null ? String(peer.Ky) : null,
      typeId: peerInferred?.id || null,
      typeTitleFa: peerInferred?.titleFa || null,
      year: peer.Year != null ? String(peer.Year) : null,
    },
    newSpDryRun: newSp,
    savedPeer: saved,
    currentTxn: current.cnt > 0 ? current : null,
    diffs,
    mismatchCount,
    allMatch: mismatchCount === 0,
    coreSpMatchesSaved: coreOk,
    noteFa:
      "بدون EXEC — «SP جدید» = SELECT همان منطق Insert از ContinusPayment؛ «ذخیره‌شده» = PayedContinusPayment تراکنش نمونه.",
    driftNote,
    messageFa: coreOk
      ? `SP جدید با ذخیره‌شدهٔ #${peerTrId} در تعداد/مبلغ/توزیع هم‌خوان است.`
      : newSp
        ? `اختلاف با ذخیره‌شدهٔ #${peerTrId} — ${mismatchCount.toLocaleString("fa-IR")} مورد.`
        : `مقایسهٔ جزئی با #${peerTrId} (${mismatchCount.toLocaleString("fa-IR")} مورد).`,
  };
}
