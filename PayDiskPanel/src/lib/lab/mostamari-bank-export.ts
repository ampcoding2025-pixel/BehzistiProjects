import { createWriteStream } from "fs";
import { once } from "events";
import path from "path";
import { getReadPool, sql } from "@/lib/db/pool";
import { yaraneDisketteUncRoot } from "@/lib/lab/yarane-export";
import type { MostamariExportIbnScope } from "@/lib/mostamari/export-formats";

const BATCH = 5000;

function normalizeIbnScope(scope?: string | null): MostamariExportIbnScope {
  if (scope === "with-ibn" || scope === "without-ibn" || scope === "all") {
    return scope;
  }
  return "all";
}

function ibnScopeSql(scope: MostamariExportIbnScope): string {
  if (scope === "with-ibn") {
    return `AND i.IBN IS NOT NULL AND LTRIM(RTRIM(i.IBN)) <> N'' AND i.IBN <> N'null'`;
  }
  if (scope === "without-ibn") {
    return `AND (i.IBN IS NULL OR LTRIM(RTRIM(i.IBN)) = N'' OR i.IBN = N'null')`;
  }
  return "";
}

/**
 * Armaghan bank diskette record — same as dbo.Export BCP:
 *
 *   ltrim(rtrim(str(1)))
 *   + right(REPLACE(STR(0,15),SPACE(1),0)+ltrim(rtrim(AccountNumber)),15)
 *   + right(REPLACE(STR(0,14),SPACE(1),0)+ltrim(rtrim(str(money))),14)
 *
 * → 30 chars: `1` + account(15 zero-pad) + money(14 zero-pad)
 * BCP uses `-c` (character) → CRLF lines, no header, Latin1-compatible digits.
 */
export function formatMostamariBankRecord(
  accountNumber: unknown,
  money: unknown,
): string {
  const acc = String(accountNumber ?? "").trim();
  const mon = String(Math.trunc(Number(money) || 0));
  const acc15 = `${"0".repeat(15)}${acc}`.slice(-15);
  const mon14 = `${"0".repeat(14)}${mon}`.slice(-14);
  return `1${acc15}${mon14}`;
}

/** Default name pattern for PayedTransaction.FileName / Diskette download. */
export function mostamariBankFilename(
  trId: number,
  ibnScope: MostamariExportIbnScope = "all",
) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = ibnScope === "all" ? "all" : ibnScope;
  return `mostamari-bank-${trId}-${suffix}-${stamp}.txt`;
}

/**
 * Stream Armaghan-format bank diskette lines for a PayedTransaction.
 * Same record layout as dbo.Export; optional IBN filter for download scopes.
 */
export async function* iterateMostamariBankDiskette(
  trId: number,
  ibnScope: MostamariExportIbnScope = "all",
): AsyncGenerator<string, void, unknown> {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("TransactionId نامعتبر");
  }
  const scope = normalizeIbnScope(ibnScope);
  const scopePred = ibnScopeSql(scope);
  const pool = await getReadPool();
  let offset = 0;
  for (;;) {
    const req = pool.request();
    req.timeout = 120_000;
    req.input("id", sql.Int, trId);
    req.input("offset", sql.Int, offset);
    req.input("pageSize", sql.Int, BATCH);
    const rs = await req.query(`
      SELECT
        p.AccountNumber,
        p.Money
      FROM dbo.PayedContinusPayment AS p WITH (NOLOCK)
      LEFT JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
        ON LTRIM(RTRIM(i.AccountNumber)) = LTRIM(RTRIM(p.AccountNumber))
      WHERE p.TransactionId = @id
        ${scopePred}
      ORDER BY p.Id
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);
    const rows = rs.recordset as Array<{
      AccountNumber: unknown;
      Money: unknown;
    }>;
    if (!rows.length) break;
    let chunk = "";
    for (const row of rows) {
      chunk += `${formatMostamariBankRecord(row.AccountNumber, row.Money)}\r\n`;
    }
    yield chunk;
    if (rows.length < BATCH) break;
    offset += BATCH;
  }
}

/**
 * Write Armaghan bank diskette to the same Diskette UNC as dbo.Export BCP.
 * Does not need xp_cmdshell — needs share write for the Node process.
 */
export async function writeMostamariArmaghanBankFile(
  trId: number,
  fileName: string,
): Promise<{ uncPath: string; bytes: number; ms: number }> {
  if (!Number.isFinite(trId) || trId <= 0) {
    throw new Error("TransactionId نامعتبر");
  }
  const safe = String(fileName || "").trim();
  if (!safe || /[\\/:*?"<>|]/.test(safe) || safe.includes("..")) {
    throw new Error("نام فایل دیسکت بانک نامعتبر است");
  }
  const uncPath = path.win32.join(yaraneDisketteUncRoot(), safe);
  const started = Date.now();
  const stream = createWriteStream(uncPath, { encoding: "ascii", flags: "w" });
  let bytes = 0;

  const write = async (chunk: string) => {
    bytes += Buffer.byteLength(chunk, "ascii");
    if (!stream.write(chunk)) {
      await once(stream, "drain");
    }
  };

  try {
    for await (const chunk of iterateMostamariBankDiskette(trId)) {
      await write(chunk);
    }
    stream.end();
    await once(stream, "finish");
  } catch (err) {
    stream.destroy();
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(
      `نوشتن دیسکت بانک روی مسیر ارمغان ناموفق بود (${uncPath}): ${raw}`,
    );
  }

  return { uncPath, bytes, ms: Date.now() - started };
}
