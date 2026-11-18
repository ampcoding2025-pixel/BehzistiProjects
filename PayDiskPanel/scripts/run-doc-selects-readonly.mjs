/**
 * Harmless probes from ops doc — SELECT only.
 * Skips: EXEC Calculate*, UPDATE, DELETE, SELECT INTO, DDL.
 */
import sql from "mssql";
import { loadEnvLocal } from "./_load-env-local.mjs";

const env = loadEnvLocal(import.meta.url);

const pool = await sql.connect({
  server: env.PAYDISK_SQL_HOST,
  port: Number(env.PAYDISK_SQL_PORT || 1433),
  database: env.PAYDISK_SQL_DATABASE || "AmarDB",
  user: env.PAYDISK_SQL_USER,
  password: env.PAYDISK_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
  requestTimeout: 120000,
});

async function run(label, text, params = {}) {
  console.log(`\n======== ${label} ========`);
  try {
    const req = pool.request();
    for (const [k, v] of Object.entries(params)) req.input(k, v);
    const r = await req.query(text);
    const rows = r.recordset || [];
    console.log(`rows: ${rows.length}`);
    if (rows.length) console.table(rows.slice(0, 15));
    if (rows.length > 15) console.log(`… ${rows.length - 15} more rows omitted`);
    return rows;
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    return null;
  }
}

// Pick live sample ids from AmarDB
const moSample = (
  await pool.request().query(`
  SELECT TOP 1 Id FROM dbo.MakeOverTransactions
  WHERE Key2 IS NOT NULL AND LTRIM(RTRIM(Key2)) <> ''
  ORDER BY Id DESC
`)
).recordset[0]?.Id;

const moCalcNoList = (
  await pool.request().query(`
  SELECT TOP 1 t.Id
  FROM dbo.MakeOverTransactions t
  WHERE EXISTS (SELECT 1 FROM dbo.PayedMakeOvers p WHERE p.TransactionId = t.Id)
    AND (t.Key2 IS NULL OR LTRIM(RTRIM(t.Key2)) = '')
  ORDER BY t.Id DESC
`)
).recordset[0]?.Id;

const mstAccepted = (
  await pool.request().query(`
  SELECT TOP 1 Id FROM dbo.PayedTransaction
  WHERE Ky IS NOT NULL AND Year IS NOT NULL
  ORDER BY Id DESC
`)
).recordset[0]?.Id;

const mstRecent = (
  await pool.request().query(`
  SELECT TOP 1 Id FROM dbo.PayedTransaction
  WHERE Title LIKE N'%مستمری%'
  ORDER BY Id DESC
`)
).recordset[0]?.Id;

console.log("Sample ids:", { moSample, moCalcNoList, mstAccepted, mstRecent });

// --- Doc: select * from PayedTransaction (limited)
await run("Doc: PayedTransaction sample (TOP 8)", `
  SELECT TOP 8 Id, Title, Ky, Year, AcceptanceDateTime, AcceptorUserId, RegistrationDate, UserRegistrarId,
         CalculationToken, FileName, ExportToken, ListToken, bPublished
  FROM dbo.PayedTransaction
  ORDER BY Id DESC
`);

// --- Doc: select * from MakeOverTransactions
await run("Doc: MakeOverTransactions sample (TOP 8)", `
  SELECT TOP 8 Id, Title, Date, Key1, Key2, Key3, Registrar, RegistrationDateTime
  FROM dbo.MakeOverTransactions
  ORDER BY Id DESC
`);

// --- Doc: select * from MakeOverSupplyLocation
await run("Doc: MakeOverSupplyLocation (all)", `
  SELECT MakeOverSupplyLocationId AS Id, MakeOverSupplyLocationTitle AS Title,
         MakeOverSuplyLocationKeyword AS Keyword, GroupId, Budget
  FROM dbo.MakeOverSupplyLocation
  ORDER BY MakeOverSupplyLocationId
`);

