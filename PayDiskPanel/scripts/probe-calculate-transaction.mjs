/**
 * Read-only: dump CalculateTransaction definition + related indexes + plan hints.
 * Lab (Windows) first; optional prod via .env.local SQL login.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "_sp_investigate");
fs.mkdirSync(outDir, { recursive: true });

const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);

async function withLab(fn) {
  const sql = require("mssql/msnodesqlv8");
  const cs =
    process.env.PAYDISK_TEST_SQL_CONNECTION ||
    `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;LoginTimeout=15;`;
  const pool = await new sql.ConnectionPool({
    connectionString: cs,
    connectionTimeout: 20_000,
    requestTimeout: 120_000,
  }).connect();
  try {
    return await fn(pool, "lab");
  } finally {
    await pool.close();
  }
}

async function withProd(fn) {
  const sql = require("mssql");
  const pool = await sql.connect({
    server: env.PAYDISK_SQL_HOST,
    port: Number(env.PAYDISK_SQL_PORT || 1433),
    database: env.PAYDISK_SQL_PROD_DATABASE || env.PAYDISK_SQL_DATABASE || "DB_Mostamary",
    user: env.PAYDISK_SQL_USER,
    password: env.PAYDISK_SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true },
    requestTimeout: 120_000,
  });
  try {
    return await fn(pool, "prod");
  } finally {
    await pool.close();
  }
}

async function investigate(pool, label) {
  const summary = { label, at: new Date().toISOString() };

  const exists = await pool.request().query(`
    SELECT
      OBJECT_ID(N'dbo.CalculateTransaction', N'P') AS procId,
      OBJECT_DEFINITION(OBJECT_ID(N'dbo.CalculateTransaction', N'P')) AS def
  `);
  const row = exists.recordset[0] || {};
  summary.procId = row.procId;
  const def = row.def ? String(row.def) : null;
  summary.defChars = def ? def.length : 0;
  if (def) {
    fs.writeFileSync(
      path.join(outDir, `CalculateTransaction.${label}.sql`),
      def,
      "utf8",
    );
  }

  // Dependencies / referenced objects (best-effort)
  try {
    const deps = await pool.request().query(`
      SELECT DISTINCT
        OBJECT_SCHEMA_NAME(d.referenced_id) AS sch,
        OBJECT_NAME(d.referenced_id) AS obj,
        o.type_desc
      FROM sys.sql_expression_dependencies d
      LEFT JOIN sys.objects o ON o.object_id = d.referenced_id
      WHERE d.referencing_id = OBJECT_ID(N'dbo.CalculateTransaction')
      ORDER BY sch, obj
    `);
    summary.dependencies = deps.recordset;
  } catch (e) {
    summary.dependenciesError = e.message;
  }

  // Indexes on hot tables
  try {
    const idx = await pool.request().query(`
      SELECT
        t.name AS tableName,
        i.name AS indexName,
        i.type_desc,
        i.is_unique,
        STUFF((
          SELECT N', ' + c.name + CASE WHEN ic.is_descending_key = 1 THEN N' DESC' ELSE N'' END
          FROM sys.index_columns ic
          JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
          WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
          ORDER BY ic.key_ordinal
          FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, N'') AS keyCols,
        STUFF((
          SELECT N', ' + c.name
          FROM sys.index_columns ic
          JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
          WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
          ORDER BY ic.index_column_id
          FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, N'') AS includeCols
      FROM sys.indexes i
      JOIN sys.tables t ON t.object_id = i.object_id
      WHERE t.name IN (
        N'PayedContinusPayment', N'ContinusPayment', N'ContinusPaymentDefenition',
        N'Person', N'Center', N'IBN_AccountNumber'
      )
        AND i.type > 0
      ORDER BY t.name, i.name
    `);
    summary.indexes = idx.recordset;
    fs.writeFileSync(
      path.join(outDir, `indexes.${label}.json`),
      JSON.stringify(idx.recordset, null, 2),
      "utf8",
    );
  } catch (e) {
    summary.indexesError = e.message;
  }

  // Row counts (approx)
  try {
    const counts = await pool.request().query(`
      SELECT t.name AS tableName, SUM(p.rows) AS approxRows
      FROM sys.partitions p
      JOIN sys.tables t ON t.object_id = p.object_id
      WHERE p.index_id IN (0, 1)
        AND t.name IN (N'PayedContinusPayment', N'ContinusPayment', N'Person')
      GROUP BY t.name
      ORDER BY t.name
    `);
    summary.approxRows = counts.recordset;
  } catch (e) {
    summary.approxRowsError = e.message;
  }

  // Cached procedure stats + plan handle (if permitted)
  try {
    const stats = await pool.request().query(`
      SELECT TOP 5
        DB_NAME(database_id) AS dbName,
        OBJECT_NAME(object_id, database_id) AS procName,
        execution_count,
        total_elapsed_time / 1000 AS total_elapsed_ms,
        total_worker_time / 1000 AS total_cpu_ms,
        total_logical_reads,
        total_physical_reads,
        last_elapsed_time / 1000 AS last_elapsed_ms,
        cached_time,
        last_execution_time
      FROM sys.dm_exec_procedure_stats
      WHERE database_id = DB_ID()
        AND object_id = OBJECT_ID(N'dbo.CalculateTransaction')
      ORDER BY last_execution_time DESC
    `);
    summary.procStats = stats.recordset;
  } catch (e) {
    summary.procStatsError = e.message;
  }

  // Top statements from cached plans for this proc (if any)
  try {
    const plans = await pool.request().query(`
      SELECT TOP 15
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
      WHERE st.objectid = OBJECT_ID(N'dbo.CalculateTransaction')
        AND st.dbid = DB_ID()
      ORDER BY qs.total_elapsed_time DESC
    `);
    summary.topStatements = plans.recordset.map((r) => ({
      ...r,
      statement_text: String(r.statement_text || "").slice(0, 500),
    }));
    fs.writeFileSync(
      path.join(outDir, `top-statements.${label}.json`),
      JSON.stringify(summary.topStatements, null, 2),
      "utf8",
    );
  } catch (e) {
    summary.topStatementsError = e.message;
  }

  // Missing-index suggestions touching Continus/PayedContinus (server-wide DMV)
  try {
    const miss = await pool.request().query(`
      SELECT TOP 20
        mid.statement AS tableRef,
        migs.avg_total_user_cost * migs.avg_user_impact * (migs.user_seeks + migs.user_scans) AS improvement,
        migs.user_seeks,
        migs.user_scans,
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
          OR mid.statement LIKE N'%Person%'
        )
      ORDER BY improvement DESC
    `);
    summary.missingIndexes = miss.recordset;
    fs.writeFileSync(
      path.join(outDir, `missing-indexes.${label}.json`),
      JSON.stringify(miss.recordset, null, 2),
      "utf8",
    );
  } catch (e) {
    summary.missingIndexesError = e.message;
  }

  fs.writeFileSync(
    path.join(outDir, `summary.${label}.json`),
    JSON.stringify(summary, null, 2),
    "utf8",
  );
  return summary;
}

const results = [];
try {
  console.log("Investigating lab…");
  results.push(await withLab(investigate));
} catch (e) {
  console.error("lab failed:", e.message);
  results.push({ label: "lab", error: e.message });
}

try {
  console.log("Investigating prod…");
  results.push(await withProd(investigate));
} catch (e) {
  console.error("prod failed:", e.message);
  results.push({ label: "prod", error: e.message });
}

for (const r of results) {
  console.log(
    JSON.stringify(
      {
        label: r.label,
        error: r.error,
        procId: r.procId,
        defChars: r.defChars,
        approxRows: r.approxRows,
        procStats: r.procStats,
        deps: (r.dependencies || []).slice(0, 30),
        missingIndexCount: (r.missingIndexes || []).length,
        topStatementCount: (r.topStatements || []).length,
        indexesSample: (r.indexes || []).slice(0, 8),
      },
      null,
      2,
    ),
  );
}
console.log("Wrote files under docs/_sp_investigate/");
