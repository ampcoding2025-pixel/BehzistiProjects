/**
 * Per-database schema capabilities.
 *
 * Lab (DB_Mostamary @ 10.0.28.10):
 *   - MakeOverDefinitions + MakeOverTransactions.DefinitionId
 *   - Key1 often stores numeric supplyLocationId (wizard)
 *
 * Prod/replica AmarDB (@ 10.1.0.155 / 10.1.0.157):
 *   - NO MakeOverDefinitions, NO DefinitionId on transactions
 *   - Key1 is GUID or empty
 *   - Type/supply equivalent = PayedMakeOvers.MakeOverSupplyLocationId
 *     (PayedMakeOvers can be tens of millions of rows — always filter FROM payed,
 *      never OR/IN from MakeOverTransactions side)
 */

import type { DbTargetId } from "./config";
import { peekActiveTarget } from "./config";

export type DbSchemaCaps = {
  target: DbTargetId;
  /** dbo.MakeOverDefinitions exists */
  hasMakeOverDefinitions: boolean;
  /** MakeOverTransactions.DefinitionId column exists */
  hasTxnDefinitionId: boolean;
};

type AnyPool = {
  request: () => {
    query: (q: string) => Promise<{ recordset: Record<string, unknown>[] }>;
  };
};

const cache = new Map<DbTargetId, DbSchemaCaps>();

export function clearSchemaCapsCache(target?: DbTargetId) {
  if (target) cache.delete(target);
  else cache.clear();
}

export async function detectSchemaCaps(
  pool: AnyPool,
  target: DbTargetId = peekActiveTarget(),
): Promise<DbSchemaCaps> {
  const hit = cache.get(target);
  if (hit) return hit;

  const rs = await pool.request().query(`
    SELECT
      CAST(CASE WHEN OBJECT_ID(N'dbo.MakeOverDefinitions', N'U') IS NOT NULL THEN 1 ELSE 0 END AS int) AS hasDefs,
      CAST(CASE WHEN COL_LENGTH(N'dbo.MakeOverTransactions', N'DefinitionId') IS NOT NULL THEN 1 ELSE 0 END AS int) AS hasDefCol
  `);
  const row = rs.recordset[0] || {};
  const caps: DbSchemaCaps = {
    target,
    hasMakeOverDefinitions: Number(row.hasDefs) === 1,
    hasTxnDefinitionId: Number(row.hasDefCol) === 1,
  };
  cache.set(target, caps);
  return caps;
}

export function peekSchemaCaps(target?: DbTargetId): DbSchemaCaps | null {
  return cache.get(target || peekActiveTarget()) || null;
}

/** Known defaults — used when we must not wait on a live probe. */
export function defaultSchemaCaps(target: DbTargetId): DbSchemaCaps {
  if (target === "test") {
    return {
      target,
      hasMakeOverDefinitions: true,
      hasTxnDefinitionId: true,
    };
  }
  return {
    target,
    hasMakeOverDefinitions: false,
    hasTxnDefinitionId: false,
  };
}

/** Cache hit or known default — never opens a connection. */
export function resolveSchemaCaps(target?: DbTargetId): DbSchemaCaps {
  const id = target || peekActiveTarget();
  return cache.get(id) || defaultSchemaCaps(id);
}
