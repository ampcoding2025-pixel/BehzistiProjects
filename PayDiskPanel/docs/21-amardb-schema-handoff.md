# AmarDB Schema Handoff (Read-Only)

**Engine:** SQL Server · **Host:** `10.1.0.157` · **Database:** `AmarDB`  
**Scan:** 2026-11-14 · login `alipoor` (metadata SELECT only)  
**Policy:** no INSERT / UPDATE / DELETE / DDL from this scan

## Companion files

| File | Contents |
|------|----------|
| `docs/_amardb_schema/tables.json` | 261 tables + approx row counts |
| `docs/_amardb_schema/columns.json` | 2165 columns |
| `docs/_amardb_schema/fks.json` | empty for this login (0 visible FKs) |
| `docs/_amardb_schema/views.json` | 1 view |
| `docs/_amardb_schema/summary.json` | scan summary |
| `docs/_amardb_schema/core-tables.json` | payment / makeover related tables |
| `docs/_amardb_schema/core-columns.json` | columns for core domain tables |
| `scripts/scan-amardb-schema.mjs` | re-run scanner |

## Inventory

| Metric | Count |
|--------|------:|
| Tables (`dbo`) | 261 |
| Columns | 2165 |
| Visible FKs | 0 |
| Visible procedures | 0 |
| Views | 1 |

> **Note:** this login sees table/column metadata but **not** `sys.procedures` or `sys.foreign_keys` (likely permission). `Calculate*` SPs exist on lab `DB_Mostamary` and are documented in ops docs; they are not listed here from AmarDB.

## PayDisk domain model

```
MakeOverTransactions 1:N PayedMakeOvers
PayedMakeOvers → Person, Center, MakeOverSupplyLocation
Center → City → Province
PayedTransaction 1:N PayedContinusPayment
PayedContinusPayment → Person, Center, IBN_AccountNumber (by AccountNumber)
MakeOver = live/request rows (before / beside PayedMakeOvers)
```

### Approximate sizes (from `sys.partitions`)

| Table | ≈ rows |
|-------|-------:|
| PayedContinusPayment | 319,123,803 |
| PayedMakeOvers | 35,150,087 |
| Person | 25,430,194 |
| IBN_AccountNumber | 1,584,038 |
| MakeOverRequest | 1,365,872 |
| MakeOver | 1,220,211 |
| Center | 67,775 |
| MakeOverTransactions | 795 |
| PayedTransaction | 771 |
| MakeOverSupplyLocation | 80 |
| Province | 33 |

## Core columns

### `MakeOverTransactions` (یارانه header)

`Id, Title, Date, Acceptor, Description, Registrar, RegistrationDateTime, Key1, Key2, Key3`

- **Key2** = لیست افراد (CSV flag/filename)
- **Key3** = دیسکت بانک

### `PayedMakeOvers` (یارانه calculation rows)

`Id, PersonId, UserRegistrarId, RegistrationDateTime, MakeOverSupplyLocationId, MakeOverActivityId, FromDate, CenterId, Detail, LocalSubsidy, UniverseSubsidy, IsNoName, IsSpecial, DefenitionId, Mosharekat, TransactionId, NewUniversalSubsidy, Ver, CenterAccount, BankId`

### `MakeOverSupplyLocation`

`MakeOverSupplyLocationId, MakeOverSupplyLocationTitle, Budget, MakeOverSuplyLocationKeyword, GroupId`

### `PayedTransaction` (مستمری header)

`Id, Title, UserRegistrarId, RegistrationDate, Description, RelatedTo, AcceptorUserId, AcceptanceDateTime, Year, Ky, CalculationToken, FileStreamId, FileName, ExportToken, bPublished, CalculationSupplyLocations, PublishDateTime, PivotToken, PivotStreamId, ListToken, ListStreamId`

### `PayedContinusPayment` (مستمری rows)

`Id, PersonId, FamilyCount, SupplyLocationId, BankId, AccountNumber, Money, TransactionId, Date, CenterRegistrarId`

### Geo / master

- **Person:** `ID, FirstName, LastName, NID, …, IsDead, Cellphone, …`
- **Center:** `CenterId, CenterTitle, CityID, IBN, Account, BankId, …`
- **City:** `CityId, CityTitle, ProvinceId`
- **Province:** `ProvinceId, ProvinceTitle, …`
- **IBN_AccountNumber:** `row_id, NID, AccountNumber, IBN, status`

## Lab vs AmarDB differences (observed)

| Item | AmarDB (`10.1.0.157`) | Lab `DB_Mostamary` (`10.0.28.10`) |
|------|------------------------|-------------------------------------|
| `MakeOverTransactions.DefinitionId` | not present | present (lab-only enrichment) |
| `Calculate*` visibility | not visible to `alipoor` | visible + executable |
| MakeOverTransactions ≈ rows | 795 | ~660 |

## Re-scan

```bash
node scripts/scan-amardb-schema.mjs
```

Requires `.env.local` AmarDB SQL login (`PAYDISK_SQL_*`).
