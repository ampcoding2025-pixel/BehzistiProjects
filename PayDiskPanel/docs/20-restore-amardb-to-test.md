# Restore AmarDB → test server (without stopping production)

**Production AmarDB:** `10.1.0.157` — stays ONLINE; a normal `BACKUP DATABASE` does **not** stop it.  
**Test SQL:** `10.0.28.10` (`HQ-LAB-UI-DB`) — Windows auth `BEHZISTI\m.alipor` (sysadmin).  
**Target DB name on test:** `AmarDB_Test` (keeps existing `DB_Mostamary` / `IT` untouched).

## Why we cannot finish it from this workstation alone

| Step | Status |
|------|--------|
| Backup AmarDB online | **Blocked** — login `alipoor` has `BACKUP DATABASE = 0` |
| Windows auth to `10.1.0.157` | **Blocked** — untrusted domain |
| Admin share `\\10.0.28.10\D$` | **Access denied** |
| Restore on test once `.bak` exists | **Ready** — you are sysadmin; ~430GB free on test D: |

## What DBA / you need to provide

1. An **online** backup of AmarDB (does not stop production), e.g.:

```sql
-- Run on 10.1.0.157 as a login that CAN backup (sysadmin / db_backupoperator)
BACKUP DATABASE [AmarDB]
TO DISK = N'\\<share-readable-by-test>\AmarDB_copyonly.bak'
WITH COPY_ONLY, COMPRESSION, INIT, STATS = 5;
```

2. Copy that file to a path the **test instance** can read, preferably:

`D:\BK\AmarDB_copyonly.bak` on `10.0.28.10`

(Create `D:\BK` and `D:\DB` on the test box if missing — SQL defaults are BackupDirectory=`D:\BK`, DefaultData=`D:\DB`.)

## Restore on test (does not touch production)

```sql
-- Run on 10.0.28.10 (Windows auth / SSMS)
-- Inspect logical names first:
RESTORE FILELISTONLY
FROM DISK = N'D:\BK\AmarDB_copyonly.bak';

-- Then restore as a NEW name (example logical names — adjust from FILELISTONLY):
RESTORE DATABASE [AmarDB_Test]
FROM DISK = N'D:\BK\AmarDB_copyonly.bak'
WITH
  MOVE N'AmarDB'     TO N'D:\DB\AmarDB_Test.mdf',
  MOVE N'AmarDB_log' TO N'D:\DB\AmarDB_Test_log.ldf',
  REPLACE,
  RECOVERY,
  STATS = 5;
```

## Current lab mode (no Amar restore yet)

Until a full AmarDB `.bak` is available, the panel uses:

```
PAYDISK_USE_TEST_DB=true
PAYDISK_TEST_SQL_HOST=10.0.28.10
PAYDISK_TEST_SQL_DATABASE=DB_Mostamary
```

Windows auth · CRUD lab (scratch table `_PayDiskPanel_Scratch` verified).  
Set `PAYDISK_USE_TEST_DB=false` to switch reads back to production AmarDB.

After a future Amar restore as `AmarDB_Test`, change `PAYDISK_TEST_SQL_DATABASE=AmarDB_Test`.

## Size note

AmarDB is large (hundreds of millions of rows in payment tables). Prefer `COMPRESSION` and confirm free space on test `D:` before restore.
