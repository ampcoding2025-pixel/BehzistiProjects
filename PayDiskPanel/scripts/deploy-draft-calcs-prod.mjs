/**
 * Prod 155: deploy draft schema + SPs (same SQL as lab).
 * Requires PAYDISK_SQL_WRITE_* (DDL). Keeps live Calculate* untouched.
 *
 * Usage: node scripts/deploy-draft-calcs-prod.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql");

const host = env.PAYDISK_SQL_HOST || "10.1.0.155";
const database = env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary";
const user = (env.PAYDISK_SQL_WRITE_USER || "").trim();
const password = env.PAYDISK_SQL_WRITE_PASSWORD_B64
  ? Buffer.from(env.PAYDISK_SQL_WRITE_PASSWORD_B64, "base64").toString("utf8")
  : env.PAYDISK_SQL_WRITE_PASSWORD || "";

if (!user || !password) {
  console.error("Need PAYDISK_SQL_WRITE_USER + PASSWORD_B64");
  process.exit(1);
}

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
const batches = raw
  .split(/^\s*GO\s*$/gim)
  .map((b) => b.trim())
  .filter((b) => b.length > 0 && !/^USE\s+/i.test(b));

const pool = await sql.connect({
  server: host,
  database,
  user,
  password,
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  connectionTimeout: 30000,
  requestTimeout: 600000,
});

try {
  log("Connected", { host, database, user });
  let i = 0;
  for (const batch of batches) {
    i += 1;
    log(`Batch ${i}/${batches.length}`, batch.slice(0, 50).replace(/\s+/g, " "));
    await pool.request().batch(batch);
  }
  const check = await pool.request().query(`
    SELECT name FROM sys.tables WHERE name IN (N'PayedContinusPayment_Draft', N'PayedMakeOvers_Draft')
    UNION ALL
    SELECT name FROM sys.procedures
    WHERE name LIKE N'%_Draft' OR name IN (N'PromoteMostamariDraft', N'PromoteYaraneDraft', N'ClearMostamariDraft', N'ClearYaraneDraft')
    ORDER BY name
  `);
  log("Objects", check.recordset.map((r) => r.name));
} finally {
  await pool.close();
}
log("Prod draft deploy done — enable PAYDISK_CALC_DRAFT=true after validation");
