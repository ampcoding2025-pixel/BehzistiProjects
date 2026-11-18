import { promises as fs } from "fs";
import path from "path";
import type { DiskFamily, UserRole } from "@/lib/types";
import { loadUsers } from "@/lib/auth/users";
import {
  MOSTAMARI_ACCESS_TYPES,
  type AccessTypeRef,
} from "@/lib/auth/disk-types";
import {
  YARANE_DOC_TYPES,
  YARANE_EXTRA_TYPES,
} from "@/lib/wizard/yarane-types";

export type { AccessTypeRef };

export type UserSupplyAccess = {
  username: string;
  dbUserId?: number | null;
  displayName?: string;
  /** @deprecated v1 — migrated into typeRefs */
  supplyLocationIds?: number[];
  typeRefs: AccessTypeRef[];
  canCreate: boolean;
  canApprove: boolean;
};

type AccessFile = {
  version: 2;
  /** When false, users without a row keep full type access (compat). */
  enforced: boolean;
  users: UserSupplyAccess[];
};

const FILE = path.join(process.cwd(), "data", "user-supply-access.json");

function allYaraneRefs(): AccessTypeRef[] {
  return [
    ...YARANE_DOC_TYPES.map((t) => ({
      family: "yarane" as const,
      typeId: String(t.supplyLocationId),
      label: `#${t.supplyLocationId} · ${t.shortFa}`,
    })),
    ...YARANE_EXTRA_TYPES.map((t) => ({
      family: "yarane" as const,
      typeId: String(t.supplyLocationId),
      label: `#${t.supplyLocationId} · ${t.shortFa}`,
    })),
  ];
}

function migrateUser(raw: Record<string, unknown>): UserSupplyAccess {
  const username = String(raw.username || "").trim();
  const canCreate = raw.canCreate !== false;
  const canApprove = raw.canApprove !== false;
  const dbUserId =
    raw.dbUserId != null && Number.isFinite(Number(raw.dbUserId))
      ? Number(raw.dbUserId)
      : null;
  const displayName = raw.displayName ? String(raw.displayName) : undefined;

  let typeRefs: AccessTypeRef[] = [];
  if (Array.isArray(raw.typeRefs)) {
    typeRefs = (raw.typeRefs as AccessTypeRef[])
      .map((t): AccessTypeRef => ({
        family: (t.family === "mostamari" ? "mostamari" : "yarane") as DiskFamily,
        typeId: String(t.typeId),
        label: String(t.label || t.typeId),
      }))
      .filter((t) => t.typeId);
  } else if (Array.isArray(raw.supplyLocationIds)) {
    const byId = new Map(allYaraneRefs().map((t) => [t.typeId, t]));
    typeRefs = (raw.supplyLocationIds as unknown[])
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .map(
        (n): AccessTypeRef =>
          byId.get(String(n)) || {
            family: "yarane",
            typeId: String(n),
            label: `#${n}`,
          },
      );
  }

  return {
    username,
    dbUserId,
    displayName,
    typeRefs,
    canCreate,
    canApprove,
  };
}

function defaultFile(): AccessFile {
  const yarane = allYaraneRefs();
  return {
    version: 2,
    enforced: false,
    users: loadUsers()
      .filter((u) => u.role !== "admin")
      .map((u) => ({
        username: u.username,
        displayName: u.displayName,
        typeRefs: [...yarane],
        canCreate: u.role === "operator",
        canApprove: u.role === "operator",
      })),
  };
}

async function ensureDir() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
}

export async function readAccessFile(): Promise<AccessFile> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as { version?: number; enforced?: boolean; users?: unknown[] };
    if (!parsed || !Array.isArray(parsed.users)) return defaultFile();
    return {
      version: 2,
      enforced: !!parsed.enforced,
      users: parsed.users.map((u) => migrateUser(u as Record<string, unknown>)),
    };
  } catch {
    return defaultFile();
  }
}

