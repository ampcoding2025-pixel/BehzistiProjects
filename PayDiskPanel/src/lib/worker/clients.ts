import { getActiveDbInfo, isLabDb } from "@/lib/db/config";
import { labExecProc, labWritesEnabled } from "@/lib/lab/writes";
import {
  assertArmaghanOp,
  assertSqlProc,
  isLiveMode,
  type AllowedArmaghanOp,
  type AllowedSqlProc,
} from "./whitelist";

export interface WorkerStepResult {
  ok: boolean;
  message: string;
  detail?: string;
}

/**
 * SQL client: on lab target runs whitelisted Calculate* for real.
 * On prod/replica → dry-run only (never EXEC/UPDATE from this panel).
 */
export async function execWhitelistedProc(
  proc: AllowedSqlProc,
  params: Record<string, string | number | number[]>,
): Promise<WorkerStepResult> {
  assertSqlProc(proc);
  const db = getActiveDbInfo();
  const dbLabel = `${db.host}/${db.database}`;

  if (labWritesEnabled()) {
    const trId = Number(params.TrId ?? params.TransactionId ?? params.trId);
    const supplyRaw = params.SupplyLocationId ?? params.supplyLocationId;
    const supplyLocationId =
      supplyRaw == null || Array.isArray(supplyRaw) ? undefined : Number(supplyRaw);
    try {
      const res = await labExecProc(proc, { trId, supplyLocationId });
      return {
        ok: true,
        message: res.message,
        detail: JSON.stringify(res),
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        detail: JSON.stringify({ proc, params, db: dbLabel }),
      };
    }
  }

  if (!isLiveMode()) {
    return {
      ok: true,
      message: `[dry-run] EXEC ${proc} @ ${dbLabel}`,
      detail: JSON.stringify(params),
    };
  }

  return {
    ok: false,
    message: `LIVE روی تولید/رپلیکا از این پنل مسدود است — فقط lab EXEC می‌کند`,
    detail: `isLabDb=${isLabDb()} target=${dbLabel}`,
  };
}

/**
 * Armaghan HTTP client.
 * GetListMakeover is wired for real (diskette host); other ops stay dry-run
 * unless LIVE + token (still stub until needed).
 */
export async function callArmaghan(
  op: AllowedArmaghanOp,
  params: Record<string, string | number | unknown>,
): Promise<WorkerStepResult> {
  assertArmaghanOp(op);

  if (op === "Diskette/GetListMakeover") {
    const trId = Number(params.id ?? params.trId ?? params.TransactionId);
    try {
      const { armaghanGetListMakeover } = await import(
        "@/lib/armaghan/get-list-makeover"
      );
      const list = await armaghanGetListMakeover(trId);
      return {
        ok: list.ok,
        message: list.message,
        detail: JSON.stringify(list),
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        detail: JSON.stringify(params),
      };
    }
  }

  if (!isLiveMode()) {
    return {
      ok: true,
      message: `[dry-run] ${op}`,
      detail: JSON.stringify(params),
    };
  }
  if (!process.env.PAYDISK_ARMAGHAN_TOKEN && !process.env.PAYDISK_ARMAGHAN_COOKIE) {
    return {
      ok: false,
      message: "LIVE mode on but PAYDISK_ARMAGHAN_TOKEN/COOKIE is missing",
    };
  }
  return {
    ok: false,
    message: `LIVE Armaghan client not wired yet for ${op}`,
    detail: "GetListMakeover is available; other ops still stub",
  };
}
