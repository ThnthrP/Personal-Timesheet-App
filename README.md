# Personal Timesheet App (PTA)

A web-based daily timesheet and labor-cost platform for construction field
work. Foremen log crew hours each day. Project Managers review and approve
them. Top Management signs off each pay period. Accounting turns approved
hours into payroll using each worker's contract rate.

PTA replaces the earlier Firebase prototype with a NestJS + PostgreSQL
backend and a Next.js frontend. It keeps the prototype's look and workflow.

Workers, trades (positions), and projects come from the company's
[Manpower Management System (MMS)](https://github.com/ThnthrP/MMS-Chevron),
so Foremen pick from the same employee list HR maintains. See
[MMS Integration](#mms-integration).

---

## Overview

PTA covers the full cycle from field log to payroll:

- daily crew hours entered on site
- PM review with approve / reject (with reason) and resubmit
- 15-day or custom pay-period sign-off by Top Management
- worker pay rates by trade and date range
- payroll reports with ST / OT1 / OT2 split, print and CSV export

**Users and default landing pages:**

| Role | Landing page | Main job |
|------|--------------|----------|
| Foreman | Field Input | Log daily crew hours |
| Project Manager | Approvals | Approve or reject daily logs |
| Operations Director | Dashboard | Review costs, sign off pay periods |
| Accounting | Payroll | Set pay rates, run payroll |
| Administrator | Field Input | Manage master data, access to all pages |

---

## 📸 Screenshots

### 🔐 Login
![Login](screenshots/login.png)

### Field

#### 📝 Field Input
Daily log form (project, date, notes) with a Manpower Hours table and live ST / OT calculation.
Below the form, **My Recent Submissions** shows each log's status, the PM's rejection reason, and Edit & Resubmit.
![Field Input](screenshots/field-input.png)

#### 🔗 Workers from MMS
Workers are listed with their MMS employee code. Picking a worker fills in
Position / Trade from their position in MMS.
![Worker list from MMS](screenshots/field-input-mms-workers.png)

### Review

#### ✅ Approvals
Pending queue and recently approved logs for the Project Manager.
![Approvals](screenshots/approvals.png)

#### 🔍 Review Timesheet
Line-by-line hours with estimated cost, Approve or Reject with a reason.
![Review Timesheet](screenshots/review-modal.png)

### Management

#### 📊 Executive Dashboard
Date presets, KPIs, cost by project, hours distribution, and job code table.
![Dashboard](screenshots/dashboard.png)

#### 🖋️ Period Sign-off
Period report with overlap warnings, Approve or Reject the whole period, and sign-off history.
![Period Sign-off](screenshots/period-sign-off.png)

### Accounting

#### 📄 Worker Contracts
Contracts by worker and trade, plus a "Needs a Pay Rate" list for approved work without a rate.
![Worker Contracts](screenshots/worker-contracts.png)

#### 💰 Payroll
Payroll by worker for signed-off periods, with summary, detail, print, and CSV export.
![Payroll](screenshots/payroll.png)

### System

#### ⚙️ Admin
Master data tabs: Trades, Workers, Projects, Calendar, Users. When MMS is
connected, the panel shows the last sync and a **Sync from MMS** button.
![Admin](screenshots/admin.png)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Axios, react-select, Font Awesome, Inter + Noto Sans Thai |
| Backend | NestJS, TypeScript, Prisma ORM, PostgreSQL |
| Auth | JWT in an HTTP-only cookie (`access_token`, 8 hours), role guard on every endpoint |
| Repository | npm workspaces monorepo (`apps/api`, `apps/web`) |
| Integration | MMS master data sync (service token, scheduled + on demand) |

---

## Features

### Field Input (Foreman)
- **Daily log:** project, work date, and notes for the day
- **Manpower Hours table:** worker, trade, time in / time out per row. Add or
  remove rows freely. Workers show their MMS employee code, and choosing a
  worker fills in their trade
- **Live calculation:** ST, OT1, and OT2 hours per row and in total before
  submitting, using the same rules as the backend
- **Submit to PM:** the log goes to the Project Manager as Pending
- **My Recent Submissions:** status of each log (Pending / Approved /
  Rejected), the PM's rejection reason, and **Edit & Resubmit** for
  rejected logs

### Approvals (Project Manager)
- **Pending queue:** every submitted log waiting for review
- **Review window:** each line's hours and estimated cost. Lines without a
  pay rate are flagged
- **Approve / Reject:** a rejection requires a reason, which the Foreman sees
- **Recently Approved:** logs approved recently, for reference
- Handles conflicts when another PM has already acted on the same log

### Period Sign-off (Operations Director)
- **Standard periods** (1–15 and 16–end of month) or a **custom date range**
- **Period report:** hours and cost totals by project and worker for
  approved logs in the range
- **Warnings:** overlaps with periods that were already signed off, and logs
  still pending
- **Approve (Sign-off)** the whole period, or **Reject** it back to PMs with a
  reason
- **Sign-off history** with Load to reopen a past period
- Print-friendly A4 report

### Dashboard (Operations Director)
- Date presets: All time, This month, Last month, Last 3 months, This year
- KPIs: total labor cost, hours, overtime premium, and OT hours not yet
  priced
- Cost by project chart, hours distribution (ST / OT1 / OT2), and a job
  code table with share of cost

### Worker Contracts (Accounting)
- Pay rate per worker and trade with start and end dates
- **Needs a Pay Rate:** approved work that has no matching contract, with
  **Add Rate** prefilled from the first unpriced date
- Overlap warning when a new contract overlaps an existing one
- Search and show inactive contracts

### Payroll (Accounting)
- Only periods that Top Management has signed off can be reported
- Defaults to the latest signed-off period. Other periods are available as
  chips
- Summary by worker and line-by-line detail with project
- Print (A4) and CSV export (UTF-8 with BOM, opens correctly in Excel)

### Admin (Administrator)
- Tabs: **Trades**, **Workers**, **Projects**, **Calendar** (holidays and
  special days), **Users**
- Search and show inactive records. Deactivated records stay in history but
  no longer appear in selection lists
- **With MMS connected:** Trades, Workers, and Projects come from MMS. Add and
  activate / deactivate are hidden on those tabs, since the next sync would
  overwrite them. **Sync from MMS** pulls the latest data on demand
- **Without MMS:** Admin adds and deactivates records by hand
- Holidays turn all hours on that date into OT2
- The **Users** tab is a placeholder. User management has no backend
  endpoint yet

### System
- Role-based access: the sidebar and page guards show only the pages each
  role can use. The backend enforces the same roles
- Session expiry or a deactivated account signs the user out automatically
- Responsive layout with a collapsible sidebar on small screens

---

## Roles

| Role | Description |
|------|-------------|
| `FOREMAN` | Field Input and own submissions |
| `PM` | Approvals |
| `EXEC` | Dashboard and Period Sign-off |
| `ACCOUNTING` | Worker Contracts and Payroll |
| `ADMIN` | All pages plus Admin master data |

> Sidebar visibility and page access are defined in `apps/web/lib/nav.ts`.
> API enforcement uses `RolesGuard` in `apps/api`. The two must stay in sync.

---

## MMS Integration

MMS is the system of record for people, positions, and projects. PTA keeps
its own copy so saved timesheets and payroll always point to valid records,
and Field Input keeps working if MMS is unavailable.

```
MMS  GET /api/integration/pta/master-data   (Authorization: Bearer <service token>)
 │      positions · active employees (id, code, name, position) · active projects with an ON code
 ▼
PTA  MmsSyncService: 30 s after start, then every MMS_SYNC_INTERVAL_MINUTES,
     or Admin → Sync from MMS
```

| MMS | PTA | Matched by |
|-----|-----|------------|
| Position | Trade | `Trade.mmsPositionId` (an existing trade with the same name is linked) |
| Employee (active) | Worker | `Worker.mmsEmployeeId`; `empCode` is shown in lists |
| Employee position | Worker default trade | fills Position / Trade in Field Input |
| Project with an ON code | Project | project code (several MMS projects with one ON code become one PTA project) |

**Rules**

- Records not in the latest MMS data are **deactivated, never deleted**, so
  past timesheets and payroll still display
- Pay rates (`suggestedRate`, Worker Contracts) stay in PTA and are never
  changed by a sync
- Only names, codes, positions, and project codes cross over. No health,
  contact, or ID-card data
- A sync is skipped if MMS returns no employees or positions, so an MMS
  problem cannot deactivate everyone
- Every run is logged in `mms_sync_runs` (trigger, counts, error)
- Leaving `MMS_API_URL` / `MMS_SERVICE_TOKEN` unset turns the integration
  off; Admin then manages master data by hand

---

## Business Rules

**Hours**

- A shift longer than 5 hours has 1 hour deducted for lunch
- On a standard working day, the first 8 hours are **ST** and the rest are
  **OT1**
- On weekends and holidays, all hours are **OT2**
- Hours are rounded to 0.1

**Pay**

```
Pay = ST × rate + OT1 × rate × 1.5 + OT2 × rate × 2
```

- Each line is rounded to 2 decimal places
- The rate comes from an active contract for that worker that covers the
  work date. If several contracts match, the one with the latest start date
  wins
- Work without a matching contract shows as **not yet priced** until
  Accounting adds a rate

---

## Timesheet Workflow

```
Foreman creates a daily log (project, date, crew hours)
↓
Submit to PM → status: Pending
↓
PM reviews
├─ Approve → status: Approved
└─ Reject (with reason) → Foreman edits & resubmits → back to Pending
↓
Accounting adds pay rates for any unpriced work (Worker Contracts)
↓
Operations Director reviews the period report
├─ Approve (Sign-off) → period locked for payroll
└─ Reject (with reason) → logs return to PMs for review
↓
Accounting runs Payroll for the signed-off period → Print / CSV
```

---

## Project Structure

```
Personal-Timesheet-App/
├── apps/
│   ├── api/                         # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/                # login, logout, /auth/me, JWT strategy, RolesGuard
│   │   │   ├── admin/               # projects, trades, workers, calendar overrides (holidays)
│   │   │   ├── timesheet/           # submit, approve, reject, resubmit, ST/OT calculation
│   │   │   ├── worker-contract/     # pay rates by worker, trade, and date range
│   │   │   ├── payroll/             # preview, report, period sign-off / reject
│   │   │   ├── mms-sync/            # pull master data from MMS (scheduled + on demand)
│   │   │   ├── prisma/
│   │   │   └── main.ts
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       ├── seed.ts              # demo data for development only
│   │       └── create-user.ts       # create / reset one user from env vars
│   │
│   └── web/                         # Next.js frontend
│       ├── app/
│       │   ├── login/
│       │   ├── (app)/               # signed-in pages (shared layout and guard)
│       │   │   ├── field-input/
│       │   │   ├── approvals/
│       │   │   ├── dashboard/
│       │   │   ├── period-sign-off/
│       │   │   ├── worker-contracts/
│       │   │   ├── payroll/
│       │   │   └── admin/
│       │   ├── layout.tsx
│       │   ├── providers.tsx        # Auth + Toast providers
│       │   └── globals.css          # theme tokens and print rules
│       ├── components/              # Sidebar, AppHeader, Modal, SearchableSelect, page parts
│       └── lib/                     # api, auth-context, nav, types, rates, timesheet-calc, format
│
├── screenshots/
├── package.json                     # npm workspaces
└── package-lock.json
```

---

## API Endpoints

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Master data | `GET/POST /projects`, `/trades`, `/workers`, `PATCH /:resource/:id/active` |
| Holidays | `GET/POST /calendar-overrides`, `DELETE /calendar-overrides/:date` |
| Timesheets | `GET/POST /timesheets`, `PATCH /timesheets/:id/approve`, `/reject`, `/resubmit` |
| Contracts | `GET/POST /worker-contracts`, `PATCH /worker-contracts/:id/active` |
| Payroll | `GET /payroll/preview`, `GET /payroll/report`, `GET /payroll/period-approvals`, `POST /payroll/period-approvals/sign-off`, `POST /payroll/period-approvals/reject` |
| MMS sync | `GET /mms-sync/status`, `POST /mms-sync/run` (ADMIN) |

`GET /payroll/report` returns `403` unless the exact date range has been
signed off.

---

## Getting Started (Development)

### 1. Clone the repository

```bash
git clone https://github.com/ThnthrP/Personal-Timesheet-App.git
cd Personal-Timesheet-App
npm install
```

### 2. Set up environment files

Create `apps/api/.env` and `apps/web/.env.local` (see
[Environment Variables](#environment-variables)). Both files are
git-ignored.

### 3. Database

Start PostgreSQL, then run the migrations:

```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
npx prisma db seed     # optional: demo users and data, development only
```

### 4. Run the apps

```bash
# Terminal 1: backend
cd apps/api
npm run start:dev

# Terminal 2: frontend
cd apps/web
npm run dev
```

| App | URL |
|-----|-----|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:4101` |

> If a port is already in use (`EADDRINUSE`), stop the old process first.

---

## Production Deployment

Current setup: an internal Ubuntu server shared with MMS, reachable only
inside the company network.

| Part | How it runs |
|------|-------------|
| API | PM2 `pta-api` → `node --env-file=.env dist/main.js` on port 4101 |
| Web | PM2 `pta-web` → `next start -p 3000` |
| Nginx | `listen 8081`: `/api/` → 4101, `/` → 3000 (same origin, no CORS) |
| Firewall | port 8081 open to the company subnet only |
| Database | `pta_db` with its own `pta_user` (no access to the MMS database) |

**Update**

```bash
git pull origin main
npm ci                         # from the repo root

# Backend
cd apps/api
npx prisma migrate deploy      # only when schema.prisma changed
npx prisma generate
npm run build

# Frontend (NEXT_PUBLIC_API_URL is baked in at build time)
cd ../web
rm -rf .next
npm run build

sudo pm2 restart pta-api pta-web
```

- Do **not** run `prisma db seed` on a server. Create accounts with
  `create-user.ts` (password read from the environment, at least 12
  characters):
  ```bash
  cd apps/api
  read -s -p "Password: " USER_PASSWORD; echo
  USER_EMAIL=name@company.com USER_NAME="Full Name" USER_ROLE=FOREMAN \
    USER_PASSWORD="$USER_PASSWORD" npx ts-node prisma/create-user.ts
  unset USER_PASSWORD
  ```
- `package-lock.json` includes the Linux native packages for Tailwind
  (`@tailwindcss/oxide-linux-x64-gnu`, `lightningcss-linux-x64-gnu`). If a
  lockfile regenerated on Windows drops them, `npm run build` fails on Linux
  with "Cannot find native binding"
- With a domain and HTTPS, set `COOKIE_SECURE=true` (or remove it) and run
  nightly `pg_dump` backups to a separate disk

---

## Environment Variables

**`apps/api/.env`**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/pta_db
JWT_SECRET=your_jwt_secret          # openssl rand -hex 32, different from MMS
PORT=4101
NODE_ENV=production
CLIENT_URL=http://localhost:3000    # web origin allowed by CORS
COOKIE_SECURE=false                 # only while served over plain HTTP; unset = follow NODE_ENV

# MMS integration (unset = off)
MMS_API_URL=http://localhost:4100   # no /api suffix
MMS_SERVICE_TOKEN=                  # same value as PTA_SERVICE_TOKEN in the MMS .env
MMS_SYNC_INTERVAL_MINUTES=60        # 0 = sync only from the Admin page
```

**`apps/web/.env.local`** (development) / **`.env.production`** (server build)

```env
NEXT_PUBLIC_API_URL=http://localhost:4101
# server: NEXT_PUBLIC_API_URL=http://<server>:8081/api
```

> Never commit `.env` / `.env.local` files or test account passwords.

---

## User Manual

A Thai user manual for end users covers every page, the business rules,
and error messages:
[คู่มือการใช้งาน PTA](https://claude.ai/code/artifact/40a0dd53-5e45-44cf-ad34-b411f49f3a47)

---

## Not Yet Available

- User management (Admin → Users tab) and self-service password change
  (use `create-user.ts` for now)
- Domain + HTTPS (currently internal network only)
- Dispatch lock: limit Field Input to workers deployed on the chosen project
  in MMS
- Sending approved hours back to MMS (days worked, CV project history)
- Data migration from the Firebase prototype
