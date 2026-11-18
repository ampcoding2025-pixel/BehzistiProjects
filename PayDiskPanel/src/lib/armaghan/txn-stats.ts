import { getReadPool, sql } from "@/lib/db/pool";

export type TxnFamilyStats = "yarane" | "mostamari";

export type TxnStatsFields = "payedRows" | "keys" | "all";

function filledKey(v: unknown) {
  const s = v == null ? "" : String(v).trim();
  return s !== "" && s !== "0" ? s : null;
}

/**
 * On-demand stats for one transaction (kept off the list query).
 * - payedRows: exact COUNT (can be slow)
 * - keys: header Key2/Key3 or ListToken/Export (cheap)
 */
export async function getTransactionPayedStats(
  trId: number,
  family: TxnFamilyStats,
  fields: TxnStatsFields = "all",
) {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("شناسه نامعتبر");
  }
  const wantPayed = fields === "all" || fields === "payedRows";
  const wantKeys = fields === "all" || fields === "keys";

  const pool = await getReadPool();
  let payedRows: number | null = null;
  let supplyCount = 0;
  let key2: string | null = null;
  let key3: string | null = null;

  if (family === "mostamari") {
    if (wantKeys) {
      const req = pool.request();
      req.timeout = 30_000;
      req.input("id", sql.Int, trId);
      const rs = await req.query(`
        SELECT
          t.ListToken AS key2,
          ISNULL(t.FileName, t.ExportToken) AS key3
        FROM dbo.PayedTransaction t WITH (NOLOCK)
        WHERE t.Id = @id
      `);
      const row = rs.recordset[0];
      if (!row) throw new Error("تراکنش یافت نشد");
      key2 = filledKey(row.key2);
      key3 = filledKey(row.key3);
    }
    if (wantPayed) {
      const req = pool.request();
      req.timeout = 120_000;
      req.input("id", sql.Int, trId);
      const rs = await req.query(`
        SELECT COUNT_BIG(*) AS payedRows
        FROM dbo.PayedContinusPayment WITH (NOLOCK)
        WHERE TransactionId = @id
      `);
      payedRows = Number(rs.recordset[0]?.payedRows || 0);
    }
  } else {
    if (wantKeys) {
      const req = pool.request();
      req.timeout = 30_000;
      req.input("id", sql.Int, trId);
      const rs = await req.query(`
        SELECT t.Key2 AS key2, t.Key3 AS key3
        FROM dbo.MakeOverTransactions t WITH (NOLOCK)
        WHERE t.Id = @id
      `);
      const row = rs.recordset[0];
      if (!row) throw new Error("تراکنش یافت نشد");
      key2 = filledKey(row.key2);
      key3 = filledKey(row.key3);
    }
    if (wantPayed) {
      const req = pool.request();
      req.timeout = 120_000;
      req.input("id", sql.Int, trId);
      const rs = await req.query(`
        SELECT
          COUNT_BIG(*) AS payedRows,
          COUNT(DISTINCT MakeOverSupplyLocationId) AS supplyCount
        FROM dbo.PayedMakeOvers WITH (NOLOCK)
        WHERE TransactionId = @id
      `);
      payedRows = Number(rs.recordset[0]?.payedRows || 0);
      supplyCount = Number(rs.recordset[0]?.supplyCount || 0);
    }
  }

  return {
    payedRows,
    supplyCount,
    key2,
    key3,
    hasPeopleList: !!key2,
    hasBank: !!key3,
  };
}
