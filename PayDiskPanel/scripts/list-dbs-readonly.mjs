import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);

const pool = await sql.connect({
  server: "10.1.0.157",
  port: 1433,
  database: "master",
  user: "alipoor",
  password: env.PAYDISK_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
});

const all = await pool.request().query("SELECT name, state_desc FROM sys.databases ORDER BY name");
console.log("All databases:");
console.table(all.recordset);

const match = all.recordset.filter((r) =>
  /mostam|makeover|armagh|behzist|pay/i.test(r.name),
);
console.log("Likely payment-related DBs:");
console.table(match);

for (const db of match.length ? match : all.recordset.slice(0, 5)) {
  try {
    const r = await pool
      .request()
      .query(`SELECT HAS_DBACCESS('${db.name.replace(/'/g, "''")}') AS hasAccess`);
    console.log(`HAS_DBACCESS(${db.name}) =`, r.recordset[0].hasAccess);
  } catch (e) {
    console.log(`HAS_DBACCESS(${db.name}) error:`, e.message);
  }
}

await pool.close();
