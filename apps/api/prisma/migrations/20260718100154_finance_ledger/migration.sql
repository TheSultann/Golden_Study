-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('STUDENT', 'TEACHER', 'CENTER');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM ('STUDENT_PAYMENT', 'DAILY_LESSON_CHARGE', 'MONTHLY_TUITION_CHARGE', 'KPI_PERCENT_ACCRUAL', 'KPI_PER_STUDENT_ACCRUAL', 'KPI_FIXED_ACCRUAL', 'TEACHER_PAYOUT', 'MANUAL_INCOME', 'MANUAL_EXPENSE', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM ('ATTENDANCE', 'MONTHLY_BILLING', 'PAYMENT', 'KPI', 'PAYOUT', 'MANUAL', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CLICK', 'PAYME', 'TERMINAL', 'BANK');

-- CreateEnum
CREATE TYPE "BillingRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "accountType" "LedgerAccountType" NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "direction" "LedgerDirection" NOT NULL,
    "category" "LedgerCategory" NOT NULL,
    "amountUzs" INTEGER NOT NULL,
    "operationKey" TEXT NOT NULL,
    "sourceType" "LedgerSourceType" NOT NULL,
    "sourceId" TEXT,
    "reversalOfId" TEXT,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT,
    "amountUzs" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "ledgerEntryId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRun" (
    "id" TEXT NOT NULL,
    "mode" "BillingMode" NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" "BillingRunStatus" NOT NULL DEFAULT 'RUNNING',
    "processed" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BillingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStatusPeriod" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "StudentStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStatusPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_operationKey_key" ON "LedgerEntry"("operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_reversalOfId_key" ON "LedgerEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "LedgerEntry_studentId_createdAt_idx" ON "LedgerEntry"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_teacherId_createdAt_idx" ON "LedgerEntry"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountType_direction_createdAt_idx" ON "LedgerEntry"("accountType", "direction", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_sourceType_sourceId_idx" ON "LedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_ledgerEntryId_key" ON "Payment"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "Payment_studentId_createdAt_idx" ON "Payment"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_groupId_createdAt_idx" ON "Payment"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingRun_status_startedAt_idx" ON "BillingRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRun_mode_periodKey_key" ON "BillingRun"("mode", "periodKey");

-- CreateIndex
CREATE INDEX "StudentStatusPeriod_studentId_startedAt_idx" ON "StudentStatusPeriod"("studentId", "startedAt");

-- CreateIndex
CREATE INDEX "StudentStatusPeriod_studentId_status_endedAt_idx" ON "StudentStatusPeriod"("studentId", "status", "endedAt");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStatusPeriod" ADD CONSTRAINT "StudentStatusPeriod_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
