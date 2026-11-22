import { getReadPool, sql } from "@/lib/db/pool";
import {
  normalizeNationalId,
  normalizeShebaId,
  type SayahAccountOwnerType,
  type SayahMatchRequest,
} from "@/lib/sayah/tatbigh";

export type SayahCandidate = SayahMatchRequest & {
  id: string;
  label: string;
  accountNumber?: string;
  source: "mostamari-ibn" | "mostamari-pay" | "yarane-center";
};

function clampLimit(n: number, max = 100) {
  return Math.min(max, Math.max(1, Number(n) || 20));
}

/**
 * Pre-calculate gate: NID ↔ Sheba from IBN_AccountNumber (table already has NID).
 */
export async function loadMostamariIbnCandidates(
  limit = 40,
): Promise<{ candidates: SayahCandidate[]; totalEligible: number }> {
  const pool = await getReadPool();
  const top = clampLimit(limit);
  const req = pool.request();
  req.timeout = 60_000;

  const countRs = await pool.request().query(`
    SELECT COUNT_BIG(*) AS cnt
    FROM dbo.IBN_AccountNumber AS i WITH (NOLOCK)
    WHERE i.IBN IS NOT NULL
      AND LTRIM(RTRIM(i.IBN)) <> N''
      AND i.IBN <> N'null'
      AND i.NID IS NOT NULL
      AND LTRIM(RTRIM(i.NID)) <> N''
  `);
  const totalEligible = Number(countRs.recordset[0]?.cnt || 0);

  const rs = await req.query(`
    SELECT TOP (${top})
      i.row_id AS RowId,
      LTRIM(RTRIM(i.NID)) AS NID,
      LTRIM(RTRIM(i.AccountNumber)) AS AccountNumber,
      LTRIM(RTRIM(i.IBN)) AS ibn
    FROM dbo.IBN_AccountNumber AS i WITH (NOLOCK)
    WHERE i.IBN IS NOT NULL
      AND LTRIM(RTRIM(i.IBN)) <> N''
      AND i.IBN <> N'null'
      AND i.NID IS NOT NULL
      AND LTRIM(RTRIM(i.NID)) <> N''
    ORDER BY i.row_id DESC
  `);

  const candidates: SayahCandidate[] = [];
  for (const row of rs.recordset as Record<string, unknown>[]) {
    const nid = normalizeNationalId(String(row.NID || ""));
    const sheba = normalizeShebaId(String(row.ibn || ""));
    if (!nid || !sheba) continue;
    candidates.push({
      id: `ibn-${row.RowId}`,
      label: String(row.AccountNumber || row.RowId),
      accountNumber: String(row.AccountNumber || ""),
      source: "mostamari-ibn",
      accountOwnerType: "1",
      nationalId: nid,
      legalId: "0",
      shebaId: sheba,
    });
  }
  return { candidates, totalEligible };
}

/**
 * After calculate: pay list Person NID ↔ Sheba for this transaction.
 */