// --- Doc: count PayedMakeOvers where TransactionId = …
if (moSample) {
  await run(`Doc: count PayedMakeOvers @ ${moSample} (has Key2)`, `
    SELECT COUNT(*) AS cnt FROM dbo.PayedMakeOvers WHERE TransactionId = @TrId
  `, { TrId: Number(moSample) });
}
if (moCalcNoList) {
  await run(`Doc: count PayedMakeOvers @ ${moCalcNoList} (calc but no Key2)`, `
    SELECT COUNT(*) AS cnt FROM dbo.PayedMakeOvers WHERE TransactionId = @TrId
  `, { TrId: Number(moCalcNoList) });
}

// --- Doc: یارانه person list SELECT (TOP only)
if (moSample) {
  await run(`Doc: یارانه list query sample @ ${moSample}`, `
    SELECT TOP 10
      PayedMakeOvers.Id, PayedMakeOvers.PersonId, PayedMakeOvers.CenterId,
      PayedMakeOvers.LocalSubsidy, PayedMakeOvers.UniverseSubsidy,
      PayedMakeOvers.IsNoName, PayedMakeOvers.IsSpecial, PayedMakeOvers.Mosharekat,
      PayedMakeOvers.CenterAccount, Person.FirstName, Person.LastName, Person.NID,
      Center.CenterTitle, City.CityTitle, Province.ProvinceTitle, Center.IBN,
      PayedMakeOvers.TransactionId, MakeOverTransactions.Title
    FROM Province
    INNER JOIN City ON Province.ProvinceId = City.ProvinceId
    INNER JOIN PayedMakeOvers
      INNER JOIN Person ON PayedMakeOvers.PersonId = Person.ID
      INNER JOIN Center ON PayedMakeOvers.CenterId = Center.CenterId
      ON City.CityId = Center.CityID
    INNER JOIN MakeOverTransactions ON PayedMakeOvers.TransactionId = MakeOverTransactions.Id
    WHERE PayedMakeOvers.TransactionId = @TrId
  `, { TrId: Number(moSample) });
}

// --- Doc: IBN duplicate check (SELECT CTE)
await run("Doc: duplicate AccountNumber in IBN_AccountNumber (TOP 20)", `
  WITH CTE AS (
    SELECT AccountNumber,
           RN = ROW_NUMBER() OVER (PARTITION BY AccountNumber ORDER BY AccountNumber)
    FROM dbo.IBN_AccountNumber
  )
  SELECT TOP 20 * FROM CTE WHERE RN > 1
`);

await run("Doc: duplicate AccountNumber count", `
  WITH CTE AS (
    SELECT AccountNumber,
           RN = ROW_NUMBER() OVER (PARTITION BY AccountNumber ORDER BY AccountNumber)
    FROM dbo.IBN_AccountNumber
  )
  SELECT COUNT(*) AS duplicateRows FROM CTE WHERE RN > 1
`);

// --- Doc: حق پرستاری / امداد style list from PayedContinusPayment (TOP)
const nurseOrEmdad = mstAccepted || mstRecent;
if (nurseOrEmdad) {
  await run(`Doc: PayedContinusPayment list sample @ ${nurseOrEmdad}`, `
    SELECT TOP 10
      p.Id, p.PersonId, p.AccountNumber, p.Money, Person.NID, Person.FirstName, Person.LastName,
      Center.CenterTitle, City.CityTitle, Province.ProvinceTitle,
      LTRIM(RTRIM(i.IBN)) AS ibn
    FROM dbo.PayedContinusPayment AS p
    INNER JOIN dbo.Person ON p.PersonId = Person.ID
    INNER JOIN dbo.Center ON p.CenterRegistrarId = Center.CenterId
    INNER JOIN dbo.City ON Center.CityID = City.CityId
    INNER JOIN dbo.Province ON City.ProvinceId = Province.ProvinceId
    LEFT OUTER JOIN dbo.IBN_AccountNumber AS i
      ON LTRIM(RTRIM(p.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
    WHERE p.TransactionId = @TrId
    ORDER BY ibn
  `, { TrId: Number(nurseOrEmdad) });
}

// --- Doc: مستمری money distribution
if (mstRecent) {
  await run(`Doc: مستمری money histogram @ ${mstRecent}`, `
    SELECT COUNT(*) AS cnt, Money
    FROM dbo.PayedContinusPayment
    WHERE TransactionId = @TrId
    GROUP BY Money
    ORDER BY Money DESC
  `, { TrId: Number(mstRecent) });
}

