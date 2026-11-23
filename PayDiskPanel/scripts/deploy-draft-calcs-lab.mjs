/**
 * Lab: deploy draft schema + Calculate*_Draft + Promote* from DRAFT_SCHEMA_AND_SPS_LAB.sql
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;LoginTimeout=20;`;

function log(...xs) {
  console.log(new Date().toISOString(), ...xs);
}

const sqlPath = path.join(
  __dirname,
  "..",
  "docs",
  "_sp_investigate",
  "all-calcs",
  "DRAFT_SCHEMA_AND_SPS_LAB.sql",
);
const raw = fs.readFileSync(sqlPath, "utf8");
// Split on GO batches (line-only)
const batches = raw
  .split(/^\s*GO\s*$/gim)
  .map((b) => b.trim())
  .filter((b) => b.length > 0 && !/^USE\s+/i.test(b));

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 30_000,
  requestTimeout: 0,
}).connect();

try {
  const meta = await pool.request().query(`SELECT @@SERVERNAME AS srv, DB_NAME() AS db`);
  log("Connected", meta.recordset[0]);
  let i = 0;
  for (const batch of batches) {
    i += 1;
    const preview = batch.slice(0, 60).replace(/\s+/g, " ");
    log(`Batch ${i}/${batches.length}`, preview);
    const req = pool.request();
    req.timeout = 600_000;
    await req.batch(batch);
  }
  const check = await pool.request().query(`
    SELECT name FROM sys.tables WHERE name IN (N'PayedContinusPayment_Draft', N'PayedMakeOvers_Draft')
    UNION ALL
    SELECT name FROM sys.procedures WHERE name LIKE N'%_Draft' OR name LIKE N'Promote%' OR name LIKE N'Clear%Draft'
    ORDER BY name
  `);
  log("Objects", check.recordset.map((r) => r.name));
} finally {
  await pool.close();
}
log("Done");
