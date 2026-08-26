ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_amountUzs_positive"
    CHECK ("amountUzs" > 0),
  ADD CONSTRAINT "LedgerEntry_account_owner_valid"
    CHECK (
      ("accountType" = 'STUDENT' AND "studentId" IS NOT NULL AND "teacherId" IS NULL)
      OR ("accountType" = 'TEACHER' AND "teacherId" IS NOT NULL AND "studentId" IS NULL)
      OR ("accountType" = 'CENTER' AND "studentId" IS NULL AND "teacherId" IS NULL)
    ),
  ADD CONSTRAINT "LedgerEntry_not_self_reversal"
    CHECK ("reversalOfId" IS NULL OR "reversalOfId" <> "id");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amountUzs_positive"
    CHECK ("amountUzs" > 0);

ALTER TABLE "BillingRun"
  ADD CONSTRAINT "BillingRun_counts_nonnegative"
    CHECK ("processed" >= 0 AND "createdCount" >= 0 AND "skippedCount" >= 0),
  ADD CONSTRAINT "BillingRun_completion_valid"
    CHECK ("completedAt" IS NULL OR "completedAt" >= "startedAt");

ALTER TABLE "StudentStatusPeriod"
  ADD CONSTRAINT "StudentStatusPeriod_range_valid"
    CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt");

CREATE UNIQUE INDEX "StudentStatusPeriod_one_open_period"
  ON "StudentStatusPeriod" ("studentId")
  WHERE "endedAt" IS NULL;