// --- Doc: گزارش مستمری style with IsDead (if column exists)
if (mstRecent) {
  await run(`Doc: مستمری count by money where Person.IsDead=0 @ ${mstRecent}`, `
    SELECT COUNT(*) AS cnt, r.Money
    FROM dbo.PayedContinusPayment AS r
    INNER JOIN dbo.Person AS p ON r.PersonId = p.ID
    WHERE r.TransactionId = @TrId AND p.IsDead = 0
    GROUP BY r.Money
    ORDER BY r.Money DESC
  `, { TrId: Number(mstRecent) });
}

// --- Doc: IT.dbo.tbl_PayedContinusPayment_ReceiverNID (may not exist on AmarDB)
await run("Doc: IT.dbo.tbl_PayedContinusPayment_ReceiverNID existence", `
  SELECT name FROM sys.databases WHERE name IN ('IT','IT_DB')
`);
await run("Doc: try IT_DB receiver table (TOP 5) if present", `
  IF OBJECT_ID(N'IT_DB.dbo.tbl_PayedContinusPayment_ReceiverNID') IS NOT NULL
    SELECT TOP 5 * FROM IT_DB.dbo.tbl_PayedContinusPayment_ReceiverNID
  ELSE IF OBJECT_ID(N'dbo.tbl_PayedContinusPayment_ReceiverNID') IS NOT NULL
    SELECT TOP 5 * FROM dbo.tbl_PayedContinusPayment_ReceiverNID
  ELSE
    SELECT N'table not found on this login/db' AS info
`);

// --- Doc: compare two txn person sets (SELECT only) — pick two recent with Ky
const pair = (
  await pool.request().query(`
    SELECT TOP 2 Id FROM dbo.PayedTransaction
    WHERE Ky IN (N'Mst_131500', N'Mst_HDF')
    ORDER BY Id DESC
  `)
).recordset.map((r) => Number(r.Id));

if (pair.length === 2) {
  const [a, b] = pair;
  await run(`Doc: persons in ${a} not in ${b} (diff SELECT TOP 20)`, `
    SELECT TOP 20
      PayedContinusPayment.Id, PayedContinusPayment.PersonId, PayedContinusPayment.FamilyCount,
      PayedContinusPayment.SupplyLocationId, PayedContinusPayment.Money,
      PayedContinusPayment.TransactionId, Person.NID
    FROM dbo.PayedContinusPayment
    INNER JOIN dbo.Person ON PayedContinusPayment.PersonId = Person.ID
    WHERE PayedContinusPayment.TransactionId = @A
      AND PayedContinusPayment.PersonId NOT IN (
        SELECT PersonId FROM dbo.PayedContinusPayment WHERE TransactionId = @B
      )
  `, { A: a, B: b });
}

// --- Doc: GetSheba_Refah function probe (SELECT)
await run("Doc: dbo.GetSheba_Refah sample (if exists)", `
  IF OBJECT_ID(N'dbo.GetSheba_Refah', N'FN') IS NOT NULL
     OR OBJECT_ID(N'dbo.GetSheba_Refah', N'IF') IS NOT NULL
     OR OBJECT_ID(N'dbo.GetSheba_Refah', N'TF') IS NOT NULL
    SELECT TOP 5 AccountNumber, IBN, dbo.GetSheba_Refah(AccountNumber) AS ShebaCalc
    FROM dbo.IBN_AccountNumber
  ELSE
    SELECT N'GetSheba_Refah not found' AS info
`);

// --- Procedure visibility (metadata only)
await run("Metadata: Calculate* / Marakez procedure names visible to login", `
  SELECT SCHEMA_NAME(schema_id) AS sch, name
  FROM sys.procedures
  WHERE name LIKE N'%Calculate%' OR name LIKE N'%Marakez%' OR name LIKE N'%Hagh%'
     OR name LIKE N'%Emdad%' OR name LIKE N'%Hadaf%' OR name LIKE N'%Disk%'
  ORDER BY name
`);

await pool.close();
console.log("\nDone. No writes / no EXEC Calculate*.");
