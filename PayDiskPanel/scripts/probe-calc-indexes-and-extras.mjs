/**
 * Lab: indexes on calc hot tables + dump extra Calculate* defs not in panel whitelist.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "_sp_investigate", "all-calcs");
fs.mkdirSync(outDir, { recursive: true });

const EXTRA = [
  "CalculateHadafmaniKoodakan",
  "CalculateMade27",
  "CalculateMarakezEtiad",
  "CalculateMarakezYarane_2",
  "CalculateNegativeTransaction",
  "CalculateTransactionAsync",
  "CalculateTransactionMarakezAsync",
  "CalculateTransaction_OLD",
];

const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 30_000,
  requestTimeout: 180_000,
}).connect();

const extras = [];
for (const name of EXTRA) {
  const r = await pool.request().query(`
    SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}', N'P')) AS def
  `);
  const def = r.recordset[0]?.def || null;
  extras.push({
    name,
    chars: def ? def.length : 0,
    exists: !!def,
  });
  if (def) fs.writeFileSync(path.join(outDir, `${name}.lab.sql`), def, "utf8");
  console.log(name, def ? `ok ${def.length}c` : "MISSING");
}

const indexes = await pool.request().query(`
  SELECT
    OBJECT_SCHEMA_NAME(i.object_id) AS sch,
    OBJECT_NAME(i.object_id) AS tbl,
    i.name AS idx,
    i.type_desc,
    i.is_unique,
    i.has_filter,
    i.filter_definition,
    STUFF((
      SELECT N', ' + c.name + CASE WHEN ic.is_included_column = 1 THEN N'(INC)' ELSE N'' END
      FROM sys.index_columns ic
      INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
      ORDER BY ic.is_included_column, ic.key_ordinal
      FOR XML PATH(''), TYPE
    ).value('.', 'nvarchar(max)'), 1, 2, N'') AS cols
  FROM sys.indexes i
  WHERE i.object_id IN (
    OBJECT_ID(N'dbo.ContinusPayment'),
    OBJECT_ID(N'dbo.PayedContinusPayment'),
    OBJECT_ID(N'dbo.MakeOver'),
    OBJECT_ID(N'dbo.PayedMakeOvers'),
    OBJECT_ID(N'dbo.Person'),
    OBJECT_ID(N'dbo.Center')
  )
    AND i.name IS NOT NULL
  ORDER BY tbl, idx
`);

const counts = await pool.request().query(`
  SELECT
    (SELECT COUNT_BIG(*) FROM dbo.ContinusPayment WITH (NOLOCK)) AS ContinusPayment,
    (SELECT COUNT_BIG(*) FROM dbo.ContinusPayment WITH (NOLOCK) WHERE ContinusPaymentSupplyLocationId = 8) AS emdad8,
    (SELECT COUNT_BIG(*) FROM dbo.ContinusPayment WITH (NOLOCK) WHERE ContinusPaymentSupplyLocationId = 37) AS spinal37,
    (SELECT COUNT_BIG(*) FROM dbo.ContinusPayment WITH (NOLOCK) WHERE ContinusPaymentSupplyLocationId = 40) AS family40,
    (SELECT COUNT_BIG(*) FROM dbo.ContinusPayment WITH (NOLOCK)
      WHERE ContinusPaymentSupplyLocationId IN (5,6,7)
         OR ContinusPaymentSupplyLocationId <= 4
         OR ContinusPaymentSupplyLocationId IN (9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38)
    ) AS hadafmandiApprox,
    (SELECT COUNT_BIG(*) FROM dbo.MakeOver WITH (NOLOCK)) AS MakeOver,
    (SELECT COUNT_BIG(*) FROM dbo.PayedMakeOvers WITH (NOLOCK)) AS PayedMakeOvers
`);

const out = {
  at: new Date().toISOString(),
  extras,
  counts: counts.recordset[0],
  indexes: indexes.recordset,
};
fs.writeFileSync(
  path.join(outDir, "indexes-and-extras.json"),
  JSON.stringify(out, null, 2),
  "utf8",
);
console.log("counts", counts.recordset[0]);
console.log("indexes", indexes.recordset.length);
await pool.close();
