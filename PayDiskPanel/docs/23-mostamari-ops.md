# Mostamari diskette ops (panel orchestration)

Source: ops doc «مراحل تهیه دیسکت مستمری». UI: `/request/new?family=mostamari` (or open a list row with family=mostamari).

Writes (create / `Calculate*` / approve) only when DB target is **lab**. Prod/replica are read-only for reviews and lists.

## Types → Ky → procedure

| Panel type | Ky | Stored procedure |
| --- | --- | --- |
| Base pension | `Mst_131500` | `CalculateTransaction` |
| Hadafmandi increase | `Mst_HDF` | `CalculateHadafmandi` |
| Family nursing | `Mst_F_PRSTRI` | `CalculateHaghParastariFamily` |
| Spinal nursing | `Mst_PARASTARI` | `CalculateHaghParastari` |
| Emdad aid | `Mst_Emdad` | `CalculateEmdad` |
| Cancelled | `CANCELLED` | Ky only — other approve fields null |
| Misc | `Motafarege` | — |

Nursing + emdad use the **same** `PayedTransaction` define path as base.

## Logical steps (wizard)

| Step | Required? | What it does |
| --- | --- | --- |
| **Type** | yes | Pick pipeline |
| **Define** | yes | `INSERT PayedTransaction` (Title, RelatedTo date, registrar) |
| **Calculate** | yes* | `EXEC <proc> @TrId` (*or skip if already calculated) |
| **Money report** | yes | Histogram + IsDead=0 report |
| **IBN duplicates** | optional | `IBN_AccountNumber` RN>1 — shown for nursing/emdad |
| **Pay list** | yes† | Sample `PayedContinusPayment` + Sheba; NID as text (†not on hadafmandi pipeline) |
| **Pair sync** | optional | Base ↔ hadafmandi PersonId/money diff preview (DELETE stays manual) |
| **Bank disk prep** | optional | Missing-IBN sample; 100k Excel chunks stay offline |
| **Approve** | yes | `Ky`, `Year=YYYYMM`, `AcceptorUserId`, `AcceptanceDateTime` |
| **Post-pay** | optional | Returns / yearly amount-update reminders |

Optional steps show **Skip optional step** in the UI.

## Pipelines by type

```
mst-base:        type → define → calculate → report → payList → pairSync? → bankPrep? → approve → postPay?
mst-hadafmandi:  type → define → calculate → report → pairSync? → approve → postPay?
                 (no payList/bankPrep — 1404 merged amounts; twin txn + CANCELLED for budget ceiling)
mst-hagh-*:      type → define → calculate → report → ibn? → payList → bankPrep? → approve → postPay?
mst-emdad:       type → define → calculate → report → ibn? → payList → bankPrep? → approve → postPay?
```

Defined in `src/lib/mostamari/types.ts` (`pipeline` on each type).

## Still outside the wizard (by design)

- Bulk `DELETE` of pair diffs / orphans vs `IT.dbo.tbl_PayedContinusPayment_ReceiverNID`
- Writing 100k chunk tables / bank Excel files
- Annual `ContinusPaymentDefenition` / `ContinusPayment` / threshold / `UpdateContinusPaymentProvinceTotalBudget`
- Full budget performance exports

Preview/compare + docs scripts: `/reports`, `txn-scripts`, wizard pair-diff & missing-ibn actions.
