# PayDiskPanel

Internal RTL panel for inspecting and (on lab only) working with PayDisk / Armaghan payment-diskette transactions against SQL Server.

Frontend UI and backend API live in **one Next.js app** (App Router + Route Handlers) on port **3020**.

---

## Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 20+ (Windows recommended for lab ODBC) |
| Framework | Next.js 15 (App Router) |
| UI | React 19, TypeScript, Tailwind CSS |
| Auth / session | Cookie session (`PAYDISK_SESSION_SECRET`), role + ACL |
| SQL (prod / replica) | `mssql` + **Tedious** (SQL login) |
| SQL (lab) | `mssql` / **msnodesqlv8** (Windows Trusted Connection) |
| Databases | Prod `DB_Mostamary` @ `10.1.0.155`; replica `AmarDB` @ `10.1.0.157`; lab `DB_Mostamary` @ `10.0.28.10` |

Active DB target is switched at runtime from **Settings → Database** and stored in `data/db-target.json`.

---

## Technical requirements

### Machine

- **OS:** Windows Server / Windows 10+ (lab uses Windows auth + native ODBC)
- **Node.js:** 20 LTS or newer
- **npm:** 10+
- **ODBC Driver 18 for SQL Server** installed (required for lab)
- Network reachability:
  - Lab: `10.0.28.10:1433`
  - Replica (read): `10.1.0.157:1433`
  - Prod (read): `10.1.0.155:1433` (optional; needs SQL grant)

### SQL accounts

| Target | Auth | Access in panel |
| --- | --- | --- |
| `prod` (155) | SQL login (`PAYDISK_SQL_USER` / password) | Read-only |
| `replica` (157) | Same SQL login | Read-only (preferred when 155 is unreachable) |
| `test` (lab) | Windows account of the app process (`Trusted_Connection`) | Read + whitelisted writes |

Passwords that contain `$` or `#` must use **base64** in env (`PAYDISK_SQL_PASSWORD_B64`) — Next.js env expansion corrupts plain `$2`-style values.

### Build / native modules

- `msnodesqlv8` is a **native** addon — install and run on the same Windows machine architecture (rebuild after Node upgrades).
- Next must keep it external: `serverExternalPackages: ["msnodesqlv8", "mssql"]` (already in `next.config.ts`).

---

## Local development

```bash
cd PayDiskPanel
copy .env.example .env.local   # then fill secrets
npm install
npm run dev
```

Open: [http://localhost:3020](http://localhost:3020)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (UI + API) on `0.0.0.0:3020` |
| `npm run build` | Production build |
| `npm run start` | Serve production build on `0.0.0.0:3020` |
| `npm run lint` | ESLint |
| `npm run db:test` | Readonly DB smoke script |

---

## Environment variables

See `.env.example`. Important keys:

| Variable | Description |
| --- | --- |
| `PAYDISK_SESSION_SECRET` | Session signing secret (required in prod) |
| `PAYDISK_DB_TARGET` | Default `prod` \| `replica` \| `test` if `data/db-target.json` missing |
| `PAYDISK_SQL_HOST` / `_PORT` / `_DATABASE` / `_USER` | Prod AmarDB |
| `PAYDISK_SQL_PASSWORD_B64` | SQL password (Base64 UTF-8) — preferred |
| `PAYDISK_SQL_PASSWORD` | Plain password fallback (avoid if it has `$` / `#`) |
| `PAYDISK_SQL_REPLICA_HOST` | Replica host (157) |
| `PAYDISK_TEST_SQL_HOST` / `_DATABASE` | Lab server / DB |
| `PAYDISK_TEST_SQL_CONNECTION` | Optional full ODBC connection string override |
| `PAYDISK_SQL_ENCRYPT` / `PAYDISK_SQL_TRUST_CERT` | TLS options for Tedious |

Runtime switch file (created automatically):

```text
data/db-target.json  →  { "target": "test" | "prod" | "replica" }
```

---

## Deploy (Windows host / IIS-adjacent or service)

This app is **not** a static frontend + separate API. Deploy the Next.js Node process.

### 1. Prepare host

1. Install Node.js 20 LTS and ODBC Driver 18 for SQL Server.
2. Ensure the Windows service account can reach lab via Windows auth (and SQL login can reach 157/155 as needed).
3. Open firewall for inbound **3020** (or your chosen port) on the LAN.

### 2. Install & build

```bash
cd PayDiskPanel
npm ci
# set production .env.local or system env vars (never commit secrets)
npm run build
```

### 3. Run

```bash
npm run start
# listens on 0.0.0.0:3020
```

Recommended: run under **NSSM**, Windows Service, or IIS **HttpPlatformHandler** / reverse proxy (ARR) to Node — keep a single long-lived Node process (connection pools are in-memory).

### 4. Production checklist

- [ ] Strong `PAYDISK_SESSION_SECRET`
- [ ] `PAYDISK_SQL_PASSWORD_B64` set correctly (verify login to 157)
- [ ] Lab ODBC works as the service Windows identity
- [ ] Default target: prefer `replica` or `test` if operators lack 155 access
- [ ] `data/` writable by the process (for `db-target.json`)
- [ ] Only admins can switch DB (enforced in `/api/settings/db`)
- [ ] Writes only when active target is lab (`test`)

### 5. Reverse proxy (optional)

Terminate TLS at IIS/nginx and proxy to `http://127.0.0.1:3020`. Preserve cookies / `Host` headers for session auth.

---

## Architecture notes

- **List queries** are server-paginated (`OFFSET` / `FETCH`) — never load all transactions client-side.
- **Type filter** on AmarDB uses payed-first SQL over `PayedMakeOvers` (schema has no `MakeOverDefinitions` on 155/157).
- **Lab schema** includes `MakeOverDefinitions` / `DefinitionId`; caps are detected per target.
- Switching DB **connects first**, then persists the target; lab uses a single in-flight ODBC connect (no parallel opens).

More detail: `docs/INTEGRATION.md`, `docs/21-amardb-schema-handoff.md`, `docs/19-ops-doc-scripts-readonly.md`, `docs/23-mostamari-ops.md` (مستمری wizard).

---

## Ports

| Service | Port |
| --- | --- |
| PayDiskPanel (UI + API) | **3020** |
