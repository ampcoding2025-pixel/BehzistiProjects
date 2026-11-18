import { pathToFileURL } from "url";
import { join } from "path";
import { readFileSync } from "fs";
import { createHash } from "crypto";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  /* ignore */
}

const USER_IDS = ["set2360141422", "2360141422"];
const PASSWORD = "Set123456789";
const PASSWORD_MD5 = createHash("md5").update(PASSWORD, "utf8").digest("hex").toUpperCase();

const href = pathToFileURL(join(process.cwd(), "src/lib/db/sql-drivers.cjs")).href;
const mod = (await import(href)).default ?? (await import(href));
const sql = mod.loadWindows();
const cs =
  process.env.PAYDISK_TEST_SQL_CONNECTION ||
  "Driver={ODBC Driver 18 for SQL Server};Server=10.0.28.10;Database=DB_Mostamary;Trusted_Connection=Yes;TrustServerCertificate=Yes;";

const pool = await sql.connect({ connectionString: cs });

const center = await pool.request().query(`
  SELECT TOP 1 CenterID FROM dbo.[User] WHERE CenterID IS NOT NULL ORDER BY ID
`);
const centerId = Number(center.recordset[0]?.CenterID || 1);

for (const USER_ID of USER_IDS) {
  const existing = await pool.request().query(`
    SELECT ID, UserID, Role, IsAdministrator, IsEnabled, CenterID
    FROM dbo.[User]
    WHERE UserID = N'${USER_ID}'
  `);

  if (existing.recordset.length) {
    await pool.request().query(`
      UPDATE dbo.[User]
      SET Password = N'${PASSWORD_MD5}',
          Role = N'Admin',
          IsAdministrator = 1,
          IsEnabled = 1,
          IsSystem = 0,
          PasswordErrorCount = 0
      WHERE UserID = N'${USER_ID}'
    `);
    console.log("updated", USER_ID, existing.recordset[0]);
  } else {
    await pool.request().query(`
      INSERT INTO dbo.[User] (
        UserID, Password, Role, IsAdministrator, IsEnabled,
        LastLoginDateTime, CenterID, LastLoginIP, IsSystem,
        ActiveSession, MultiLogin, PasswordErrorCount
      ) VALUES (
        N'${USER_ID}', N'${PASSWORD_MD5}', N'Admin', 1, 1,
        NULL, ${centerId}, NULL, 0,
        NULL, 0, 0
      )
    `);
    console.log("inserted", USER_ID, "centerId=", centerId);
  }
}

const verify = await pool.request().query(`
  SELECT ID, UserID, Role, IsAdministrator, IsEnabled, CenterID
  FROM dbo.[User]
  WHERE UserID IN (N'set2360141422', N'2360141422')
`);
console.log("verify:", JSON.stringify(verify.recordset, null, 2));
await pool.close();
