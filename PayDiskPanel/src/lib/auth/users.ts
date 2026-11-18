import type { UserRole } from "@/lib/types";

export interface AllowlistUser {
  username: string;
  /** Local-only password (empty = must authenticate against 155/157 dbo.[User]). */
  password: string;
  displayName: string;
  role: UserRole;
  /** If true, may log in with local password without existing in HQ DB. */
  localBypass?: boolean;
}

/**
 * Usernames allowed to use the panel.
 * DB-backed accounts must exist on 155/157 and pass password check there.
 * Override whole list via PAYDISK_USERS_JSON if needed.
 */
export const DEFAULT_USERS: AllowlistUser[] = [
  {
    username: "set2360141422",
    password: "Set123456789",
    displayName: "ادمین ستاد",
    role: "admin",
    localBypass: true,
  },
  // Same local admin — people often omit the "set" prefix
  {
    username: "2360141422",
    password: "Set123456789",
    displayName: "ادمین ستاد",
    role: "admin",
    localBypass: true,
  },
  {
    username: "sazangishe",
    password: "",
    displayName: "سازن‌گیشه",
    role: "admin",
  },
  {
    username: "mirfatahi0061380814",
    password: "",
    displayName: "میرفتاحی",
    role: "admin",
  },
  {
    username: "amnpardaz",
    password: "",
    displayName: "امن‌پرداز",
    role: "admin",
  },
];

export function loadUsers(): AllowlistUser[] {
  const raw = process.env.PAYDISK_USERS_JSON;
  if (!raw) return DEFAULT_USERS;
  try {
    const parsed = JSON.parse(raw) as AllowlistUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_USERS;
    return parsed;
  } catch {
    return DEFAULT_USERS;
  }
}

/** Normalize Persian/Arabic digits and trim — browsers often insert ۰–۹. */
export function normalizeLoginId(raw: string) {
  return raw
    .trim()
    .replace(/[\u200c\u200e\u200f\u202a-\u202e]/g, "") // ZWNJ / RTL marks
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function findAllowlistEntry(username: string): AllowlistUser | undefined {
  const uid = normalizeLoginId(username).toLowerCase();
  return loadUsers().find((u) => u.username.toLowerCase() === uid);
}

/** True if username is on the panel allowlist (or local bypass). */
export function isLoginAllowed(username: string): boolean {
  return !!findAllowlistEntry(username);
}

/**
 * Local password match (bypass accounts only).
 * DB-backed allowlist entries have empty password and must auth via dbo.[User].
 */
export function findUser(username: string, password: string) {
  const entry = findAllowlistEntry(username);
  if (!entry) return undefined;
  const pwd = password.trim();
  if (entry.localBypass && entry.password && entry.password === pwd) {
    return entry;
  }
  // Also allow local password if explicitly set on an allowlist row
  if (!entry.localBypass && entry.password && entry.password === pwd) {
    return entry;
  }
  return undefined;
}

export function canCreateRequest(role: UserRole) {
  return role === "operator" || role === "admin";
}

export function canRunWorker(role: UserRole) {
  return role === "operator" || role === "admin";
}

export function canManageAdmins(role: UserRole) {
  return role === "admin";
}
