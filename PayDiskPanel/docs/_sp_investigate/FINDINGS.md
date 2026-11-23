# CalculateTransaction — lab investigation (2026-11-23)

## What the SP does (current)

1. Mark `PayedTransaction.Description = در حال محاسبه`
2. `DELETE PayedContinusPayment WHERE TransactionId=@TrId`
3. **Whole-table** `UPDATE ContinusPayment SET baccountvalidated=1 WHERE … IS NULL`
4. `INSERT … SELECT` from `ContinusPayment` where `ContinusPaymentSupplyLocationId IN (1,2,3,4,9…38)` (~1.58M rows)
5. Rebuild `IT.dbo.tbl_PayedContinusPayment_ReceiverNID` for `@TrId` (join back to `ContinusPayment`)
6. Write rowcount into `Description`

## Execution evidence (lab DMVs)

| Statement | Elapsed | Logical reads | Rows |
| --- | ---: | ---: | ---: |
| INSERT PayedContinusPayment | **~549 s** | **~54.3M** | ~1.58M |
| UPDATE baccountvalidated | ~2.3 s | ~49k | 0 |
| DELETE / status | ~0 | tiny | — |

**Conclusion:** wall-clock is almost entirely the bulk INSERT from `ContinusPayment` (~1.76M source table; PayedContinusPayment heap/cluster is **~315M rows**).

## Index gaps

- `ContinusPayment`: has `(ContinusPaymentSupplyLocationId, CenterId)` but **not covering** for the SELECT list → lookups dominate reads.
- `PayedContinusPayment`: missing-index DMV strongly wants `(TransactionId) INCLUDE (Money, …)` (~99% impact) — helps DELETE + reports more than the INSERT source scan.
- Proposed covering index: see `CalculateTransaction_OPTIMIZED_LAB.sql`.

## Correctness risk in current IT insert

Join is only `PayedContinusPayment.PersonId = ContinusPayment.PersonId` (plus supply filter on ContinusPayment). A person with multiple supply locations can **duplicate** IT rows. Optimized script joins also on `SupplyLocationId`.

## Recommended rollout

1. Backup current proc: `CalculateTransaction_OLD`
2. Create covering indexes on **lab** off-hours
3. Deploy optimized proc on **lab** only
4. Compare COUNT/SUM(Money) vs a known-good TrId
5. Only then promote to HQ with change ticket

## Lab deploy results (2026-11-23)

Done on `HQ-LAB-UI-DB` / `DB_Mostamary`:

| Item | Status |
| --- | --- |
| `CalculateTransaction_OLD` | created (original body) |
| `IX_ContinusPayment_CalcSupply_Covering` | created (~4s) |
| Optimized `CalculateTransaction` | deployed (v2: no mega-TRAN) |
| `IX_PayedContinusPayment_TransactionId` | **not** built yet (315M rows — run off-hours) |

### A/B TrId **10813** (v1 optimized with mega-TRAN + TABLOCK)

| | |
| --- | --- |
| Before cnt / money | 1,580,875 / 45,929,670,900,000 |
| After cnt / money | **identical** (`cntMatch` + `moneyMatch`) |
| Elapsed | **1287 s (~21 min)** |

Prior plan-cache INSERT-only was ~549 s; v1 was slower because DELETE+INSERT+IT ran inside **one giant transaction**.

### Next speed step

1. Keep v2 SP (already deployed — no mega-TRAN)
2. Build `IX_PayedContinusPayment_TransactionId` off-hours:
   `node scripts/deploy-calculate-transaction-lab.mjs --skip-run --skip-big-index=false`
3. Re-run A/B on 10813 and compare elapsedSec
