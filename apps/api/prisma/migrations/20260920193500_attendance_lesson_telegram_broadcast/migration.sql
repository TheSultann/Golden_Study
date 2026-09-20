-- AlterEnum
ALTER TYPE "TelegramTriggerType" ADD VALUE 'LESSON_BROADCAST';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "telegramChatTitle" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "homeworkScore" INTEGER,
ADD COLUMN "topicScore" INTEGER,
ADD COLUMN "dictionaryScore" INTEGER;

-- CreateTable
CREATE TABLE "GroupLesson" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "homeworkText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Group_telegramChatId_idx" ON "Group"("telegramChatId");

-- CreateIndex
CREATE INDEX "GroupLesson_groupId_date_idx" ON "GroupLesson"("groupId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GroupLesson_groupId_date_key" ON "GroupLesson"("groupId", "date");

-- AddForeignKey
ALTER TABLE "GroupLesson" ADD CONSTRAINT "GroupLesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
