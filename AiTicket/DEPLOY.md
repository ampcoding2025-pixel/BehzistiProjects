# AiTicket — Run & Deploy Guide

How to run locally and publish the **web** (Next.js) and **API** (ASP.NET Core) on specific ports.

| App | Default URL | Config |
|-----|-------------|--------|
| Web UI | `http://localhost:3000` | `PORT` / `next dev -p` / `next start -p` |
| Analytics API | `http://localhost:5088` | `ASPNETCORE_URLS` or `launchSettings.json` |

---

## Prerequisites

- **Node.js** 20+ and npm
- **.NET SDK** 10+ (`dotnet --version`)
- Optional (live data): SQL Server access to **DidehbanDb** (read-only)

---

## 1. Analytics API (`api/AiTicket.Api`)

### Configure Didban (once)

```powershell
cd api/AiTicket.Api
dotnet restore
dotnet user-secrets init
dotnet user-secrets set "Didban:ConnectionString" "Server=HOST;Database=DidehbanDb;User Id=USER;Password=PASS;Encrypt=True;TrustServerCertificate=True;ApplicationIntent=ReadOnly"
```

Or set environment variable (no secrets in git):

```powershell
$env:Didban__ConnectionString = "Server=HOST;Database=DidehbanDb;..."
```

### Run — default port **5088**

```powershell
cd api/AiTicket.Api
dotnet run
```

- Swagger: http://localhost:5088/swagger  
- Health: http://localhost:5088/health  

### Run — custom port

```powershell
cd api/AiTicket.Api
# Example: port 5090
$env:ASPNETCORE_URLS = "http://0.0.0.0:5090"
dotnet run --no-launch-profile
```

Or permanently change `Properties/launchSettings.json`:

```json
"applicationUrl": "http://localhost:5090"
```

### Publish (production-style)

```powershell
cd api/AiTicket.Api
dotnet publish -c Release -o .\publish
$env:ASPNETCORE_URLS = "http://0.0.0.0:5088"
$env:ASPNETCORE_ENVIRONMENT = "Production"
$env:Didban__ConnectionString = "Server=...;ApplicationIntent=ReadOnly"
.\publish\AiTicket.Api.exe
```

Linux / container:

```bash
export ASPNETCORE_URLS=http://0.0.0.0:5088
export Didban__ConnectionString="Server=...;ApplicationIntent=ReadOnly"
dotnet AiTicket.Api.dll
```

---

## 2. Web UI (`web`)

### Configure env

```powershell
cd web
copy .env.example .env.local
```

Edit `.env.local`:

```env
# mock = no API needed | api = call AiTicket.Api
NEXT_PUBLIC_DATA_PROVIDER=api
NEXT_PUBLIC_API_BASE_URL=http://localhost:5088
```

If the API uses another port, update the base URL to match, e.g. `http://localhost:5090`.

### Dev — default port **3000**

```powershell
cd web
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000

### Dev — custom port

```powershell
cd web
# Example: port 3010
npx next dev -p 3010
# or
$env:PORT = "3010"
npm.cmd run dev
```

### Production build & start

```powershell
cd web
npm.cmd run build

# Default port 3000
npm.cmd run start

# Custom port, e.g. 8080
npx next start -p 8080
# or
$env:PORT = "8080"
npm.cmd run start
```

Bind on all interfaces (LAN / VM):

```powershell
npx next start -H 0.0.0.0 -p 3000
```

---

## 3. Typical local stack (two terminals)

**Terminal A — API on 5088**

```powershell
cd api/AiTicket.Api
dotnet run
```

**Terminal B — Web on 3000 → API**

```powershell
cd web
# .env.local: NEXT_PUBLIC_DATA_PROVIDER=api
#             NEXT_PUBLIC_API_BASE_URL=http://localhost:5088
npm.cmd run dev
```

---

## 4. Port cheat sheet

| Goal | Command / setting |
|------|-------------------|
| API :5088 | `dotnet run` (default `launchSettings`) |
| API :5090 | `$env:ASPNETCORE_URLS="http://0.0.0.0:5090"; dotnet run --no-launch-profile` |
| Web :3000 | `npm run dev` / `npm run start` |
| Web :3010 | `npx next dev -p 3010` or `npx next start -p 3010` |
| Point web at custom API | `NEXT_PUBLIC_API_BASE_URL=http://HOST:PORT` in `.env.local` then restart Next |

---

## 5. IIS / reverse proxy (optional)

- Run API under Kestrel (`ASPNETCORE_URLS`) and reverse-proxy with IIS ARR / nginx to e.g. `/api`.
- Run `next start -p 3000` behind the same proxy, or host static/`standalone` output separately.
- Ensure the browser-facing origin used in `NEXT_PUBLIC_API_BASE_URL` is reachable from clients (not only `localhost` if users are remote).

---

## 6. Safety

- Didban access is **read-only** (`ApplicationIntent=ReadOnly`).
- Never commit connection strings or `.env.local` with secrets.
- See also `api/README.md` and root `README.md`.
