/**
 * Lab-only: backup CalculateTransaction → deploy optimized proc + covering index,
 * then optional A/B on a TrId (default 10816).
 *
 * Usage:
 *   node scripts/deploy-calculate-transaction-lab.mjs
 *   node scripts/deploy-calculate-transaction-lab.mjs --trId=10816 --skip-run
 *   node scripts/deploy-calculate-transaction-lab.mjs --trId=10816
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);
const trId = Number(args.trId || 10816);
const skipRun = args["skip-run"] === "true";
const skipBigIndex = args["skip-big-index"] !== "false"; // default skip 315M index

const sql = require("mssql/msnodesqlv8");
const cs =
  process.env.PAYDISK_TEST_SQL_CONNECTION ||
  `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;LoginTimeout=20;`;

function log(...xs) {
  console.log(new Date().toISOString(), ...xs);
}

async function execBatch(pool, text, timeoutMs = 120_000) {
  const req = pool.request();
  req.timeout = timeoutMs;
  return req.batch(text);
}

async function query(pool, text, timeoutMs = 60_000) {
  const req = pool.request();
  req.timeout = timeoutMs;
  return req.query(text);
}

async function main() {
  log("Connecting lab…");
  const pool = await new sql.ConnectionPool({
    connectionString: cs,
    connectionTimeout: 30_000,
    requestTimeout: 0, // per-request timeouts
  }).connect();

  try {
    const db = await query(pool, `SELECT DB_NAME() AS db, @@SERVERNAME AS srv`);
    log("Connected", db.recordset[0]);

    // 1) Backup current definition
    const defRs = await query(
      pool,
      `SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.CalculateTransaction', N'P')) AS def`,
    );
    const def = defRs.recordset[0]?.def;
    if (!def) throw new Error("dbo.CalculateTransaction not found on lab");

    const backupPath = path.join(
      __dirname,
      "..",
      "docs",
      "_sp_investigate",
      `CalculateTransaction.lab.backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`,
    );
    fs.writeFileSync(backupPath, def, "utf8");
    log("Wrote file backup", backupPath);

    const oldExists = await query(
      pool,
      `SELECT OBJECT_ID(N'dbo.CalculateTransaction_OLD', N'P') AS id`,
    );
    if (!oldExists.recordset[0]?.id) {
      log("Creating dbo.CalculateTransaction_OLD from current body…");
      // Rename-style: create OLD with same body but new name
      const oldBody = String(def).replace(
        /CREATE\s+PROCEDURE\s+\[?dbo\]?\.\[?CalculateTransaction\]?/i,
        "CREATE PROCEDURE [dbo].[CalculateTransaction_OLD]",
      ).replace(
        /CREATE\s+PROC\s+\[?dbo\]?\.\[?CalculateTransaction\]?/i,
        "CREATE PROCEDURE [dbo].[CalculateTransaction_OLD]",
      );
      if (!/CalculateTransaction_OLD/i.test(oldBody)) {
        throw new Error("Could not rewrite proc name for OLD backup");
      }
      await execBatch(pool, oldBody, 60_000);
      log("CalculateTransaction_OLD created");
    } else {
      log("CalculateTransaction_OLD already exists — leaving it");
    }

    // 2) Covering index on ContinusPayment (~1.7M) — main INSERT speedup
    const idx1 = await query(
      pool,
      `SELECT 1 AS ok FROM sys.indexes
       WHERE object_id = OBJECT_ID(N'dbo.ContinusPayment')
         AND name = N'IX_ContinusPayment_CalcSupply_Covering'`,
    );
    if (!idx1.recordset.length) {
      log("Creating IX_ContinusPayment_CalcSupply_Covering (may take a few minutes)…");
      const started = Date.now();
      try {
        await execBatch(
          pool,
          `
          CREATE NONCLUSTERED INDEX IX_ContinusPayment_CalcSupply_Covering
            ON dbo.ContinusPayment (ContinusPaymentSupplyLocationId)
            INCLUDE (PersonId, FamilyCount, BankId, AccountNumber, Money, CenterId)
            WITH (MAXDOP = 4);
          `,
          600_000,
        );
        log(`Covering index OK in ${Math.round((Date.now() - started) / 1000)}s`);
      } catch (e) {
        throw new Error(`Covering index failed: ${e.message}`);
      }
    } else {
      log("IX_ContinusPayment_CalcSupply_Covering already exists");
    }

    // 3) Optional big index on PayedContinusPayment (~315M) — long; skip by default
    if (!skipBigIndex) {
      const idx2 = await query(
        pool,
        `SELECT 1 AS ok FROM sys.indexes
         WHERE object_id = OBJECT_ID(N'dbo.PayedContinusPayment')
           AND name = N'IX_PayedContinusPayment_TransactionId'`,
      );
      if (!idx2.recordset.length) {
        log("Creating IX_PayedContinusPayment_TransactionId on ~315M rows — long…");
        const started = Date.now();
        await execBatch(
          pool,
          `
          CREATE NONCLUSTERED INDEX IX_PayedContinusPayment_TransactionId
            ON dbo.PayedContinusPayment (TransactionId)
            INCLUDE (Money, PersonId, AccountNumber, FamilyCount)
            WITH (MAXDOP = 4);
          `,
          3_600_000,
        );
        log(`Big index OK in ${Math.round((Date.now() - started) / 1000)}s`);
      }
    } else {
      log("Skipping big PayedContinusPayment index (use --skip-big-index=false to build)");
    }

    // 4) Deploy optimized proc (older SQL: DROP + CREATE, not CREATE OR ALTER)
    const optPath = path.join(
      __dirname,
      "..",
      "docs",
      "_sp_investigate",
      "CalculateTransaction_OPTIMIZED_LAB.sql",
    );
    const optSql = fs.readFileSync(optPath, "utf8");
    const procMatch = optSql.match(
      /CREATE OR ALTER PROCEDURE \[dbo\]\.\[CalculateTransaction\][\s\S]*?^END\s*$/im,
    );
    if (!procMatch) {
      throw new Error("Could not extract procedure body from optimized SQL");
    }
    const createSql = procMatch[0]
      .replace(/^CREATE OR ALTER PROCEDURE/i, "CREATE PROCEDURE")
      .trim();
    log("Dropping dbo.CalculateTransaction…");
    await execBatch(
      pool,
      `
      IF OBJECT_ID(N'dbo.CalculateTransaction', N'P') IS NOT NULL
        DROP PROCEDURE dbo.CalculateTransaction;
      `,
      30_000,
    );
    log("Creating optimized CalculateTransaction…");
    await execBatch(pool, createSql, 60_000);
    log("Optimized CalculateTransaction deployed");

    // Sanity: definition length
    const after = await query(
      pool,
      `SELECT LEN(OBJECT_DEFINITION(OBJECT_ID(N'dbo.CalculateTransaction'))) AS len,
              OBJECT_ID(N'dbo.CalculateTransaction_OLD') AS oldId`,
    );
    log("Post-deploy", after.recordset[0]);

    if (skipRun) {
      log("skip-run set — not executing CalculateTransaction");
      return;
    }

    // 5) Baseline + re-run on TrId
    log(`Baseline metrics for TrId=${trId}…`);
    const baseline = await query(
      pool,
      `
      SELECT
        COUNT_BIG(*) AS cnt,
        SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE TransactionId = ${trId}
      `,
      180_000,
    );
    log("Before", baseline.recordset[0]);

    const txn = await query(
      pool,
      `SELECT TOP 1 Id, Title, Description FROM dbo.PayedTransaction WITH (NOLOCK) WHERE Id = ${trId}`,
    );
    if (!txn.recordset.length) {
      log(`TrId ${trId} not found — deploy done, skip EXEC`);
      return;
    }
    log("Txn", txn.recordset[0]);

    log(`EXEC CalculateTransaction @TrId=${trId} — wait (can be several minutes)…`);
    const t0 = Date.now();
    const req = pool.request();
    req.timeout = 1_800_000; // 30 min
    req.input("TrId", sql.BigInt, trId);
    await req.execute("CalculateTransaction");
    const ms = Date.now() - t0;
    log(`EXEC finished in ${Math.round(ms / 1000)}s`);

    const afterRows = await query(
      pool,
      `
      SELECT
        COUNT_BIG(*) AS cnt,
        SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE TransactionId = ${trId}
      `,
      180_000,
    );
    log("After", afterRows.recordset[0]);

    const b = baseline.recordset[0] || {};
    const a = afterRows.recordset[0] || {};
    const report = {
      trId,
      elapsedSec: Math.round(ms / 1000),
      before: { cnt: String(b.cnt), moneySum: String(b.moneySum) },
      after: { cnt: String(a.cnt), moneySum: String(a.moneySum) },
      cntMatch: String(b.cnt) === String(a.cnt),
      moneyMatch: String(b.moneySum) === String(a.moneySum),
      note:
        "If before was from OLD proc, matching cnt/money means optimized rewrite preserved totals.",
    };
    const reportPath = path.join(
      __dirname,
      "..",
      "docs",
      "_sp_investigate",
      `lab-ab-${trId}.json`,
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    log("A/B report", report);
    log("Wrote", reportPath);
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
