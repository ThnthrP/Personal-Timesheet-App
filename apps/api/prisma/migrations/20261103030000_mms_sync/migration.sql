-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "fromMms" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "trades" ADD COLUMN     "mmsPositionId" TEXT;

-- AlterTable
ALTER TABLE "workers" ADD COLUMN     "empCode" TEXT,
ADD COLUMN     "mmsEmployeeId" TEXT;

-- CreateTable
CREATE TABLE "mms_sync_runs" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "summary" JSONB,
    "error" TEXT,

    CONSTRAINT "mms_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mms_sync_runs_startedAt_idx" ON "mms_sync_runs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "trades_mmsPositionId_key" ON "trades"("mmsPositionId");

-- CreateIndex
CREATE UNIQUE INDEX "workers_mmsEmployeeId_key" ON "workers"("mmsEmployeeId");
