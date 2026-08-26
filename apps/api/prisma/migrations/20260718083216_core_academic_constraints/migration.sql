-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "lessonDurationMinutes" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "StudentCodeCounter" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nextValue" INTEGER NOT NULL DEFAULT 101,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCodeCounter_pkey" PRIMARY KEY ("id")
);

-- Domain constraints
ALTER TABLE "Course"
  ADD CONSTRAINT "Course_durationMonths_check"
    CHECK ("durationMonths" BETWEEN 1 AND 36),
  ADD CONSTRAINT "Course_pricePerMonthUzs_check"
    CHECK ("pricePerMonthUzs" >= 0);

ALTER TABLE "Teacher"
  ADD CONSTRAINT "Teacher_fixedSalaryUzs_check"
    CHECK ("fixedSalaryUzs" IS NULL OR "fixedSalaryUzs" >= 0),
  ADD CONSTRAINT "Teacher_perStudentRateUzs_check"
    CHECK ("perStudentRateUzs" IS NULL OR "perStudentRateUzs" >= 0),
  ADD CONSTRAINT "Teacher_kpiRateBasisPoints_check"
    CHECK ("kpiRateBasisPoints" IS NULL OR "kpiRateBasisPoints" BETWEEN 0 AND 10000);

ALTER TABLE "Group"
  ADD CONSTRAINT "Group_lessonStartMinutes_check"
    CHECK ("lessonStartMinutes" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "Group_lessonDurationMinutes_check"
    CHECK ("lessonDurationMinutes" IN (60, 90, 120, 150, 180)),
  ADD CONSTRAINT "Group_lessonEnd_check"
    CHECK ("lessonStartMinutes" + "lessonDurationMinutes" <= 1440);

ALTER TABLE "StudentCodeCounter"
  ADD CONSTRAINT "StudentCodeCounter_nextValue_check"
    CHECK ("nextValue" >= 101);

-- Business uniqueness
CREATE UNIQUE INDEX "Course_title_lower_key" ON "Course" (LOWER("title"));
CREATE UNIQUE INDEX "Room_name_lower_key" ON "Room" (LOWER("name"));
CREATE UNIQUE INDEX "GroupStudent_active_key"
  ON "GroupStudent" ("groupId", "studentId")
  WHERE "status" = 'ACTIVE';
