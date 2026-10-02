-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('STANDARD', 'WEEKEND', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "suggestedRate" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultTradeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_contracts" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_overrides" (
    "date" DATE NOT NULL,
    "type" "DayType" NOT NULL,
    "label" TEXT,

    CONSTRAINT "calendar_overrides_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "foremanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobCode" TEXT,
    "date" DATE NOT NULL,
    "dayType" "DayType" NOT NULL,
    "notes" TEXT,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "returnedById" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_entries" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "st" DOUBLE PRECISION NOT NULL,
    "ot1" DOUBLE PRECISION NOT NULL,
    "ot2" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_approvals" (
    "id" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "totalST" DOUBLE PRECISION NOT NULL,
    "totalOT1" DOUBLE PRECISION NOT NULL,
    "totalOT2" DOUBLE PRECISION NOT NULL,
    "unpricedHours" DOUBLE PRECISION NOT NULL,
    "workerCount" INTEGER NOT NULL,
    "timesheetCount" INTEGER NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "period_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "trades_name_key" ON "trades"("name");

-- CreateIndex
CREATE INDEX "worker_contracts_workerId_tradeId_startDate_endDate_idx" ON "worker_contracts"("workerId", "tradeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "timesheets_status_idx" ON "timesheets"("status");

-- CreateIndex
CREATE INDEX "timesheets_date_idx" ON "timesheets"("date");

-- CreateIndex
CREATE INDEX "timesheet_entries_workerId_tradeId_idx" ON "timesheet_entries"("workerId", "tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "period_approvals_periodStart_periodEnd_key" ON "period_approvals"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_defaultTradeId_fkey" FOREIGN KEY ("defaultTradeId") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_contracts" ADD CONSTRAINT "worker_contracts_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_contracts" ADD CONSTRAINT "worker_contracts_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_approvals" ADD CONSTRAINT "period_approvals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