export async function writeAccessFile(file: {
  enforced: boolean;
  users: UserSupplyAccess[];
}) {
  await ensureDir();
  const clean: AccessFile = {
    version: 2,
    enforced: !!file.enforced,
    users: file.users.map((u) => ({
      username: u.username.trim(),
      dbUserId: u.dbUserId ?? null,
      displayName: u.displayName,
      typeRefs: dedupeRefs(u.typeRefs || []),
      canCreate: !!u.canCreate,
      canApprove: !!u.canApprove,
    })),
  };
  await fs.writeFile(FILE, JSON.stringify(clean, null, 2), "utf8");
  return clean;
}

function dedupeRefs(refs: AccessTypeRef[]): AccessTypeRef[] {
  const map = new Map<string, AccessTypeRef>();
  for (const r of refs) {
    const key = `${r.family}:${r.typeId}`;
    map.set(key, {
      family: r.family === "mostamari" ? "mostamari" : "yarane",
      typeId: String(r.typeId),
      label: String(r.label || r.typeId),
    });
  }
  return [...map.values()];
}

export type EffectiveAccess = {
  username: string;
  role: UserRole;
  /** null = unrestricted (admin / not yet enforced) */
  allowedSupplyIds: number[] | null;
  allowedMostamariIds: string[] | null;
  canCreate: boolean;
  canApprove: boolean;
};

export async function getEffectiveAccess(
  username: string,
  role: UserRole,
): Promise<EffectiveAccess> {
  if (role === "admin") {
    return {
      username,
      role,
      allowedSupplyIds: null,
      allowedMostamariIds: null,
      canCreate: true,
      canApprove: true,
    };
  }

  const file = await readAccessFile();
  const row = file.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );

  if (!file.enforced && !row) {
    return {
      username,
      role,
      allowedSupplyIds: null,
      allowedMostamariIds: null,
      canCreate: role === "operator",
      canApprove: role === "operator",
    };
  }

  if (!row) {
    return {
      username,
      role,
      allowedSupplyIds: [],
      allowedMostamariIds: [],
      canCreate: false,
      canApprove: false,
    };
  }

  const yarane = row.typeRefs
    .filter((t) => t.family === "yarane")
    .map((t) => Number(t.typeId))
    .filter((n) => Number.isFinite(n) && n > 0);
  const mostamari = row.typeRefs
    .filter((t) => t.family === "mostamari")
    .map((t) => t.typeId);

  return {
    username,
    role,
    allowedSupplyIds: yarane,
    allowedMostamariIds: mostamari,
    canCreate: role === "finance_viewer" ? false : !!row.canCreate,
    canApprove: role === "finance_viewer" ? false : !!row.canApprove,
  };
}

/** Sidebar: تنظیمات — admin only */
export function canSeeSettings(role: UserRole) {
  return role === "admin";
}

/**
 * Sidebar: تراکنش‌ها — admin always; others only with at least one granted type.
 * Unrestricted null (pre-ACL) does not count as granted for non-admins.
 */
export function canSeeTransactions(access: EffectiveAccess) {
  if (access.role === "admin") return true;
  const yarane = access.allowedSupplyIds;
  const mostamari = access.allowedMostamariIds;
  if (yarane === null || mostamari === null) return false;
  return yarane.length > 0 || mostamari.length > 0;
}

export function canUseSupply(
  access: EffectiveAccess,
  supplyLocationId: number,
): boolean {
  if (access.allowedSupplyIds === null) return true;
  return access.allowedSupplyIds.includes(Number(supplyLocationId));
}

export function canUseMostamari(
  access: EffectiveAccess,
  typeId: string,
): boolean {
  if (access.allowedMostamariIds === null) return true;
  return access.allowedMostamariIds.includes(typeId);
}

export function filterTypesByAccess<T extends { supplyLocationId: number }>(
  types: T[],
  access: EffectiveAccess,
): T[] {
  if (access.allowedSupplyIds === null) return types;
  const set = new Set(access.allowedSupplyIds);
  return types.filter((t) => set.has(t.supplyLocationId));
}

export function catalogTypeOptions(family: DiskFamily, q = ""): AccessTypeRef[] {
  const needle = q.trim().toLowerCase();
  const list =
    family === "mostamari"
      ? MOSTAMARI_ACCESS_TYPES
      : allYaraneRefs();
  if (!needle) return list;
  return list.filter(
    (t) =>
      t.label.toLowerCase().includes(needle) ||
      t.typeId.toLowerCase().includes(needle),
  );
}
