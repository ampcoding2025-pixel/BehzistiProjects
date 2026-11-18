# PayDiskPanel ↔ Armaghan integration

Discovered read-only on 2026-11-14 from `http://10.1.0.10/#/app/centers/makeovers/transactions`.

## Hosts

| Role | URL |
|------|-----|
| UI | `http://10.1.0.10` (AngularJS) |
| API `serviceBase` | `http://10.1.0.16/` |
| Diskette download | `http://10.1.0.17//Diskette` |
| SQL (prod read) | `10.1.0.157` / `AmarDB` (SQL login) |
| SQL (lab CRUD) | `10.0.28.10` / `DB_Mostamary` (Windows auth) — set `PAYDISK_USE_TEST_DB=true` |

## MakeOver transaction object

`{ Id, Title, Key1, Key2, Key3, Registrar, RegistrationDateTime, Date }`

- `Key2` → person-list CSV ready (`*-Marakez-CSV-Zihesab-{Id}.csv`)
  - File on share: `\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette\{Key2}`
  - Panel approve: `EXEC dbo.ListExporMarakez @TranId, @FileName` (same as Armaghan BCP)
- `Key3` → bank diskette ready

## API used by the page

- `GET MakeOver/GetPayedTransaction`
- `POST MakeOver/RegisterTransaction?title=`
- `POST MakeOver/Calculate` with `{ Id, Title, Type, TransactionId, SupplyLocationId:[-100] }`
- `POST Diskette/GetListMakeover?id=`
- `POST Diskette/GetMakeOver?id=`
- Download: `{disketteBase}/Download?filename=`

## Parallel SQL path (ops doc)

`EXEC CalculateMarakezYarane @TransactionId, @SupplyLocationId`

Must reconcile with UI `Type` path before production automation.

## Panel policy

- Mostamari → Excel in PayDiskPanel
- Yarane → compute/list then hand off to finance
- No province access; HQ-only (~6 users)
- Full request/audit log owned by PayDiskPanel
- **Lab DB** (`PAYDISK_USE_TEST_DB=true`): panel may `EXEC CalculateMarakezYarane` and `UPDATE Key2/Key3`
- **AmarDB**: SELECT-only from this UI

## Auth + Worker

- Login allowlist: 6 HQ users (`src/lib/auth/users.ts` or `PAYDISK_USERS_JSON`)
- Signed cookie session (`PAYDISK_SESSION_SECRET`)
- Roles: `operator` / `admin` can create+run; `finance_viewer` read-only
- Lab writes: `POST /api/armaghan/transactions/:id/lab` when `PAYDISK_USE_TEST_DB=true`
- Worker on AmarDB stays dry-run unless separately wired; never EXEC prod from panel
- Requests persisted in `data/requests.json`
