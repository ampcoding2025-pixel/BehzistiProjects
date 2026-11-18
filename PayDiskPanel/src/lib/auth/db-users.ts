import { createHash } from "crypto";
import {
  getPoolForTarget,
  getReadPool,
  getWritePool,
  isLabDb,
  sql,
  type DbTargetId,
} from "@/lib/db/pool";
import { findAllowlistEntry } from "@/lib/auth/users";
import type { UserRole } from "@/lib/types";

export type DbUserHit = {
  id: number;
  username: string;
  /** First+Last from Personnel when mapped */
  displayName: string;
  role: string;
  isAdmin: boolean;
  centerId: number;
};

function md5Upper(text: string) {
  return createHash("md5").update(text, "utf8").digest("hex").toUpperCase();
}

const PERSONNEL_NAME_EXPR = `
  NULLIF(LTRIM(RTRIM(ISNULL(p.FirstName, N'') + N' ' + ISNULL(p.LastName, N''))), N'')
`;

const USER_PERSONNEL_JOINS = `
  LEFT JOIN dbo.MappedPersonnel mp ON mp.UserId = u.ID
  LEFT JOIN dbo.Personnel p ON p.Id = mp.PersonnelId
`;

function mapHit(r: Record<string, unknown>): DbUserHit {
  const username = String(r.username || "");
  const name = r.displayName ? String(r.displayName).trim() : "";
  return {
    id: Number(r.id),
    username,
    displayName: name || username,
    role: String(r.role || ""),
    isAdmin: Number(r.isAdmin) === 1,
    centerId: Number(r.centerId || 0),
  };
}

/** Search dbo.[User] (Armaghan / AmarDB) by UserID or personnel name. */
export async function searchDbUsers(q: string, limit = 25): Promise<DbUserHit[]> {
  const needle = q.trim();
  if (needle.length < 1) return [];

  const pool = await getReadPool();
  const req = pool.request();
  req.input("q", sql.NVarChar, `%${needle}%`);
  req.input("limit", sql.Int, Math.min(50, Math.max(1, limit)));

  const rs = await req.query(`
    SELECT TOP (@limit)
      u.ID AS id,
      u.UserID AS username,
      (${PERSONNEL_NAME_EXPR}) AS displayName,
      u.Role AS role,
      CAST(u.IsAdministrator AS int) AS isAdmin,
      u.CenterID AS centerId
    FROM dbo.[User] u
    ${USER_PERSONNEL_JOINS}
    WHERE u.IsEnabled = 1
      AND u.IsSystem = 0
      AND (
        u.UserID LIKE @q
        OR ISNULL(u.Role, N'') LIKE @q
        OR ISNULL(p.FirstName, N'') LIKE @q
        OR ISNULL(p.LastName, N'') LIKE @q
        OR (${PERSONNEL_NAME_EXPR}) LIKE @q
      )
    ORDER BY
      CASE WHEN (${PERSONNEL_NAME_EXPR}) IS NOT NULL THEN 0 ELSE 1 END,
      u.UserID
  `);

  return (rs.recordset || []).map((r) => mapHit(r as Record<string, unknown>));
}

/** Resolve First+Last names for a set of UserIDs. */
export async function resolveDbUserDisplayNames(
  usernames: string[],
): Promise<Record<string, string>> {
  const hits = await lookupDbUsersByUsernames(usernames);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(hits)) {
    if (v.displayName) out[k] = v.displayName;
  }
  return out;
}

export type DbUserLookup = {
  username: string;
  displayName: string;
  dbUserId: number | null;
  isEnabled: boolean;
  found: boolean;
  source: DbTargetId | null;
};

