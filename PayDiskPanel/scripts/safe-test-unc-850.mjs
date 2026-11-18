/**
 * Safe test: build Armaghan 11-col CSV for a txn, write to Diskette UNC,
 * set Key2 only if file write succeeds. Restore Key2 on any failure after update.
 *
 * Usage: node scripts/safe-test-unc-850.mjs [trId]
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import sql from "mssql";

const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split(/\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  process.env[m[1].trim()] = v;
}

function b64(k) {
  const v = process.env[k];
  if (!v) return "";
  try {
    return Buffer.from(v, "base64").toString("utf8");
  } catch {
    return "";
  }
}

const trId = Number(process.argv[2] || 850);
const uncRoot =
  process.env.PAYDISK_YARANE_DISKETTE_UNC?.trim() ||
  "\\\\sqlcluster\\MSSQLSERVER\\Docs\\Documents\\Diskette";
const fileName = `${crypto.randomUUID().toLowerCase()}-Marakez-CSV-Zihesab-${trId}.csv`;
const uncPath = path.win32.join(uncRoot, fileName);

const COLS = [
  "FirstName",
  "LastName",
  "NID",
  "Province",
  "City",
  "Center",
  "Account",
  "Money (RLS)",
  "IsPersonal",
  "NationalId",
  "Category",
];

function q(v) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

const baseCfg = {
  server: process.env.PAYDISK_SQL_HOST || "10.1.0.155",
  database: process.env.PAYDISK_SQL_PROD_DATABASE || "DB_Mostamary",
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 180_000,
};

const readPool = await sql.connect({
  ...baseCfg,
  user: process.env.PAYDISK_SQL_USER,
  password: b64("PAYDISK_SQL_PASSWORD_B64") || process.env.PAYDISK_SQL_PASSWORD,
});

const before = await readPool.request().input("id", sql.BigInt, trId).query(`
  SELECT Id, Title, Key2,
    (SELECT COUNT(*) FROM dbo.PayedMakeOvers WITH (NOLOCK) WHERE TransactionId = @id) AS payedRows
  FROM dbo.MakeOverTransactions WITH (NOLOCK)
  WHERE Id = @id
`);
const row = before.recordset[0];
if (!row) {
  console.error("Txn not found:", trId);
  await readPool.close();
  process.exit(1);
}

const prevKey2 = row.Key2 != null ? String(row.Key2).trim() : "";
const payedRows = Number(row.payedRows || 0);
console.log("Txn:", row.Id, row.Title);
console.log("payedRows:", payedRows);
console.log("Key2 before:", prevKey2 || "(empty)");
console.log("Target file:", uncPath);

if (payedRows <= 0) {
  console.error("No PayedMakeOvers — abort (safe).");
  await readPool.close();
  process.exit(1);
}

const BATCH = 3000;
let offset = 0;
let bytes = 0;
let dataRows = 0;
const started = Date.now();

let stream;
try {
  stream = fs.createWriteStream(uncPath, { encoding: "utf8", flags: "w" });
} catch (e) {
  console.error("OPEN/WRITE UNC FAILED (Key2 unchanged):", e.message);
  await readPool.close();
  process.exit(2);
}

const write = (chunk) =>
  new Promise((resolve, reject) => {
    bytes += Buffer.byteLength(chunk, "utf8");
    if (stream.write(chunk)) resolve();
    else stream.once("drain", resolve);
    stream.once("error", reject);
  });

try {
  await write(COLS.map((c) => q(c)).join(",") + "\r\n");

  for (;;) {
    const req = readPool.request();
    req.timeout = 180_000;
    req.input("id", sql.Int, trId);
    req.input("offset", sql.Int, offset);
    req.input("pageSize", sql.Int, BATCH);
    const rs = await req.query(`
      ;WITH page_ids AS (
        SELECT p.Id
        FROM dbo.PayedMakeOvers p WITH (NOLOCK)
        INNER JOIN dbo.Center cntr WITH (NOLOCK) ON p.CenterId = cntr.CenterId
        WHERE p.TransactionId = @id
        ORDER BY p.Id DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      )
      SELECT
        per.FirstName AS FirstName,
        per.LastName AS LastName,
        per.NID AS NID,
        pr.ProvinceTitle AS Province,
        cit.CityTitle AS City,
        cntr.CenterTitle AS Center,
        p.CenterAccount AS Account,
        LTRIM(STR(p.UniverseSubsidy)) AS [Money (RLS)],
        LTRIM(STR(cntr.IsPersonal)) AS IsPersonal,
        cntr.NationalId AS NationalId,
        ssc.CenterSubCatagoryTitle AS Category
      FROM page_ids pid
      INNER JOIN dbo.PayedMakeOvers AS p WITH (NOLOCK) ON p.Id = pid.Id
      INNER JOIN dbo.Person AS per WITH (NOLOCK) ON per.ID = p.PersonId
      INNER JOIN dbo.Center AS cntr WITH (NOLOCK) ON cntr.CenterId = p.CenterId
      INNER JOIN dbo.City AS cit WITH (NOLOCK) ON cit.CityId = cntr.CityID
      INNER JOIN dbo.Province AS pr WITH (NOLOCK) ON pr.ProvinceId = cit.ProvinceId
      INNER JOIN dbo.CenterSubCatagory AS ssc WITH (NOLOCK)
        ON ssc.CenterSubCatagoryId = cntr.CenterSubCatagoryId
      ORDER BY p.Id DESC
    `);
    const rows = rs.recordset || [];
    if (!rows.length) break;
    let chunk = "";
    for (const r of rows) {
      chunk += COLS.map((c) => q(r[c])).join(",") + "\r\n";
      dataRows++;
    }
    await write(chunk);
    if (rows.length < BATCH) break;
    offset += BATCH;
    if (offset % 15000 === 0) {
      console.log("… wrote", dataRows, "rows");
    }
  }

  await new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
} catch (e) {
  try {
    stream.destroy();
  } catch {
    /* ignore */
  }
  try {
    if (fs.existsSync(uncPath)) fs.unlinkSync(uncPath);
  } catch {
    /* ignore */
  }
  console.error("CSV BUILD/WRITE FAILED (Key2 unchanged):", e.message);
  await readPool.close();
  process.exit(2);
}

