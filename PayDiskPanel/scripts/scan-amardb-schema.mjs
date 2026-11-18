/**
 * Read-only AmarDB schema scan → docs/_amardb_schema/
 */
import { createRequire } from "module";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const sql = require("mssql");

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith("'") && v.endsWith("'")) ||
      (v.startsWith('"') && v.endsWith('"'))
    ) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\\\$/g, "$").replace(/\\#/g, "#");
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const cfg = {
  server: env.PAYDISK_SQL_HOST || "10.1.0.157",
  database: env.PAYDISK_SQL_DATABASE || "AmarDB",
  user: env.PAYDISK_SQL_USER,
  password: env.PAYDISK_SQL_PASSWORD,
  port: Number(env.PAYDISK_SQL_PORT || 1433),
  options: {
    encrypt: env.PAYDISK_SQL_ENCRYPT !== "false",
    trustServerCertificate: env.PAYDISK_SQL_TRUST_CERT === "true",
  },
  connectionTimeout: 20000,
  requestTimeout: 180000,
};

const outDir = join(process.cwd(), "docs", "_amardb_schema");
mkdirSync(outDir, { recursive: true });

console.log(`Connecting ${cfg.server}/${cfg.database} as ${cfg.user}…`);
const pool = await sql.connect(cfg);

const tables = await pool.request().query(`
SELECT
  s.name AS schema_name,
  t.name AS table_name,
  SUM(p.rows) AS approx_rows
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
GROUP BY s.name, t.name
ORDER BY s.name, t.name
`);

const columns = await pool.request().query(`
SELECT
  s.name AS schema_name,
  t.name AS table_name,
  c.name AS column_name,
  ty.name AS data_type,
  c.max_length,
  c.precision,
  c.scale,
  c.is_nullable,
  c.column_id
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
ORDER BY s.name, t.name, c.column_id
`);

const fks = await pool.request().query(`
SELECT
  fk.name AS fk_name,
  sch_p.name AS parent_schema,
  tp.name AS parent_table,
  cp.name AS parent_column,
  sch_r.name AS ref_schema,
  tr.name AS ref_table,
  cr.name AS ref_column
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.tables tp ON tp.object_id = fkc.parent_object_id
JOIN sys.schemas sch_p ON sch_p.schema_id = tp.schema_id
JOIN sys.columns cp ON cp.object_id = fkc.parent_object_id AND cp.column_id = fkc.parent_column_id
JOIN sys.tables tr ON tr.object_id = fkc.referenced_object_id
JOIN sys.schemas sch_r ON sch_r.schema_id = tr.schema_id
JOIN sys.columns cr ON cr.object_id = fkc.referenced_object_id AND cr.column_id = fkc.referenced_column_id
ORDER BY sch_p.name, tp.name, fk.name, fkc.constraint_column_id
`);

const procs = await pool.request().query(`
SELECT s.name AS schema_name, p.name AS proc_name
FROM sys.procedures p
JOIN sys.schemas s ON s.schema_id = p.schema_id
WHERE p.name LIKE 'Calculate%'
   OR p.name LIKE '%MakeOver%'
   OR p.name LIKE '%Transaction%'
   OR p.name LIKE '%Disk%'
   OR p.name LIKE '%Yarane%'
   OR p.name LIKE '%Mostamar%'
   OR p.name LIKE '%Continus%'
   OR p.name LIKE '%IBN%'
ORDER BY s.name, p.name
`);

const views = await pool.request().query(`
SELECT s.name AS schema_name, v.name AS view_name
FROM sys.views v
JOIN sys.schemas s ON s.schema_id = v.schema_id
ORDER BY s.name, v.name
`);

await pool.close();

const tableRows = tables.recordset.map((r) => ({
  schema: r.schema_name,
  table: r.table_name,
  approxRows: Number(r.approx_rows || 0),
}));

const colRows = columns.recordset.map((r) => ({
  schema: r.schema_name,
  table: r.table_name,
  column: r.column_name,
  type: r.data_type,
  maxLength: r.max_length,
  precision: r.precision,
  scale: r.scale,
  nullable: !!r.is_nullable,
  ordinal: r.column_id,
}));

const fkRows = fks.recordset.map((r) => ({
  name: r.fk_name,
  from: `${r.parent_schema}.${r.parent_table}.${r.parent_column}`,
  to: `${r.ref_schema}.${r.ref_table}.${r.ref_column}`,
  parentSchema: r.parent_schema,
  parentTable: r.parent_table,
  parentColumn: r.parent_column,
  refSchema: r.ref_schema,
  refTable: r.ref_table,
  refColumn: r.ref_column,
}));

const paydiskTables = tableRows.filter((t) =>
  /MakeOver|Payed|Transaction|IBN|Person|Center|City|Province|Supply|Continus|Disk|Subsidy|Mostamar|Yarane/i.test(
    t.table,
  ),
);

const summary = {
  scannedAt: new Date().toISOString(),
  server: cfg.server,
  database: cfg.database,
  policy: "metadata SELECT only",
  counts: {
    tables: tableRows.length,
    columns: colRows.length,
    fks: fkRows.length,
    views: views.recordset.length,
    relevantProcs: procs.recordset.length,
    paydiskRelatedTables: paydiskTables.length,
  },
  paydiskRelatedTables: paydiskTables,
  calculateAndRelatedProcs: procs.recordset,
};

writeFileSync(join(outDir, "tables.json"), JSON.stringify(tableRows, null, 2));
writeFileSync(join(outDir, "columns.json"), JSON.stringify(colRows, null, 2));
writeFileSync(join(outDir, "fks.json"), JSON.stringify(fkRows, null, 2));
writeFileSync(
  join(outDir, "views.json"),
  JSON.stringify(views.recordset, null, 2),
);
writeFileSync(
  join(outDir, "procs-relevant.json"),
  JSON.stringify(procs.recordset, null, 2),
);
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary.counts, null, 2));
console.log("Wrote", outDir);
