/**
 * Lab-only: backup + deploy optimized calc SPs (mostamari + yarane Marakez).
 * Does NOT EXEC heavy calcs by default (use --run=name --trId=N).
 *
 * Usage:
 *   node scripts/deploy-all-calc-procs-lab.mjs
 *   node scripts/deploy-all-calc-procs-lab.mjs --only=CalculateEmdad,CalculateHaghParastari
 *   node scripts/deploy-all-calc-procs-lab.mjs --skip-index
 *   node scripts/deploy-all-calc-procs-lab.mjs --run=CalculateEmdad --trId=108xx
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./_load-env-local.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const calcDir = path.join(__dirname, "..", "docs", "_sp_investigate", "all-calcs");
const require = createRequire(path.join(process.cwd(), "package.json"));
const env = loadEnvLocal(import.meta.url);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);
const only = args.only
  ? String(args.only)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;
const skipIndex = args["skip-index"] === "true";
const runProc = args.run || null;
const trId = args.trId ? Number(args.trId) : null;
const supplyId = args.supplyId ? Number(args.supplyId) : 1;

const PROCS = [
  {
    name: "CalculateHadafmandi",
    file: "CalculateHadafmandi_OPTIMIZED_LAB.sql",
    param: "TrId",
  },
  {
    name: "CalculateEmdad",
    file: "CalculateEmdad_OPTIMIZED_LAB.sql",
    param: "TrId",
  },
  {
    name: "CalculateHaghParastari",
    file: "CalculateHaghParastari_OPTIMIZED_LAB.sql",
    param: "TrId",
  },
  {
    name: "CalculateHaghParastariFamily",
    file: "CalculateHaghParastariFamily_OPTIMIZED_LAB.sql",
    param: "TrId",
  },
  {
    name: "CalculateMarakezYarane",
    file: "CalculateMarakezYarane_OPTIMIZED_LAB.sql",
    param: "yarane",
  },
];

const sql = require("mssql/msnodesqlv8");
const cs =
  process.env.PAYDISK_TEST_SQL_CONNECTION ||
  `Driver={ODBC Driver 18 for SQL Server};Server=${env.PAYDISK_TEST_SQL_HOST || "10.0.28.10"};Database=${env.PAYDISK_TEST_SQL_DATABASE || "DB_Mostamary"};Trusted_Connection=Yes;Encrypt=yes;TrustServerCertificate=yes;LoginTimeout=20;`;

function log(...xs) {
  console.log(new Date().toISOString(), ...xs);
}

async function execBatch(pool, text, timeoutMs = 120_000) {
  const req = pool.request();
  req.timeout = timeoutMs;
  return req.batch(text);
}

async function query(pool, text, timeoutMs = 60_000) {
  const req = pool.request();
  req.timeout = timeoutMs;
  return req.query(text);
}

function extractCreateProc(optSql, procName) {
  const re = new RegExp(
    `CREATE OR ALTER PROCEDURE \\[dbo\\]\\.\\[${procName}\\][\\s\\S]*?^END\\s*$`,
    "im",
  );
  const m = optSql.match(re);
  if (!m) throw new Error(`Could not extract CREATE for ${procName}`);
  return m[0].replace(/^CREATE OR ALTER PROCEDURE/i, "CREATE PROCEDURE").trim();
}

async function main() {
  log("Connecting lab…");
  const pool = await new sql.ConnectionPool({
    connectionString: cs,
    connectionTimeout: 30_000,
    requestTimeout: 0,
  }).connect();

  try {
    const db = await query(pool, `SELECT DB_NAME() AS db, @@SERVERNAME AS srv`);
    log("Connected", db.recordset[0]);

    if (!skipIndex) {
      const idx = await query(
        pool,
        `SELECT 1 AS ok FROM sys.indexes
         WHERE object_id = OBJECT_ID(N'dbo.MakeOver')
           AND name = N'IX_MakeOver_CalcSupply_Covering'`,
      );
      if (!idx.recordset.length) {
        log("Creating IX_MakeOver_CalcSupply_Covering…");
        const t0 = Date.now();
        await execBatch(
          pool,
          `
          CREATE NONCLUSTERED INDEX IX_MakeOver_CalcSupply_Covering
            ON dbo.MakeOver (MakeOverSupplyLocationId)
            INCLUDE (
              PersonId, UserRegistrarId, RegistrationDateTime, MakeOverActivityId,
              FromDate, CenterId, Detail, LocalSubsidy, UniverseSubsidy,
              IsNoName, IsSpecial, DefenitionId, Mosharekat
            )
            WITH (MAXDOP = 4);
          `,
          600_000,
        );
        log(`MakeOver index OK in ${Math.round((Date.now() - t0) / 1000)}s`);
      } else {
        log("IX_MakeOver_CalcSupply_Covering already exists");
      }
    }

    const list = only ? PROCS.filter((p) => only.includes(p.name)) : PROCS;
    for (const p of list) {
      const optPath = path.join(calcDir, p.file);
      if (!fs.existsSync(optPath)) throw new Error(`Missing ${optPath}`);

      const defRs = await query(
        pool,
        `SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.${p.name}', N'P')) AS def`,
      );
      const def = defRs.recordset[0]?.def;
      if (!def) throw new Error(`dbo.${p.name} not found`);

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(calcDir, `${p.name}.lab.backup-${stamp}.sql`);
      fs.writeFileSync(backupPath, def, "utf8");
      log("Backup", backupPath);

      const oldName = `${p.name}_OLD`;
      const oldExists = await query(
        pool,
        `SELECT OBJECT_ID(N'dbo.${oldName}', N'P') AS id`,
      );
      if (!oldExists.recordset[0]?.id) {
        // Match CREATE PROC / PROCEDURE + optional [dbo]. + optional [Name]
        // Do NOT use CREATE\s+PROC alone as a second pass — it also matches PROCEDURE.
        let oldBody = String(def).replace(
          new RegExp(
            `CREATE\\s+PROC(?:EDURE)?\\s+(?:\\[dbo\\]|dbo)\\.\\[?(?:${p.name}|HaghParastariFamily)\\]?`,
            "i",
          ),
          `CREATE PROCEDURE [dbo].[${oldName}]`,
        );
        if (!oldBody.includes(`[${oldName}]`)) {
          throw new Error(`Could not rewrite ${p.name} → ${oldName}`);
        }
        await execBatch(pool, oldBody, 60_000);
        log(`Created ${oldName}`);
      } else {
        log(`${oldName} already exists`);
      }

      const optSql = fs.readFileSync(optPath, "utf8");
      const createSql = extractCreateProc(optSql, p.name);
      log(`Dropping dbo.${p.name}…`);
      await execBatch(
        pool,
        `
        IF OBJECT_ID(N'dbo.${p.name}', N'P') IS NOT NULL
          DROP PROCEDURE dbo.${p.name};
        `,
        30_000,
      );
      log(`Creating optimized ${p.name}…`);
      await execBatch(pool, createSql, 60_000);
      log(`Deployed ${p.name}`);
    }

    if (runProc && trId) {
      log(`EXEC ${runProc} …`);
      const t0 = Date.now();
      const req = pool.request();
      req.timeout = 1_800_000;
      if (runProc === "CalculateMarakezYarane") {
        req.input("TransactionId", sql.BigInt, trId);
        req.input("SupplyLocationId", sql.BigInt, supplyId);
      } else {
        req.input("TrId", sql.BigInt, trId);
      }
      await req.execute(runProc);
      log(`EXEC done in ${Math.round((Date.now() - t0) / 1000)}s`);
    } else {
      log("Deploy done (no EXEC — pass --run=Proc --trId=N to test)");
    }
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
