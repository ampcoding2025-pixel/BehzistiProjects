/**
 * Lab A/B: EXEC optimized small mostamari SPs + MarakezYarane vs expected source totals.
 * Reuses existing PayedTransaction rows (does not create new ones).
 *
 * Usage:
 *   node scripts/ab-small-calcs-lab.mjs
 *   node scripts/ab-small-calcs-lab.mjs --skip-yarane
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "_sp_investigate", "all-calcs");
const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);

const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

function log(...xs) {
  console.log(new Date().toISOString(), ...xs);
}

const TESTS = [
  {
    name: "CalculateEmdad",
    supply: 8,
    findTxn: `
      SELECT TOP 1 Id FROM dbo.PayedTransaction WITH (NOLOCK)
      WHERE Description LIKE N'%محاسبه%' OR Title LIKE N'%امداد%'
      ORDER BY Id DESC`,
  },
  {
    name: "CalculateHaghParastari",
    supply: 37,
    findTxn: `
      SELECT TOP 1 Id FROM dbo.PayedTransaction WITH (NOLOCK)
      WHERE Title LIKE N'%نخاع%' OR Title LIKE N'%پرستار%'
      ORDER BY Id DESC`,
  },
  {
    name: "CalculateHaghParastariFamily",
    supply: 40,
    findTxn: `
      SELECT TOP 1 Id FROM dbo.PayedTransaction WITH (NOLOCK)
      WHERE Title LIKE N'%خانواده%' OR Title LIKE N'%پرستار%'
      ORDER BY Id DESC`,
  },
];

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 30_000,
  requestTimeout: 0,
}).connect();

const report = { at: new Date().toISOString(), runs: [] };

try {
  for (const t of TESTS) {
    const exp = await pool.request().query(`
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId = ${t.supply}
    `);
    const expected = exp.recordset[0];

    // Prefer a txn that already has rows for this supply in PayedContinusPayment
    const peer = await pool.request().query(`
      SELECT TOP 1 TransactionId AS Id
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE SupplyLocationId = ${t.supply}
      GROUP BY TransactionId
      ORDER BY MAX(Id) DESC
    `);
    let trId = peer.recordset[0]?.Id;
    if (!trId) {
      const fb = await pool.request().query(t.findTxn);
      trId = fb.recordset[0]?.Id;
    }
    if (!trId) {
      log(t.name, "SKIP — no txn");
      report.runs.push({ name: t.name, skip: true });
      continue;
    }

    log(t.name, `EXEC @TrId=${trId} expected cnt=${expected.cnt}`);
    const t0 = Date.now();
    const req = pool.request();
    req.timeout = 600_000;
    req.input("TrId", sql.BigInt, trId);
    await req.execute(t.name);
    const elapsedMs = Date.now() - t0;

    const after = await pool.request().query(`
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE TransactionId = ${trId}
    `);
    const a = after.recordset[0];
    const ok =
      String(a.cnt) === String(expected.cnt) &&
      String(a.moneySum) === String(expected.moneySum);
    const row = {
      name: t.name,
      trId: String(trId),
      supply: t.supply,
      elapsedMs,
      expected: { cnt: String(expected.cnt), moneySum: String(expected.moneySum) },
      after: { cnt: String(a.cnt), moneySum: String(a.moneySum) },
      match: ok,
    };
    report.runs.push(row);
    log(t.name, ok ? "MATCH" : "MISMATCH", `${Math.round(elapsedMs / 1000)}s`, row.after);
  }

  if (args["skip-yarane"] !== "true") {
    const supplyId = 2;
    const exp = await pool.request().query(`
      SELECT
        COUNT_BIG(*) AS cnt,
        SUM(CONVERT(bigint, MO.LocalSubsidy)) AS localSum,
        SUM(CONVERT(bigint, MO.UniverseSubsidy)) AS universeSum
      FROM dbo.MakeOver AS MO WITH (NOLOCK)
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = MO.CenterId
      INNER JOIN dbo.Person AS Person WITH (NOLOCK) ON Person.ID = MO.PersonId
      WHERE MO.MakeOverSupplyLocationId = ${supplyId} AND Person.IsDead = 0
    `);
    const expected = exp.recordset[0];

    const peer = await pool.request().query(`
      SELECT TOP 1 TransactionId AS Id
      FROM dbo.PayedMakeOvers WITH (NOLOCK)
      WHERE MakeOverSupplyLocationId = ${supplyId}
      GROUP BY TransactionId
      ORDER BY MAX(Id) DESC
    `);
    const trId = peer.recordset[0]?.Id;
    if (!trId) {
      log("CalculateMarakezYarane SKIP — no txn");
      report.runs.push({ name: "CalculateMarakezYarane", skip: true });
    } else {
      log(
        "CalculateMarakezYarane",
        `EXEC @TransactionId=${trId} @SupplyLocationId=${supplyId} expected=${expected.cnt}`,
      );
      const t0 = Date.now();
      const req = pool.request();
      req.timeout = 600_000;
      req.input("TransactionId", sql.BigInt, trId);
      req.input("SupplyLocationId", sql.BigInt, supplyId);
      await req.execute("CalculateMarakezYarane");
      const elapsedMs = Date.now() - t0;

      const after = await pool.request().query(`
        SELECT
          COUNT_BIG(*) AS cnt,
          SUM(CONVERT(bigint, LocalSubsidy)) AS localSum,
          SUM(CONVERT(bigint, UniverseSubsidy)) AS universeSum
        FROM dbo.PayedMakeOvers WITH (NOLOCK)
        WHERE TransactionId = ${trId}
      `);
      const a = after.recordset[0];
      const ok =
        String(a.cnt) === String(expected.cnt) &&
        String(a.localSum) === String(expected.localSum) &&
        String(a.universeSum) === String(expected.universeSum);
      const row = {
        name: "CalculateMarakezYarane",
        trId: String(trId),
        supplyId,
        elapsedMs,
        expected: {
          cnt: String(expected.cnt),
          localSum: String(expected.localSum),
          universeSum: String(expected.universeSum),
        },
        after: {
          cnt: String(a.cnt),
          localSum: String(a.localSum),
          universeSum: String(a.universeSum),
        },
        match: ok,
      };
      report.runs.push(row);
      log(
        "CalculateMarakezYarane",
        ok ? "MATCH" : "MISMATCH",
        `${Math.round(elapsedMs / 1000)}s`,
        row.after,
      );
    }
  }
} finally {
  await pool.close();
}

fs.writeFileSync(
  path.join(outDir, "ab-small-calcs.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
log("Wrote ab-small-calcs.json");
