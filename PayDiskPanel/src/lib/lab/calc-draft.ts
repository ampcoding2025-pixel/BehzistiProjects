/**
 * Preview-then-approve: when PAYDISK_CALC_DRAFT=true, calculate writes *_Draft
 * tables; report/list read draft until Promote on approve.
 */
import { getReadPool, sql } from "@/lib/db/pool";

export function isCalcDraftEnabled() {
  return process.env.PAYDISK_CALC_DRAFT === "true";
}

export type MostamariPayTable =
  | "dbo.PayedContinusPayment"
  | "dbo.PayedContinusPayment_Draft";

export type YaranePayTable =
  | "dbo.PayedMakeOvers"
  | "dbo.PayedMakeOvers_Draft";

const DRAFT_PROC: Record<string, string> = {
  CalculateTransaction: "CalculateTransaction_Draft",
  CalculateHadafmandi: "CalculateHadafmandi_Draft",
  CalculateEmdad: "CalculateEmdad_Draft",
  CalculateHaghParastari: "CalculateHaghParastari_Draft",
  CalculateHaghParastariFamily: "CalculateHaghParastariFamily_Draft",
  CalculateMarakezYarane: "CalculateMarakezYarane_Draft",
};

/** Map live calc proc → draft proc when feature flag on. */
export function draftProcName(liveProc: string): string {
  if (!isCalcDraftEnabled()) return liveProc;
  return DRAFT_PROC[liveProc] || liveProc;
}

export async function mostamariDraftHasRows(trId: number): Promise<boolean> {
  if (!isCalcDraftEnabled() || !Number.isFinite(trId) || trId <= 0) return false;
  try {
    const pool = await getReadPool();
    const rs = await pool
      .request()
      .input("id", sql.BigInt, trId)
      .query(`
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK)
          WHERE TransactionId = @id
        ) THEN 1 ELSE 0 END AS ok
      `);
    return Number(rs.recordset[0]?.ok) === 1;
  } catch {
    return false;
  }
}

export async function yaraneDraftHasRows(trId: number): Promise<boolean> {
  if (!isCalcDraftEnabled() || !Number.isFinite(trId) || trId <= 0) return false;
  try {
    const pool = await getReadPool();
    const rs = await pool
      .request()
      .input("id", sql.Int, trId)
      .query(`
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM dbo.PayedMakeOvers_Draft WITH (NOLOCK)
          WHERE TransactionId = @id
        ) THEN 1 ELSE 0 END AS ok
      `);
    return Number(rs.recordset[0]?.ok) === 1;
  } catch {
    return false;
  }
}

/** True when live PayedContinusPayment already has rows for this TrId. */
export async function mostamariLiveHasRows(trId: number): Promise<boolean> {
  try {
    const pool = await getReadPool();
    const rs = await pool
      .request()
      .input("id", sql.BigInt, trId)
      .query(`
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM dbo.PayedContinusPayment WITH (NOLOCK)
          WHERE TransactionId = @id
        ) THEN 1 ELSE 0 END AS ok
      `);
    return Number(rs.recordset[0]?.ok) === 1;
  } catch {
    return false;
  }
}

/** True when live PayedMakeOvers already has rows for this TrId. */
export async function yaraneLiveHasRows(trId: number): Promise<boolean> {
  try {
    const pool = await getReadPool();
    const rs = await pool
      .request()
      .input("id", sql.Int, trId)
      .query(`
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM dbo.PayedMakeOvers WITH (NOLOCK)
          WHERE TransactionId = @id
        ) THEN 1 ELSE 0 END AS ok
      `);
    return Number(rs.recordset[0]?.ok) === 1;
  } catch {
    return false;
  }
}

/**
 * Prefer live once promoted/approved; otherwise draft (preview).
 * Draft is kept after Promote so postPay can compare draft ↔ live.
 */
export async function resolveMostamariPayTable(
  trId: number,
): Promise<MostamariPayTable> {
  if (!isCalcDraftEnabled()) return "dbo.PayedContinusPayment";
  if (await mostamariLiveHasRows(trId)) return "dbo.PayedContinusPayment";
  if (await mostamariDraftHasRows(trId)) return "dbo.PayedContinusPayment_Draft";
  return "dbo.PayedContinusPayment";
}

export async function resolveYaranePayTable(
  trId: number,
): Promise<YaranePayTable> {
  if (!isCalcDraftEnabled()) return "dbo.PayedMakeOvers";
  if (await yaraneLiveHasRows(trId)) return "dbo.PayedMakeOvers";
  if (await yaraneDraftHasRows(trId)) return "dbo.PayedMakeOvers_Draft";
  return "dbo.PayedMakeOvers";
}
