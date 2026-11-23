/**
 * Sample Center.IBN / Account values that fail fixShebaId for a یارانه txn.
 * Usage: npx tsx scripts/probe-invalid-sheba-format.mjs [trId]
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sql from "mssql";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim();
  if (k.startsWith("PAYDISK_")) process.env[k] = v;
}

function b64(v) {
  try {
    return Buffer.from(v || "", "base64").toString("utf8");
  } catch {
    return "";
  }
}

const { fixShebaId } = await import("../src/lib/sayah/tatbigh.ts");

const password = process.env.PAYDISK_SQL_PASSWORD_B64
  ? b64(process.env.PAYDISK_SQL_PASSWORD_B64)
  : process.env.PAYDISK_SQL_PASSWORD || "";

const pool = await sql.connect({
  server: process.env.PAYDISK_SQL_HOST,
  port: Number(process.env.PAYDISK_SQL_PORT || 1433),
  database:
    process.env.PAYDISK_SQL_PROD_DATABASE || process.env.PAYDISK_SQL_DATABASE,
  user: process.env.PAYDISK_SQL_USER,
  password,
  options: {
    encrypt: String(process.env.PAYDISK_SQL_PROD_ENCRYPT || "false") === "true",
    trustServerCertificate:
      String(process.env.PAYDISK_SQL_TRUST_CERT || "true") === "true",
  },
  requestTimeout: 120_000,
  connectionTimeout: 20_000,
});

const trId = Number(process.argv[2] || 727);
const rs = await pool.request().input("id", sql.Int, trId).query(`
  SELECT DISTINCT TOP 80
    cntr.CenterId,
    LTRIM(RTRIM(cntr.IBN)) AS ibn,
    LTRIM(RTRIM(cntr.Account)) AS Account
  FROM dbo.PayedMakeOvers AS p WITH (NOLOCK)
  INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
  WHERE p.TransactionId = @id
`);
await pool.close();

const invalid = [];
const looksLikeIr = [];
for (const row of rs.recordset) {
  const ibn = row.ibn;
  const acc = row.Account;
  const a = fixShebaId(ibn);
  const b = fixShebaId(acc);
  const ok = !!(a.sheba || b.sheba);
  if (ok) continue;
  const raw = String(ibn || acc || "");
  if (!raw || /^null$/i.test(raw.trim())) continue;
  const rec = {
    CenterId: row.CenterId,
    ibn,
    Account: acc,
    ibnFix: a,
    accFix: b,
    rawCodes: [...String(ibn || "")].slice(0, 8).map((c) => c.charCodeAt(0)),
  };
  invalid.push(rec);
  if (/ir/i.test(raw)) looksLikeIr.push(rec);
}

console.log("trId", trId, "centers", rs.recordset.length);
console.log("invalidFormat", invalid.length, "withIR-ish", looksLikeIr.length);
console.log("sample invalid", JSON.stringify(invalid.slice(0, 15), null, 2));
console.log("sample IR-ish", JSON.stringify(looksLikeIr.slice(0, 15), null, 2));
