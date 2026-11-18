import { createRequire } from "module";
import { readFileSync } from "fs";
import { join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const sql = require("mssql");
const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"')))
    v = v.slice(1, -1);
  env[m[1]] = v.replace(/\\\$/g, "$").replace(/\\#/g, "#");
}

const pool = await sql.connect({
  server: env.PAYDISK_SQL_HOST,
  database: env.PAYDISK_SQL_DATABASE,
  user: env.PAYDISK_SQL_USER,
  password: env.PAYDISK_SQL_PASSWORD,
  port: 1433,
  options: { encrypt: true, trustServerCertificate: true },
  requestTimeout: 120000,
});

const counts = await pool.request().query(`
SELECT
  (SELECT COUNT(*) FROM sys.procedures) AS procs,
  (SELECT COUNT(*) FROM sys.foreign_keys) AS fks,
  (SELECT COUNT(*) FROM sys.views) AS views
`);
console.log("counts", counts.recordset[0]);

const schemas = await pool.request().query(`
SELECT s.name, COUNT(*) n
FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
GROUP BY s.name ORDER BY n DESC
`);
console.log("schemas", schemas.recordset);

const sample = await pool.request().query(`
SELECT TOP 40 name FROM sys.procedures ORDER BY name
`);
console.log("procs sample", sample.recordset.map((r) => r.name));

const calc = await pool.request().query(`
SELECT name FROM sys.procedures WHERE name LIKE 'Calculate%' ORDER BY name
`);
console.log("Calculate*", calc.recordset.map((r) => r.name));

await pool.close();
