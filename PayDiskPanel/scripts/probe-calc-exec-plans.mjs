/**
 * Lab: SET STATISTICS IO/TIME + estimated plan XML for calc INSERT sources.
 * Read-only SELECTs (no DELETE/INSERT into Payed*).
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "_sp_investigate", "all-calcs", "plans");
fs.mkdirSync(outDir, { recursive: true });

const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

const BASE =
  "1,2,3,4,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38";

const QUERIES = [
  {
    name: "mst-base-source",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment AS P WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId IN (${BASE})
    `,
  },
  {
    name: "mst-base-insert-shape",
    sql: `
      SELECT TOP (1000)
        P.PersonId, P.FamilyCount, P.ContinusPaymentSupplyLocationId,
        P.BankId, P.AccountNumber, P.Money, P.CenterId
      FROM dbo.ContinusPayment AS P WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId IN (${BASE})
      ORDER BY P.ContinusPaymentId
    `,
  },
  {
    name: "mst-emdad-8",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId = 8
    `,
  },
  {
    name: "mst-family-40",
    sql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId = 40
    `,
  },
  {
    name: "yarane-makeover-supply2",
    sql: `
      SELECT
        COUNT_BIG(*) AS cnt,
        SUM(CONVERT(bigint, MO.LocalSubsidy)) AS localSum,
        SUM(CONVERT(bigint, MO.UniverseSubsidy)) AS universeSum
      FROM dbo.MakeOver AS MO WITH (NOLOCK)
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = MO.CenterId
      INNER JOIN dbo.Person AS Person WITH (NOLOCK) ON Person.ID = MO.PersonId
      WHERE MO.MakeOverSupplyLocationId = 2 AND Person.IsDead = 0
    `,
  },
  {
    name: "delete-payed-continus-sample",
    sql: `
      SELECT COUNT_BIG(*) AS cnt
      FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE TransactionId = (
        SELECT TOP 1 TransactionId FROM dbo.PayedContinusPayment WITH (NOLOCK)
        WHERE SupplyLocationId = 40
        GROUP BY TransactionId ORDER BY MAX(Id) DESC
      )
    `,
  },
  {
    name: "delete-payed-makeovers-sample",
    sql: `
      SELECT COUNT_BIG(*) AS cnt
      FROM dbo.PayedMakeOvers WITH (NOLOCK)
      WHERE TransactionId = (
        SELECT TOP 1 TransactionId FROM dbo.PayedMakeOvers WITH (NOLOCK)
        WHERE MakeOverSupplyLocationId = 2
        GROUP BY TransactionId ORDER BY MAX(Id) DESC
      )
    `,
  },
];

function summarizePlan(xml) {
  if (!xml) return null;
  const text = String(xml);
  const ops = [];
  const re =
    /PhysicalOp="([^"]+)"[^>]*EstimateRows="([^"]+)"[^>]*(?:EstimateIO="([^"]*)")?[^>]*(?:EstimateCPU="([^"]*)")?/g;
  let m;
  while ((m = re.exec(text)) && ops.length < 40) {
    ops.push({
      op: m[1],
      estimateRows: Number(m[2]),
      estimateIO: m[3] != null ? Number(m[3]) : null,
      estimateCPU: m[4] != null ? Number(m[4]) : null,
    });
  }
  ops.sort((a, b) => (b.estimateIO || 0) + (b.estimateCPU || 0) - ((a.estimateIO || 0) + (a.estimateCPU || 0)));
  const scans = [...text.matchAll(/Table Scan|Clustered Index Scan|Index Scan/gi)].map((x) => x[0]);
  const seeks = [...text.matchAll(/Index Seek|Clustered Index Seek/gi)].map((x) => x[0]);
  const missing = [...text.matchAll(/MissingIndex[^>]*>[\s\S]*?<\/MissingIndex>/gi)].slice(0, 3);
  return {
    topOps: ops.slice(0, 12),
    scanCount: scans.length,
    seekCount: seeks.length,
    scans: [...new Set(scans)],
    seeks: [...new Set(seeks)],
    missingIndexSnippets: missing.map((x) => x[0].slice(0, 400)),
    chars: text.length,
  };
}

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 30_000,
  requestTimeout: 300_000,
}).connect();

const report = { at: new Date().toISOString(), server: null, queries: [] };
const srv = await pool.request().query(`SELECT @@SERVERNAME AS srv, DB_NAME() AS db`);
report.server = srv.recordset[0];

for (const q of QUERIES) {
  console.log("plan", q.name);
  const item = { name: q.name, stats: null, plan: null, error: null };
  try {
    // Estimated plan only — avoids running heavy TOP scans as actual.
    const planRs = await pool.request().query(`
      SET SHOWPLAN_XML ON;
      ${q.sql};
      SET SHOWPLAN_XML OFF;
    `);
    // msnodesqlv8 may return plan in recordsets differently
    let xml = null;
    const sets = planRs.recordsets || [planRs.recordset];
    for (const rs of sets) {
      if (!rs || !rs.length) continue;
      const row = rs[0];
      const val = row["Microsoft SQL Server 2005 XML Showplan"] || row[Object.keys(row)[0]];
      if (typeof val === "string" && val.includes("<ShowPlanXML")) {
        xml = val;
        break;
      }
    }
    if (xml) {
      fs.writeFileSync(path.join(outDir, `${q.name}.sqlplan.xml`), xml, "utf8");
      item.plan = summarizePlan(xml);
    } else {
      item.plan = { note: "no showplan xml in result", keys: sets.map((s) => (s?.[0] ? Object.keys(s[0]) : [])) };
    }

    // Lightweight runtime IO for COUNT queries only
    if (q.name.includes("source") || q.name.includes("emdad") || q.name.includes("family") || q.name.includes("makeover") || q.name.includes("delete")) {
      const t0 = Date.now();
      const r = await pool.request().query(q.sql);
      item.runtimeMs = Date.now() - t0;
      item.result = r.recordset[0] || null;
    }
  } catch (e) {
    item.error = e instanceof Error ? e.message : String(e);
    console.error(q.name, item.error);
  }
  report.queries.push(item);
}

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2), "utf8");
console.log("Wrote", path.join(outDir, "summary.json"));
await pool.close();
