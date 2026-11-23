# Yarane + Mostamari calc investigation (lab)

**Server:** HQ-LAB-UI-DB / `DB_Mostamary`  
**Date:** 2026-11-23  
**Goal:** Same totals as old SPs, faster runtime.

## Inventory (panel + lab)

| Proc | Family | Panel type | Filter | Lab rows (source) | Prior DMV |
|------|--------|------------|--------|-------------------|-----------|
| `CalculateTransaction` | mostamari | mst-base | supply IN (1–4,9–36,38) | 1 580 875 | ~61s optimized (was ~9+ min old) |
| `CalculateHadafmandi` | mostamari | mst-hadafmandi | pay: 1–7,9–36,38; IT: no 5,6,7 | 1 580 875 (5/6/7 empty today) | no cache |
| `CalculateEmdad` | mostamari | mst-emdad | supply = 8 | 17 495 | — |
| `CalculateHaghParastari` | mostamari | mst-hagh-spinal | supply = 37 | 34 038 | — |
| `CalculateHaghParastariFamily` | mostamari | mst-hagh-family | supply = 40 | 127 240 | — |
| `CalculateMarakezYarane` | yarane | yrn-* | MakeOver supply + IsDead=0 | e.g. supply 2 → 55 555 | ~25s / 1.6M reads |

**Also on lab (not in panel whitelist):** `CalculateMade27` (×3 money, supply 39), `CalculateMarakezEtiad`, `CalculateMarakezYarane_2` (CommisionPage disability filter), `CalculateHadafmaniKoodakan`, `CalculateNegativeTransaction`, async variants.

## Correctness (dry-run)

Script: `scripts/dry-run-all-calcs-correctness.mjs` → `dry-run-correctness.json`

- Hadafmandi **merged single INSERT** ≡ old **two INSERTs** (cnt + Money sum).
- Base / Emdad / Spinal / Family source totals fixed from `ContinusPayment`.
- Old IT join on **PersonId only** can duplicate; optimized joins **PersonId + SupplyLocationId** (and Hadafmandi IT still excludes 5,6,7).

## Speedups applied (lab)

Shared mostamari pattern (same as `CalculateTransaction`):

1. **Remove** whole-table `UPDATE ContinusPayment SET baccountvalidated=1 WHERE … IS NULL` (unrelated to `@TrId`, scans ~1.7M).
2. **Covering index** `IX_ContinusPayment_CalcSupply_Covering` (already on lab).
3. **`IX_PayedContinusPayment_TransactionId`** (already on lab) — DELETE / count / reports.
4. `SET NOCOUNT ON`, `dbo.` qualify, `NOLOCK` on read sources, TRY/CATCH status text.
5. Hadafmandi: **one INSERT** instead of two.

Yarane `CalculateMarakezYarane`:

1. Same join/filter/column map as old.
2. New **`IX_MakeOver_CalcSupply_Covering`** on `(MakeOverSupplyLocationId)` INCLUDE (pay columns) — created on lab (~2s).
3. Existing `IX_TransactionId` on `PayedMakeOvers` keeps DELETE cheap.

## Lab deploy status

| Proc | `_OLD` backup | Optimized live |
|------|---------------|----------------|
| CalculateTransaction | yes (earlier) | yes |
| CalculateHadafmandi | yes | yes |
| CalculateEmdad | yes | yes |
| CalculateHaghParastari | yes | yes |
| CalculateHaghParastariFamily | yes | yes |
| CalculateMarakezYarane | yes | yes |

Scripts:

- `scripts/probe-all-calc-procs.mjs` — defs + DMV  
- `scripts/probe-calc-indexes-and-extras.mjs` — indexes / extras  
- `scripts/deploy-all-calc-procs-lab.mjs` — backup + deploy (no EXEC by default)  
- `scripts/ab-small-calcs-lab.mjs` — EXEC A/B vs source totals  
- Optimized SQL under `docs/_sp_investigate/all-calcs/*_OPTIMIZED_LAB.sql`

## Lab A/B vs source (EXEC, optimized live)

From `ab-small-calcs.json` — **all MATCH** (cnt + money/subsidy sums):

| Proc | TrId | Rows | Elapsed | Match |
|------|------|------|---------|-------|
| CalculateEmdad | 10810 | 17 495 | 14s | yes |
| CalculateHaghParastari | 10812 | 34 038 | 33s | yes |
| CalculateHaghParastariFamily | 10795 | 127 240 | 65s | yes |
| CalculateMarakezYarane | 727 / supply 2 | 55 555 | 103s cold → **2s warm** | yes |

Notes:

- Cold Marakez paid for a heavy DELETE of prior rows; warm re-EXEC on same txn: **2s** (old DMV INSERT ~25s).
- Family/Spinal still spend time on DELETE against large `PayedContinusPayment` for that `TransactionId`.
- `CalculateTransaction` already validated earlier (~61s, peer assert).

## Impact (lab)

| Workload | Before | After (lab) |
|----------|--------|-------------|
| Base `CalculateTransaction` | ~9+ min / 54M reads | ~61s |
| Hadafmandi | same pattern + whole-table update | optimized deployed (same pay totals) |
| Emdad / Spinal / Family | + baccountvalidated full scan | 14s / 33s / 65s, **totals MATCH** |
| MarakezYarane | ~25s INSERT | **~2s warm** with covering index |

## Next (prod / ops)

1. Optional: Hadafmandi EXEC on a scratch `@TrId` (same ~1.5M set as base).  
2. Prod: DBA sign-off, deploy indexes first, then SPs; keep `*_OLD` for rollback.  
3. Do **not** change `CalculateMarakezYarane_2` / Etiad unless panel starts calling them — different filters.
