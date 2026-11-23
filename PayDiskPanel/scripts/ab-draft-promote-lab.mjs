/**
 * Lab A/B: draft calc → compare to ContinusPayment/MakeOver source → promote → compare live.
 * Does not set Ky/Key2 (promote only).
 *
 * Usage: node scripts/ab-draft-promote-lab.mjs
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

function log(...xs) {
  console.log(new Date().toISOString(), ...xs);
}

const TESTS = [
  {
    name: "CalculateEmdad_Draft",
    promote: "PromoteMostamariDraft",
    supply: 8,
    findTxn: `
      SELECT TOP 1 TransactionId AS Id FROM dbo.PayedContinusPayment WITH (NOLOCK)
      WHERE SupplyLocationId = 8 GROUP BY TransactionId ORDER BY MAX(Id) DESC`,
    expectedSql: `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.ContinusPayment WITH (NOLOCK) WHERE ContinusPaymentSupplyLocationId = 8`,
    draftSql: (id) => `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK) WHERE TransactionId = ${id}`,
    liveSql: (id) => `
      SELECT COUNT_BIG(*) AS cnt, SUM(CONVERT(bigint, Money)) AS moneySum
      FROM dbo.PayedContinusPayment WITH (NOLOCK) WHERE TransactionId = ${id}`,
    execDraft: async (pool, trId) => {
      const req = pool.request();
      req.timeout = 600_000;
      req.input("TrId", sql.BigInt, trId);
      await req.execute("dbo.CalculateEmdad_Draft");
    },
    execPromote: async (pool, trId) => {
      const req = pool.request();
      req.timeout = 600_000;
      req.input("TrId", sql.BigInt, trId);
      await req.execute("dbo.PromoteMostamariDraft");
    },
  },
  {
    name: "CalculateMarakezYarane_Draft",
    promote: "PromoteYaraneDraft",
    supplyId: 2,
    findTxn: `
      SELECT TOP 1 TransactionId AS Id FROM dbo.PayedMakeOvers WITH (NOLOCK)
      WHERE MakeOverSupplyLocationId = 2 GROUP BY TransactionId ORDER BY MAX(Id) DESC`,
    expectedSql: `
      SELECT COUNT_BIG(*) AS cnt,
        SUM(CONVERT(bigint, MO.LocalSubsidy)) AS localSum,
        SUM(CONVERT(bigint, MO.UniverseSubsidy)) AS universeSum
      FROM dbo.MakeOver AS MO WITH (NOLOCK)
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = MO.CenterId
      INNER JOIN dbo.Person AS Person WITH (NOLOCK) ON Person.ID = MO.PersonId
      WHERE MO.MakeOverSupplyLocationId = 2 AND Person.IsDead = 0`,
    draftSql: (id) => `
      SELECT COUNT_BIG(*) AS cnt,
        SUM(CONVERT(bigint, LocalSubsidy)) AS localSum,
        SUM(CONVERT(bigint, UniverseSubsidy)) AS universeSum
      FROM dbo.PayedMakeOvers_Draft WITH (NOLOCK) WHERE TransactionId = ${id}`,
    liveSql: (id) => `
      SELECT COUNT_BIG(*) AS cnt,
        SUM(CONVERT(bigint, LocalSubsidy)) AS localSum,
        SUM(CONVERT(bigint, UniverseSubsidy)) AS universeSum
      FROM dbo.PayedMakeOvers WITH (NOLOCK) WHERE TransactionId = ${id}`,
    execDraft: async (pool, trId) => {
      const req = pool.request();
      req.timeout = 600_000;
      req.input("TransactionId", sql.BigInt, trId);
      req.input("SupplyLocationId", sql.BigInt, 2);
      await req.execute("dbo.CalculateMarakezYarane_Draft");
    },
    execPromote: async (pool, trId) => {
      const req = pool.request();
      req.timeout = 600_000;
      req.input("TransactionId", sql.BigInt, trId);
      await req.execute("dbo.PromoteYaraneDraft");
    },
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
    const exp = (await pool.request().query(t.expectedSql)).recordset[0];
    const peer = (await pool.request().query(t.findTxn)).recordset[0];
    const trId = peer?.Id;
    if (!trId) {
      report.runs.push({ name: t.name, skip: true });
      continue;
    }
    log(t.name, `draft @TrId=${trId}`);
    const t0 = Date.now();
    await t.execDraft(pool, trId);
    const draftMs = Date.now() - t0;
    const draft = (await pool.request().query(t.draftSql(trId))).recordset[0];

    const draftMatch =
      String(draft.cnt) === String(exp.cnt) &&
      (exp.moneySum == null || String(draft.moneySum) === String(exp.moneySum)) &&
      (exp.localSum == null || String(draft.localSum) === String(exp.localSum));

    log(t.name, "draft", draftMatch ? "MATCH" : "MISMATCH", draft);

    const t1 = Date.now();
    await t.execPromote(pool, trId);
    const promoteMs = Date.now() - t1;
    const live = (await pool.request().query(t.liveSql(trId))).recordset[0];
    const draftLeft = (
      await pool.request().query(
        t.name.includes("Marakez")
          ? `SELECT COUNT_BIG(*) AS cnt FROM dbo.PayedMakeOvers_Draft WHERE TransactionId=${trId}`
          : `SELECT COUNT_BIG(*) AS cnt FROM dbo.PayedContinusPayment_Draft WHERE TransactionId=${trId}`,
      )
    ).recordset[0];

    const promoteMatch =
      String(live.cnt) === String(exp.cnt) &&
      (exp.moneySum == null || String(live.moneySum) === String(exp.moneySum)) &&
      (exp.localSum == null || String(live.localSum) === String(exp.localSum)) &&
      Number(draftLeft.cnt) === 0;

    log(t.name, "promote", promoteMatch ? "MATCH" : "MISMATCH", live, `draftLeft=${draftLeft.cnt}`);

    report.runs.push({
      name: t.name,
      trId: String(trId),
      draftMs,
      promoteMs,
      expected: exp,
      draft,
      live,
      draftLeft: Number(draftLeft.cnt),
      draftMatch,
      promoteMatch,
    });
  }
} finally {
  await pool.close();
}

fs.writeFileSync(
  path.join(outDir, "ab-draft-promote.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
log("Wrote ab-draft-promote.json");