/** Look up UserIDs on prod (155) then replica (157). */
export async function lookupDbUsersByUsernames(
  usernames: string[],
): Promise<Record<string, DbUserLookup>> {
  const ids = [
    ...new Set(
      usernames
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => u.toLowerCase()),
    ),
  ];
  const out: Record<string, DbUserLookup> = {};
  for (const id of ids) {
    out[id] = {
      username: id,
      displayName: "",
      dbUserId: null,
      isEnabled: false,
      found: false,
      source: null,
    };
  }
  if (!ids.length) return out;

  const targets: DbTargetId[] = ["prod", "replica"];
  for (const target of targets) {
    const missing = ids.filter((id) => !out[id]?.found);
    if (!missing.length) break;
    try {
      const pool = await getPoolForTarget(target);
      const req = pool.request();
      const params = missing.map((_, i) => `@u${i}`);
      missing.forEach((id, i) => req.input(`u${i}`, sql.NVarChar, id));
      const rs = await req.query(`
        SELECT
          u.ID AS id,
          u.UserID AS username,
          CAST(u.IsEnabled AS int) AS isEnabled,
          (${PERSONNEL_NAME_EXPR}) AS displayName
        FROM dbo.[User] u
        ${USER_PERSONNEL_JOINS}
        WHERE LOWER(LTRIM(RTRIM(u.UserID))) IN (${params.join(",")})
          AND u.IsSystem = 0
      `);
      for (const r of rs.recordset || []) {
        const username = String(r.username || "").trim();
        const key = username.toLowerCase();
        if (!key || out[key]?.found) continue;
        const name = r.displayName ? String(r.displayName).trim() : "";
        out[key] = {
          username,
          displayName: name || username,
          dbUserId: Number(r.id) || null,
          isEnabled: Number(r.isEnabled) === 1,
          found: true,
          source: target,
        };
      }
    } catch {
      /* try next host */
    }
  }
  return out;
}

type DbAuthOk = {
  username: string;
  displayName: string;
  role: UserRole;
  dbUserId: number;
};

async function authenticateOnTarget(
  target: DbTargetId,
  uid: string,
  pwd: string,
): Promise<DbAuthOk | null> {
  const pool = await getPoolForTarget(target);
  const req = pool.request();
  req.input("uid", sql.NVarChar, uid);
  const rs = await req.query(`
    SELECT TOP 1
      u.ID AS id,
      u.UserID AS username,
      u.Password AS password,
      u.Role AS role,
      CAST(u.IsAdministrator AS int) AS isAdmin,
      CAST(u.IsEnabled AS int) AS isEnabled,
      (${PERSONNEL_NAME_EXPR}) AS displayName
    FROM dbo.[User] u
    ${USER_PERSONNEL_JOINS}
    WHERE LOWER(LTRIM(RTRIM(u.UserID))) = LOWER(@uid) AND u.IsSystem = 0
  `);
  const row = rs.recordset[0];
  if (!row || Number(row.isEnabled) !== 1) return null;

  const stored = String(row.password || "").trim();
  const ok =
    stored === pwd ||
    stored.toUpperCase() === md5Upper(pwd) ||
    stored.toLowerCase() === md5Upper(pwd).toLowerCase();
  if (!ok) return null;

  const uname = String(row.username);
  const personName = row.displayName ? String(row.displayName).trim() : "";

  // Prefer allowlist role; never elevate unknown allowlist gaps to admin.
  const entry = findAllowlistEntry(uname);
  return {
    username: uname,
    displayName: entry?.displayName || personName || uname,
    role: entry?.role || "operator",
    dbUserId: Number(row.id),
  };
}

/**
 * Authenticate against dbo.[User] on HQ hosts (155 then 157).
 * Plain or MD5-hex password column.
 */
export async function authenticateDbUser(
  username: string,
  password: string,
): Promise<DbAuthOk | null> {
  const uid = username.trim();
  const pwd = password.trim();
  if (!uid || !pwd) return null;

  const targets: DbTargetId[] = ["prod", "replica"];
  for (const target of targets) {
    try {
      const hit = await authenticateOnTarget(target, uid, pwd);
      if (hit) return hit;
    } catch {
      /* try next host */
    }
  }
  return null;
}

/** Promote / demote administrator flag on lab DB (writes only when test mode). */
export async function setDbUserAdmin(userId: string, isAdmin: boolean) {
  if (!isLabDb()) {
    throw new Error("تغییر ادمین فقط روی دیتابیس آزمایشی مجاز است");
  }
  const pool = await getWritePool();
  const req = pool.request();
  req.input("uid", sql.NVarChar, userId.trim());
  req.input("admin", sql.Bit, isAdmin ? 1 : 0);
  req.input("role", sql.NVarChar, isAdmin ? "Admin" : "User");
  const result = await req.query(`
    UPDATE dbo.[User]
    SET IsAdministrator = @admin,
        Role = @role,
        IsEnabled = 1
    WHERE UserID = @uid
  `);
  const affected = Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((a, b) => a + b, 0)
    : Number(result.rowsAffected || 0);
  if (!affected) throw new Error("کاربر در دیتابیس یافت نشد");
  return { ok: true as const, username: userId.trim(), isAdmin };
}