export async function loadMostamariPayCandidates(
  trId: number,
  limit = 40,
): Promise<{ candidates: SayahCandidate[]; totalEligible: number }> {
  const pool = await getReadPool();
  const top = clampLimit(limit);
  const countReq = pool.request();
  countReq.input("id", sql.Int, trId);
  const countRs = await countReq.query(`
    SELECT COUNT_BIG(*) AS cnt
    FROM dbo.PayedContinusPayment AS pay WITH (NOLOCK)
    INNER JOIN dbo.Person AS p WITH (NOLOCK) ON pay.PersonId = p.ID
    INNER JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
      ON LTRIM(RTRIM(pay.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
    WHERE pay.TransactionId = @id
      AND i.IBN IS NOT NULL
      AND LTRIM(RTRIM(i.IBN)) <> N''
      AND i.IBN <> N'null'
      AND p.NID IS NOT NULL
      AND LTRIM(RTRIM(p.NID)) <> N''
  `);
  const totalEligible = Number(countRs.recordset[0]?.cnt || 0);

  const req = pool.request();
  req.timeout = 60_000;
  req.input("id", sql.Int, trId);
  const rs = await req.query(`
    SELECT TOP (${top})
      p.ID AS PersonId,
      LTRIM(RTRIM(p.NID)) AS NID,
      LTRIM(RTRIM(p.FirstName)) AS FirstName,
      LTRIM(RTRIM(p.LastName)) AS LastName,
      LTRIM(RTRIM(pay.AccountNumber)) AS AccountNumber,
      LTRIM(RTRIM(i.IBN)) AS ibn
    FROM dbo.PayedContinusPayment AS pay WITH (NOLOCK)
    INNER JOIN dbo.Person AS p WITH (NOLOCK) ON pay.PersonId = p.ID
    INNER JOIN dbo.IBN_AccountNumber AS i WITH (NOLOCK)
      ON LTRIM(RTRIM(pay.AccountNumber)) = LTRIM(RTRIM(i.AccountNumber))
    WHERE pay.TransactionId = @id
      AND i.IBN IS NOT NULL
      AND LTRIM(RTRIM(i.IBN)) <> N''
      AND i.IBN <> N'null'
      AND p.NID IS NOT NULL
      AND LTRIM(RTRIM(p.NID)) <> N''
    ORDER BY pay.Id DESC
  `);

  const candidates: SayahCandidate[] = [];
  for (const row of rs.recordset as Record<string, unknown>[]) {
    const nid = normalizeNationalId(String(row.NID || ""));
    const sheba = normalizeShebaId(String(row.ibn || ""));
    if (!nid || !sheba) continue;
    candidates.push({
      id: `pay-${row.PersonId}`,
      label: `${row.FirstName || ""} ${row.LastName || ""}`.trim() || String(row.PersonId),
      accountNumber: String(row.AccountNumber || ""),
      source: "mostamari-pay",
      accountOwnerType: "1",
      nationalId: nid,
      legalId: "0",
      shebaId: sheba,
    });
  }
  return { candidates, totalEligible };
}

/**
 * Yarane pre-calculate: Center NationalId ↔ Center.IBN (حقیقی/حقوقی via IsPersonal).
 */
export async function loadYaraneCenterCandidates(
  limit = 40,
): Promise<{ candidates: SayahCandidate[]; totalEligible: number }> {
  const pool = await getReadPool();
  const top = clampLimit(limit);

  const countRs = await pool.request().query(`
    SELECT COUNT_BIG(*) AS cnt
    FROM dbo.Center WITH (NOLOCK)
    WHERE IBN IS NOT NULL
      AND LTRIM(RTRIM(IBN)) <> N''
      AND IBN <> N'null'
      AND NationalId IS NOT NULL
      AND LTRIM(RTRIM(NationalId)) <> N''
  `);
  const totalEligible = Number(countRs.recordset[0]?.cnt || 0);

  const req = pool.request();
  req.timeout = 60_000;
  const rs = await req.query(`
    SELECT TOP (${top})
      CenterId,
      LTRIM(RTRIM(CenterTitle)) AS CenterTitle,
      LTRIM(RTRIM(IBN)) AS ibn,
      LTRIM(RTRIM(NationalId)) AS NationalId,
      ISNULL(IsPersonal, 0) AS IsPersonal
    FROM dbo.Center WITH (NOLOCK)
    WHERE IBN IS NOT NULL
      AND LTRIM(RTRIM(IBN)) <> N''
      AND IBN <> N'null'
      AND NationalId IS NOT NULL
      AND LTRIM(RTRIM(NationalId)) <> N''
    ORDER BY CenterId DESC
  `);

  const candidates: SayahCandidate[] = [];
  for (const row of rs.recordset as Record<string, unknown>[]) {
    const sheba = normalizeShebaId(String(row.ibn || ""));
    if (!sheba) continue;
    const isPersonal = Number(row.IsPersonal) === 1;
    const natRaw = String(row.NationalId || "").replace(/\D/g, "");
    if (!natRaw) continue;

    let accountOwnerType: SayahAccountOwnerType;
    let nationalId: string;
    let legalId: string;

    if (isPersonal) {
      accountOwnerType = "1";
      const nid = normalizeNationalId(natRaw);
      if (!nid) continue;
      nationalId = nid;
      legalId = "0";
    } else {
      // حقوقی ایرانی — شناسه ملی/حقوقی در legalId
      accountOwnerType = "2";
      nationalId = "0";
      legalId = natRaw;
    }

    candidates.push({
      id: `c-${row.CenterId}`,
      label: String(row.CenterTitle || row.CenterId),
      source: "yarane-center",
      accountOwnerType,
      nationalId,
      legalId,
      shebaId: sheba,
    });
  }
  return { candidates, totalEligible };
}
