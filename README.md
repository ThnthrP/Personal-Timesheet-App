# Personal Timesheet App (PTA)

A web-based daily timesheet and labor-cost platform for construction field
work. Foremen log crew hours each day. Project Managers review and approve
them. Top Management signs off each pay period. Accounting turns approved
hours into payroll using each worker's contract rate.

PTA replaces the earlier Firebase prototype with a NestJS + PostgreSQL
backend and a Next.js frontend. It keeps the prototype's look and workflow.

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
![Field Input](screenshots/field-input.png)

#### 🗂 My Recent Submissions
Submission history with status, rejection reason, and Edit & Resubmit.
![Submissions](screenshots/submissions.png)

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
Master data tabs: Projects, Trades, Workers, Holidays, Users.
![Admin](screenshots/admin.png)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Axios, react-select, Font Awesome, Inter + Noto Sans Thai |
| Backend | NestJS, TypeScript, Prisma ORM, PostgreSQL |
| Auth | JWT in an HTTP-only cookie (`access_token`, 8 hours), role guard on every endpoint |
| Repository | npm workspaces monorepo (`apps/api`, `apps/web`) |

---

## Features

### Field Input (Foreman)
- **Daily log:** project, work date, and notes for the day
- **Manpower Hours table:** worker, trade, time in / time out per row. Add or
  remove rows freely
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
- Tabs: **Projects**, **Trades**, **Workers**, **Holidays** (calendar
  overrides), **Users**
- Add, search, and activate / deactivate records. Deactivated records stay
  in history but no longer appear in selection lists
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
│   │   │   ├── projects/
│   │   │   ├── trades/
│   │   │   ├── workers/
│   │   │   ├── calendar-overrides/  # holidays / special days
│   │   │   ├── timesheets/          # submit, approve, reject, resubmit, ST/OT calculation
│   │   │   ├── worker-contracts/    # pay rates by worker, trade, and date range
│   │   │   ├── payroll/             # preview, report, period sign-off / reject
│   │   │   ├── prisma/
│   │   │   └── main.ts
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
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

Requirements:

- Ubuntu 24.04 server with Docker
- A domain name with **HTTPS**. The auth cookie is `secure` in production,
  so the browser will not send it over plain HTTP
- Nightly `pg_dump` backups to a separate disk

```bash
git pull origin main

# Backend
cd apps/api
npm install
npx prisma migrate deploy
npx prisma generate
npm run build

# Frontend
cd ../web
npm install
npm run build
```

Skip `migrate deploy` / `generate` when `schema.prisma` has not changed.

---

## Environment Variables

**`apps/api/.env`**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/pta_db
JWT_SECRET=your_jwt_secret
PORT=4101
```

**`apps/web/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:4101
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
- Production server deployment (domain + HTTPS)
- Data migration from the Firebase prototype
