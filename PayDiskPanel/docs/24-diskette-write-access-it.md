# Diskette write access — IT / DBA hand-off

**Goal:** Panel users only use the web UI. The server uses SQL login **`behqlik`**. File write to the Armaghan Diskette share runs via `xp_cmdshell` as **`WEBFARM\a.mehrabi`**. Grant this **once** — not per HQ user.

| Item | Value |
|------|--------|
| Target share | `\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette` |
| SQL instance | `SQLCLUSTER` / `10.1.0.155` |
| Database | `DB_Mostamary` |
| App SQL login | `behqlik` |
| xp_cmdshell Windows proxy | `WEBFARM\a.mehrabi` |

---

## Why this model

| Layer | Who | Needs |
|-------|-----|--------|
| Panel UI | HQ users (e.g. `BEHZISTI\m.alipor`) | PayDiskPanel login + app supply/center rights only |
| SQL writes | `behqlik` | EXECUTE on calc / list SPs + `xp_cmdshell` |
| File on Diskette | `WEBFARM\a.mehrabi` | **Modify** on the Diskette share (once) |

End users must **not** need UNC or `xp_cmdshell`. Otherwise every new operator hits the same ACL fight.

---

## Step 1 — Confirm accounts

| Account | Role |
|---------|------|
| SQL login **`behqlik`** | App write login (create txn, Calculate*, approve / list export) |
| Windows **`WEBFARM\a.mehrabi`** | Current `xp_cmdshell` proxy (runs BCP) |
| HQ Windows users | **No** share / `xp_cmdshell` needed |

---

## Step 2 — SQL rights for `behqlik` on `DB_Mostamary`

```sql
USE DB_Mostamary;
GO

-- App data access (skip if already granted)
ALTER ROLE db_datareader ADD MEMBER [behqlik];
ALTER ROLE db_datawriter ADD MEMBER [behqlik];

GRANT EXECUTE ON dbo.CalculateMarakezYarane TO [behqlik];
GRANT EXECUTE ON dbo.ListExporMarakez TO [behqlik];
-- مستمری bank diskette (dbo.Export → FileName + fixed-width Account/Money)
GRANT EXECUTE ON dbo.Export TO [behqlik];
GO
```

---

## Step 3 — Enable `xp_cmdshell` + grant execute to `behqlik`

```sql
USE master;
GO

EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1;
RECONFIGURE;
GO

GRANT EXECUTE ON xp_cmdshell TO [behqlik];
GO
```

**Check (as `behqlik`):** `HAS_PERMS_BY_NAME('xp_cmdshell','OBJECT','EXECUTE')` should be `1`.

---

## Step 4 — Fix / keep `xp_cmdshell` proxy credential

Non-sysadmin logins need a **Credential + Proxy** so `xp_cmdshell` can log on as a Windows user.

If `EXEC xp_cmdshell` fails with:

```text
Msg 15121 … LogonUserW failed with error code: 1330
```

the proxy password is typically expired — update the credential secret (do not invent a new proxy unless replacing the account).

```sql
-- Example only — use your real credential name / password policy
-- Prefer ALTER existing credential over recreate:

-- ALTER CREDENTIAL [##xp_cmdshell_proxy_credential##]
--   WITH IDENTITY = N'WEBFARM\a.mehrabi',
--        SECRET = N'<current-valid-password>';
```

**Check as `behqlik`:**

```sql
EXEC xp_cmdshell 'whoami';
-- Expected: webfarm\a.mehrabi
-- Must NOT be Msg 15121 / LogonUserW 1330
```

---

## Step 5 — Critical: share ACL for the proxy

On the file server that hosts:

`\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette`

Grant **`WEBFARM\a.mehrabi`**:

- **Modify** (or at least Read + Write + Create files + Delete)

Do **not** depend on granting this to each HQ Windows user.

**Verify as `behqlik`:**

```sql
EXEC xp_cmdshell 'dir "\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette"';
-- Must list folder contents
-- Must NOT say "Access is denied."
```

---

## Step 6 — End-to-end smoke test

```sql
-- Use a real calculated MakeOver txn id, e.g. 850
DECLARE @TranId bigint = 850;
DECLARE @FileName nvarchar(100) =
  N'test-' + CONVERT(nvarchar(36), NEWID()) + N'-Marakez-CSV-Zihesab-850.csv';

EXEC dbo.ListExporMarakez @TranId = @TranId, @FileName = @FileName;

EXEC xp_cmdshell
  N'dir "\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette\test-*-Marakez-CSV-Zihesab-850.csv"';

SELECT Id, Key2
FROM DB_Mostamary.dbo.MakeOverTransactions
WHERE Id = @TranId;
```

Then confirm Armaghan UI can download that `Key2` filename.

If this was only a probe, restore the previous `Key2` afterward.

---

## Step 7 — What HQ users get (app team, not share ACL)

- Login to PayDiskPanel
- Access by یارانه supply / مستمری type / center in app config
- **No** UNC, **no** `xp_cmdshell`, **no** per-user Diskette ACL

---

## IT checklist

- [ ] `behqlik` can `EXECUTE` calc SPs + `ListExporMarakez`
- [ ] `behqlik` can `EXECUTE xp_cmdshell`
- [ ] `EXEC xp_cmdshell 'whoami'` → `webfarm\a.mehrabi` (no 1330)
- [ ] **`WEBFARM\a.mehrabi` has Modify on Diskette share**
- [ ] `dir` on that UNC via `xp_cmdshell` succeeds
- [ ] `ListExporMarakez` creates a real `.csv` on the share

---

## One-line ask for IT

Please give **Modify** on `\\sqlcluster\MSSQLSERVER\Docs\Documents\Diskette` to **`WEBFARM\a.mehrabi`** (SQL `xp_cmdshell` proxy). Panel / HQ Windows users will not need share access.

---

## Related panel docs

- `docs/22-yarane-wizard.md` — wizard flow; approve uses `ListExporMarakez`
- `docs/INTEGRATION.md` — Armaghan Key2 / Diskette download overview
