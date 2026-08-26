-- Backfill: register telegram & exam objects that exist in the live database
-- but were missing from migration history (applied earlier via db push).

CREATE TYPE "TelegramLinkStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
CREATE TYPE "TelegramTriggerType" AS ENUM ('ATTENDANCE_ABSENT', 'HOMEWORK_MISSING', 'EXAM_RESULT', 'PAYMENT_RECEIVED', 'DEBT_REMINDER', 'ANNOUNCEMENT');
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "rank" INTEGER NOT NULL,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "status" "TelegramLinkStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramNotificationLog" (
    "id" TEXT NOT NULL,
    "telegramLinkId" TEXT NOT NULL,
    "triggerType" "TelegramTriggerType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" TEXT NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "jobId" TEXT NOT NULL,

    CONSTRAINT "TelegramNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Exam_groupId_date_idx" ON "Exam"("groupId", "date");
CREATE INDEX "ExamResult_studentId_idx" ON "ExamResult"("studentId");
CREATE UNIQUE INDEX "ExamResult_examId_studentId_key" ON "ExamResult"("examId", "studentId");
CREATE INDEX "TelegramLink_studentId_idx" ON "TelegramLink"("studentId");
CREATE INDEX "TelegramLink_status_idx" ON "TelegramLink"("status");
CREATE INDEX "TelegramLink_telegramChatId_idx" ON "TelegramLink"("telegramChatId");
CREATE INDEX "TelegramNotificationLog_telegramLinkId_idx" ON "TelegramNotificationLog"("telegramLinkId");
CREATE INDEX "TelegramNotificationLog_status_idx" ON "TelegramNotificationLog"("status");

ALTER TABLE "Exam" ADD CONSTRAINT "Exam_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramNotificationLog" ADD CONSTRAINT "TelegramNotificationLog_telegramLinkId_fkey" FOREIGN KEY ("telegramLinkId") REFERENCES "TelegramLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;