-- CreateEnum for announcement targeting
CREATE TYPE "AnnouncementTargetType" AS ENUM ('ALL', 'GROUP', 'COURSE');
CREATE TYPE "AnnouncementDeliveryStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'QUEUED', 'BOT_DELIVERED', 'FAILED');

-- Deduplicate notification jobs by deterministic jobId
CREATE UNIQUE INDEX "TelegramNotificationLog_jobId_key" ON "TelegramNotificationLog"("jobId");

-- Announcements journal
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "targetType" "AnnouncementTargetType" NOT NULL,
    "targetId" TEXT,
    "targetName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deliveryStatus" "AnnouncementDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
