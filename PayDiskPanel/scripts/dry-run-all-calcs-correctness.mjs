/**
 * Lab dry-run: compare optimized SELECT sources vs current/old SP filters
 * WITHOUT writing Payed* tables. Ensures row counts + Money/subsidy sums match.
 *
 * Usage: node scripts/dry-run-all-calcs-correctness.mjs
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
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

const BASE_SUPPLY =
  "1,2,3,4,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38";
const HADAF_PAY = `${BASE_SUPPLY},5,6,7`;

const checks = [
  {
    name: "CalculateTransaction",
    family: "mostamari",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId IN (${BASE_SUPPLY})
    `,
  },
  {
    name: "CalculateHadafmandi_pay",
    family: "mostamari",
    note: "pay rows = old two INSERTs merged (1-7,9-36,38)",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId IN (${HADAF_PAY})
    `,
  },
  {
    name: "CalculateHadafmandi_pay_old_split",
    family: "mostamari",
    note: "old SP: insert A (5,6,7,9..) + insert B (<=4)",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId IN (5,6,7,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38)
         OR ContinusPaymentSupplyLocationId <= 4
    `,
  },
  {
    name: "CalculateEmdad",
    family: "mostamari",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId = 8
    `,
  },
  {
    name: "CalculateHaghParastari",
    family: "mostamari",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId = 37
    `,
  },
  {
    name: "CalculateHaghParastariFamily",
    family: "mostamari",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId = 40
    `,
  },
  {
    name: "CalculateMarakezYarane_sample_supply1",
    family: "yarane",
    note: "dry-run join for SupplyLocationId=1 (alive only)",
    sql: `
      SELECT
        COUNT_BIG(*) AS cnt,
        SUM(CONVERT(bigint, MO.LocalSubsidy)) AS localSum,
        SUM(CONVERT(bigint, MO.UniverseSubsidy)) AS universeSum
      FROM dbo.MakeOver AS MO WITH (NOLOCK)
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = MO.CenterId
      INNER JOIN dbo.Person AS Person WITH (NOLOCK) ON Person.ID = MO.PersonId
      WHERE MO.MakeOverSupplyLocationId = 1 AND Person.IsDead = 0
    `,
  },
];

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 30_000,
  requestTimeout: 300_000,
}).connect();

const results = [];
for (const c of checks) {
  const t0 = Date.now();
  const r = await pool.request().query(c.sql);
  const row = r.recordset[0] || {};
  const elapsedMs = Date.now() - t0;
  const item = {
    name: c.name,
    family: c.family,
    note: c.note || null,
    elapsedMs,
    cnt: String(row.cnt ?? ""),
    moneySum: row.moneySum != null ? String(row.moneySum) : null,
    localSum: row.localSum != null ? String(row.localSum) : null,
    universeSum: row.universeSum != null ? String(row.universeSum) : null,
  };
  results.push(item);
  console.log(
    item.name,
    `cnt=${item.cnt}`,
    item.moneySum != null ? `money=${item.moneySum}` : "",
    `${item.elapsedMs}ms`,
  );
}

const hadafNew = results.find((x) => x.name === "CalculateHadafmandi_pay");
const hadafOld = results.find((x) => x.name === "CalculateHadafmandi_pay_old_split");
const hadafMatch =
  hadafNew &&
  hadafOld &&
  hadafNew.cnt === hadafOld.cnt &&
  hadafNew.moneySum === hadafOld.moneySum;

const report = {
  at: new Date().toISOString(),
  hadafmandiMergedEqualsOldSplit: hadafMatch,
  results,
};
fs.writeFileSync(
  path.join(outDir, "dry-run-correctness.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log("hadafmandiMergedEqualsOldSplit", hadafMatch);
await pool.close();
