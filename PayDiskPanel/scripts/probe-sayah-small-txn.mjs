/**
 * Smoke-test Sayah REST / SOAP / auto against txn 10181 sample.
 * Usage: node --import tsx scripts/probe-sayah-small-txn.mjs
 *    or: npx tsx scripts/probe-sayah-small-txn.mjs
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

const { customerHasShebaId, sayahTransportStatus } = await import(
  "../src/lib/sayah/tatbigh.ts"
);

console.log("transport", sayahTransportStatus());

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
  requestTimeout: 90_000,
  connectionTimeout: 20_000,
});

const trId = 10181;
const sampleRs = await pool.request().input("id", sql.Int, trId).query(`
  SELECT TOP 1
    LTRIM(RTRIM(per.NID)) AS NID,
    LTRIM(RTRIM(i.IBN)) AS ibn,
    LTRIM(RTRIM(per.FirstName)) AS FirstName,
    LTRIM(RTRIM(per.LastName)) AS LastName
  FROM dbo.PayedContinusPayment AS pay WITH (NOLOCK)
  INNER JOIN dbo.Person AS per WITH (NOLOCK) ON pay.PersonId = per.ID
  INNER JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
    ON LTRIM(RTRIM(pay.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
  WHERE pay.TransactionId = @id
    AND per.NID IS NOT NULL AND LTRIM(RTRIM(per.NID)) <> N''
    AND i.IBN IS NOT NULL AND LTRIM(RTRIM(i.IBN)) <> N'' AND i.IBN <> N'null'
`);
await pool.close();

const sample = sampleRs.recordset[0];
if (!sample) {
  console.log("NO_SAMPLE");
  process.exit(1);
}

const req = {
  accountOwnerType: "1",
  nationalId: String(sample.NID).replace(/\D/g, ""),
  legalId: "0",
  shebaId: String(sample.ibn).trim().toUpperCase(),
};
console.log("sample", {
  trId,
  name: `${sample.FirstName} ${sample.LastName}`,
  ...req,
});

for (const mode of ["rest", "soap", "auto"]) {
  const t0 = Date.now();
  const result = await customerHasShebaId(req, { mode, timeoutMs: 12_000 });
  console.log(`\n=== ${mode} (${Date.now() - t0}ms) ===`);
  console.log({
    ok: result.ok,
    matched: result.matched,
    hasError: result.hasError,
    transport: result.transport,
    tried: result.tried,
    statusCode: result.statusCode,
    message: result.message,
  });
}