console.log(
  `File write OK in ${Date.now() - started}ms · rows=${dataRows} · bytes=${bytes}`,
);

// Verify file exists + non-empty before touching Key2
try {
  const st = fs.statSync(uncPath);
  console.log("stat OK:", { size: st.size, mtime: st.mtime.toISOString() });
  if (st.size <= 0) throw new Error("file size 0");
} catch (e) {
  console.error("VERIFY FAILED (Key2 unchanged):", e.message);
  await readPool.close();
  process.exit(3);
}

await readPool.close();

// Only now update Key2 (write login)
const writePool = await sql.connect({
  ...baseCfg,
  user: process.env.PAYDISK_SQL_WRITE_USER || "behqlik",
  password:
    b64("PAYDISK_SQL_WRITE_PASSWORD_B64") ||
    process.env.PAYDISK_SQL_WRITE_PASSWORD,
});

try {
  await writePool
    .request()
    .input("id", sql.BigInt, trId)
    .input("key2", sql.NVarChar, fileName)
    .query(`UPDATE dbo.MakeOverTransactions SET Key2 = @key2 WHERE Id = @id`);
  const after = await writePool.request().input("id", sql.BigInt, trId).query(`
    SELECT Key2 FROM dbo.MakeOverTransactions WITH (NOLOCK) WHERE Id = @id
  `);
  const now = after.recordset[0]?.Key2;
  console.log("Key2 after:", now);
  if (String(now) !== fileName) {
    throw new Error("Key2 update did not stick");
  }
  console.log("SAFE TEST SUCCESS");
  console.log(
    JSON.stringify(
      { trId, fileName, uncPath, dataRows, bytes, prevKey2, key2: now },
      null,
      2,
    ),
  );
} catch (e) {
  console.error("Key2 UPDATE FAILED — restoring previous Key2:", e.message);
  try {
    await writePool
      .request()
      .input("id", sql.BigInt, trId)
      .input("key2", sql.NVarChar, prevKey2 || null)
      .query(`UPDATE dbo.MakeOverTransactions SET Key2 = @key2 WHERE Id = @id`);
    console.log("Restored Key2 to:", prevKey2 || "(null)");
  } catch (re) {
    console.error("RESTORE FAILED:", re.message);
  }
  process.exit(4);
} finally {
  await writePool.close();
}
