-- CreateEnum
CREATE TYPE "SpeakingSubmissionStatus" AS ENUM ('PENDING_AI', 'EVALUATED_BY_AI', 'GRADED_BY_TEACHER');

-- CreateTable
CREATE TABLE "SpeakingTopic" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "deadline" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeakingTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingSubmission" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "transcript" TEXT NOT NULL DEFAULT '',
    "aiFeedback" TEXT NOT NULL DEFAULT '',
    "aiScore" DOUBLE PRECISION,
    "teacherScore" DOUBLE PRECISION,
    "teacherComment" TEXT,
    "status" "SpeakingSubmissionStatus" NOT NULL DEFAULT 'PENDING_AI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeakingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeakingTopic_groupId_createdAt_idx" ON "SpeakingTopic"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "SpeakingTopic_teacherId_createdAt_idx" ON "SpeakingTopic"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "SpeakingSubmission_topicId_createdAt_idx" ON "SpeakingSubmission"("topicId", "createdAt");

-- CreateIndex
CREATE INDEX "SpeakingSubmission_studentId_createdAt_idx" ON "SpeakingSubmission"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "SpeakingSubmission_status_idx" ON "SpeakingSubmission"("status");

-- AddForeignKey
ALTER TABLE "SpeakingTopic" ADD CONSTRAINT "SpeakingTopic_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingTopic" ADD CONSTRAINT "SpeakingTopic_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingSubmission" ADD CONSTRAINT "SpeakingSubmission_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SpeakingTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingSubmission" ADD CONSTRAINT "SpeakingSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
