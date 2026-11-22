import { readFileSync } from "fs";
import sql from "mssql";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

function b64(v) {
  try {
    return Buffer.from(v || "", "base64").toString("utf8");
  } catch {
    return "";
  }
}

function normalizeSheba(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  if (s.startsWith("IR")) s = "IR" + s.slice(2).replace(/\D/g, "");
  else s = "IR" + s.replace(/\D/g, "");
  return /^IR\d{24}$/.test(s) ? s : null;
}

function normalizeNid(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length === 10 ? digits : null;
}

const password = env.PAYDISK_SQL_PASSWORD_B64
  ? b64(env.PAYDISK_SQL_PASSWORD_B64)
  : env.PAYDISK_SQL_PASSWORD || "";

const pool = await sql.connect({
  server: env.PAYDISK_SQL_HOST,
  port: Number(env.PAYDISK_SQL_PORT || 1433),
  database: env.PAYDISK_SQL_PROD_DATABASE || env.PAYDISK_SQL_DATABASE,
  user: env.PAYDISK_SQL_USER,
  password,
  options: {
    encrypt: String(env.PAYDISK_SQL_PROD_ENCRYPT || "false") === "true",
    trustServerCertificate:
      String(env.PAYDISK_SQL_TRUST_CERT || "true") === "true",
  },
  requestTimeout: 90_000,
  connectionTimeout: 20_000,
});

const trId = 10181;
console.log("Using past transaction", trId, "اصلاحیه پرداخت اضافات (68 rows)");

const sampleRs = await pool.request().input("id", sql.Int, trId).query(`
  SELECT TOP 3
    per.ID AS PersonId,
    LTRIM(RTRIM(per.NID)) AS NID,
    LTRIM(RTRIM(per.FirstName)) AS FirstName,
    LTRIM(RTRIM(per.LastName)) AS LastName,
    LTRIM(RTRIM(pay.AccountNumber)) AS AccountNumber,
    LTRIM(RTRIM(i.IBN)) AS ibn
  FROM dbo.PayedContinusPayment AS pay WITH (NOLOCK)
  INNER JOIN dbo.Person AS per WITH (NOLOCK) ON pay.PersonId = per.ID
  INNER JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
    ON LTRIM(RTRIM(pay.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
  WHERE pay.TransactionId = @id
    AND per.NID IS NOT NULL AND LTRIM(RTRIM(per.NID)) <> N''
    AND i.IBN IS NOT NULL AND LTRIM(RTRIM(i.IBN)) <> N'' AND i.IBN <> N'null'
`);

console.log("SAMPLES", JSON.stringify(sampleRs.recordset, null, 2));
const sample = sampleRs.recordset[0];
await pool.close();

if (!sample) {
  console.log("NO_SAMPLE");
  process.exit(1);
}

const nationalId = normalizeNid(sample.NID);
const shebaId = normalizeSheba(sample.ibn);
const user = env.PAYDISK_SAYAH_USERNAME;
const pass = env.PAYDISK_SAYAH_PASSWORD;
const key = env.PAYDISK_SAYAH_USER_KEY;
const bundle = env.PAYDISK_SAYAH_BUNDLE_ID;
const base = (env.PAYDISK_SAYAH_BASE_URL || "https://gservices.nix.gov.ir").replace(
  /\/+$/,
  "",
);
const auth = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
const url = `${base}/ctx/gw/cbiir/tatbigh/1.0/SayahEstelam/CustomerHasShebaId`;

console.log("CALL", {
  url,
  user,
  nationalId,
  shebaId,
  person: sample.PersonId,
  name: `${sample.FirstName || ""} ${sample.LastName || ""}`.trim(),
});

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 20_000);
const started = Date.now();
try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      USER_KEY: key,
      "bundle-id": bundle,
      X_Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      accountOwnerType: "1",
      nationalId,
      legalId: "0",
      shebaId,
    }),
    signal: controller.signal,
  });
  const text = await res.text();
  console.log("HTTP", res.status, "ms=", Date.now() - started);
  console.log(text.slice(0, 1500));
} catch (err) {
  console.log(
    "FETCH_ERROR",
    err?.cause?.code || err?.name || "",
    err?.message || String(err),
    "ms=",
    Date.now() - started,
  );
} finally {
  clearTimeout(timer);
}
