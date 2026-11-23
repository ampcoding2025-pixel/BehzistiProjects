/**
 * Lab read-only: dump all یارانه/مستمری calc proc defs + DMV timing + deps.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "_sp_investigate", "all-calcs");
fs.mkdirSync(outDir, { recursive: true });

const PROCS = [
  { name: "CalculateTransaction", family: "mostamari", panel: "mst-base" },
  { name: "CalculateHadafmandi", family: "mostamari", panel: "mst-hadafmandi" },
  { name: "CalculateHaghParastariFamily", family: "mostamari", panel: "mst-hagh-family" },
  { name: "CalculateHaghParastari", family: "mostamari", panel: "mst-hagh-spinal" },
  { name: "CalculateEmdad", family: "mostamari", panel: "mst-emdad" },
  { name: "CalculateMarakezYarane", family: "yarane", panel: "yrn-*" },
];

const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);
const sql = require("mssql/msnodesqlv8");
const cs = `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;`;

function summarizeDef(def) {
  if (!def) return null;
  const text = String(def);
  const lower = text.toLowerCase();
  return {
    chars: text.length,
    lines: text.split(/\r?\n/).length,
    hasNoCount: /set\s+nocount\s+on/i.test(text),
    hasBeginTran: /begin\s+tran/i.test(text),
    hasWholeTableUpdate:
      /update\s+[\w.]*continuspayment[\s\S]{0,80}where\s+[\w.]*\s+is\s+null/i.test(
        text,
      ) || /baccountvalidated/i.test(text),
    insertCount: (lower.match(/\binsert\s+into\b/g) || []).length,
    deleteCount: (lower.match(/\bdelete\b/g) || []).length,
    updateCount: (lower.match(/\bupdate\b/g) || []).length,
    mentionsItDb: /\bit\.dbo\b/i.test(text),
    threePartDb: /DB_Mostamary\.dbo/i.test(text),
  };
}

const pool = await new sql.ConnectionPool({
  connectionString: cs,
  connectionTimeout: 30_000,
  requestTimeout: 180_000,
}).connect();

const summary = {
  at: new Date().toISOString(),
  server: null,
  procs: [],
};

const srv = await pool.request().query(`SELECT @@SERVERNAME AS srv, DB_NAME() AS db`);
summary.server = srv.recordset[0];

for (const p of PROCS) {
  const row = { ...p };
  try {
    const defRs = await pool.request().query(`
      SELECT
        OBJECT_ID(N'dbo.${p.name}', N'P') AS procId,
        OBJECT_DEFINITION(OBJECT_ID(N'dbo.${p.name}', N'P')) AS def
    `);
    const def = defRs.recordset[0]?.def || null;
    row.procId = defRs.recordset[0]?.procId || null;
    row.summary = summarizeDef(def);
    if (def) {
      fs.writeFileSync(path.join(outDir, `${p.name}.lab.sql`), def, "utf8");
    }

    const params = await pool.request().query(`
      SELECT par.name AS paramName, t.name AS typeName, par.is_output, par.parameter_id
      FROM sys.procedures p
      JOIN sys.parameters par ON par.object_id = p.object_id
      JOIN sys.types t ON t.user_type_id = par.user_type_id
      WHERE p.name = N'${p.name}'
      ORDER BY par.parameter_id
    `);
    row.params = params.recordset;

    const deps = await pool.request().query(`
      SELECT DISTINCT
        OBJECT_SCHEMA_NAME(d.referenced_id) AS sch,
        OBJECT_NAME(d.referenced_id) AS obj,
        o.type_desc
      FROM sys.sql_expression_dependencies d
      LEFT JOIN sys.objects o ON o.object_id = d.referenced_id
      WHERE d.referencing_id = OBJECT_ID(N'dbo.${p.name}')
        AND d.referenced_id IS NOT NULL
      ORDER BY sch, obj
    `);
    row.dependencies = deps.recordset;

    const stats = await pool.request().query(`
      SELECT TOP 3
        execution_count,
        total_elapsed_time / 1000 AS total_elapsed_ms,
        total_worker_time / 1000 AS total_cpu_ms,
        total_logical_reads,
        last_elapsed_time / 1000 AS last_elapsed_ms,
        last_execution_time
      FROM sys.dm_exec_procedure_stats
      WHERE database_id = DB_ID()
        AND object_id = OBJECT_ID(N'dbo.${p.name}')
      ORDER BY last_execution_time DESC
    `);
    row.procStats = stats.recordset;

    const stmts = await pool.request().query(`
      SELECT TOP 8
        qs.execution_count,
        qs.total_elapsed_time / 1000 AS total_elapsed_ms,
        qs.total_worker_time / 1000 AS total_cpu_ms,
        qs.total_logical_reads,
        qs.total_rows,
        SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
          ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text)
            ELSE qs.statement_end_offset END - qs.statement_start_offset)/2) + 1) AS statement_text
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
      WHERE st.objectid = OBJECT_ID(N'dbo.${p.name}')
        AND st.dbid = DB_ID()
      ORDER BY qs.total_elapsed_time DESC
    `);
    row.topStatements = (stmts.recordset || []).map((r) => ({
      ...r,
      statement_text: String(r.statement_text || "")
        .replace(/\s+/g, " ")
        .slice(0, 280),
    }));
  } catch (e) {
    row.error = e.message;
  }
  summary.procs.push(row);
  console.log(
    p.name,
    row.procId ? `ok ${row.summary?.chars}c` : "MISSING",
    row.topStatements?.[0]
      ? `topStmt ${row.topStatements[0].total_elapsed_ms}ms`
      : "no-stmt-cache",
  );
}

// Missing indexes touching hot tables
try {
  const miss = await pool.request().query(`
    SELECT TOP 25
      mid.statement AS tableRef,
      migs.avg_total_user_cost * migs.avg_user_impact * (migs.user_seeks + migs.user_scans) AS improvement,
      migs.user_seeks,
      migs.avg_user_impact,
      mid.equality_columns,
      mid.inequality_columns,
      mid.included_columns
    FROM sys.dm_db_missing_index_groups mig
    JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
    JOIN sys.dm_db_missing_index_details mid ON mid.index_handle = mig.index_handle
    WHERE mid.database_id = DB_ID()
      AND (
        mid.statement LIKE N'%ContinusPayment%'
        OR mid.statement LIKE N'%PayedContinusPayment%'
        OR mid.statement LIKE N'%PayedMakeOvers%'
        OR mid.statement LIKE N'%MakeOver%'
        OR mid.statement LIKE N'%Person%'
      )
    ORDER BY improvement DESC
  `);
  summary.missingIndexes = miss.recordset;
  fs.writeFileSync(
    path.join(outDir, "missing-indexes.json"),
    JSON.stringify(miss.recordset, null, 2),
  );
} catch (e) {
  summary.missingIndexesError = e.message;
}

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
await pool.close();
console.log("Wrote", outDir);
