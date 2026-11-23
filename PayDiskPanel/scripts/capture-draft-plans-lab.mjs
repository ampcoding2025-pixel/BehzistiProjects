/** Lab: estimated plans for draft INSERT source + promote shape (SHOWPLAN alone). */
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

const QUERIES = {
  "draft-emdad-insert-source": `
    SELECT PersonId, FamilyCount, ContinusPaymentSupplyLocationId, BankId, AccountNumber, Money, CenterId
    FROM dbo.ContinusPayment WITH (NOLOCK)
    WHERE ContinusPaymentSupplyLocationId = 8`,
  "draft-yarane-supply2-source": `
    SELECT MO.PersonId, MO.LocalSubsidy, MO.UniverseSubsidy, cntr.CenterId
    FROM dbo.MakeOver AS MO WITH (NOLOCK)
    INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = MO.CenterId
    INNER JOIN dbo.Person AS Person WITH (NOLOCK) ON Person.ID = MO.PersonId
    WHERE MO.MakeOverSupplyLocationId = 2 AND Person.IsDead = 0`,
  "promote-mostamari-select": `
    SELECT PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber, Money, TransactionId, Date, CenterRegistrarId
    FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK)
    WHERE TransactionId = (SELECT TOP 1 TransactionId FROM dbo.PayedContinusPayment_Draft WITH (NOLOCK))`,
};

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  requestTimeout: 120000,
}).connect();

const summary = { at: new Date().toISOString(), plans: [] };

for (const [name, q] of Object.entries(QUERIES)) {
  try {
    await pool.request().batch(`SET SHOWPLAN_XML ON;`);
    const r = await pool.request().query(q);
    await pool.request().batch(`SET SHOWPLAN_XML OFF;`);
    let xml = null;
    for (const rs of r.recordsets || [r.recordset]) {
      if (!rs?.[0]) continue;
      const v = rs[0]["Microsoft SQL Server 2005 XML Showplan"] || Object.values(rs[0])[0];
      if (typeof v === "string" && v.includes("ShowPlanXML")) {
        xml = v;
        break;
      }
    }
    if (xml) {
      fs.writeFileSync(path.join(outDir, `${name}.sqlplan.xml`), xml, "utf8");
      const scans = (xml.match(/Index Scan|Table Scan|Clustered Index Scan/gi) || []).length;
      const seeks = (xml.match(/Index Seek|Clustered Index Seek/gi) || []).length;
      summary.plans.push({ name, scans, seeks, chars: xml.length });
      console.log(name, { scans, seeks });
    } else {
      summary.plans.push({ name, error: "no xml", keys: r.recordset?.[0] ? Object.keys(r.recordset[0]) : [] });
      console.log(name, "no xml");
    }
  } catch (e) {
    summary.plans.push({ name, error: String(e.message || e) });
    console.log(name, e.message);
    try {
      await pool.request().batch(`SET SHOWPLAN_XML OFF;`);
    } catch {
      /* ignore */
    }
  }
}

fs.writeFileSync(path.join(outDir, "draft-plans-summary.json"), JSON.stringify(summary, null, 2));
await pool.close();
