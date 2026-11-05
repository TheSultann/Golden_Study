import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetExamId = process.argv[2] || 'e-1793871021149';
  console.log(`[backfill] Checking exam: ${targetExamId}`);

  const exam = await prisma.exam.findUnique({
    where: { id: targetExamId },
    include: {
      group: true,
      results: {
        include: {
          student: true,
        },
      },
    },
  });

  if (!exam) {
    console.error(`[backfill] Error: Exam with ID "${targetExamId}" not found in database.`);
    process.exit(1);
  }

  console.log(
    `[backfill] Found exam "${exam.name}" for group "${exam.group.name}" (ID: ${exam.groupId}).`,
  );
  console.log(`[backfill] Current results count: ${exam.results.length}`);

  // Fetch all active students in this group
  const activeMemberships = await prisma.groupStudent.findMany({
    where: {
      groupId: exam.groupId,
      status: 'ACTIVE',
      student: { status: 'ACTIVE' },
    },
    include: {
      student: true,
    },
    orderBy: [
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
    ],
  });

  console.log(
    `[backfill] Total active students in group "${exam.group.name}": ${activeMemberships.length}`,
  );

  const existingStudentIds = new Set(exam.results.map((r) => r.studentId));
  const seenMemberIds = new Set<string>();
  const uniqueActiveMemberships = [];
  for (const member of activeMemberships) {
    if (!seenMemberIds.has(member.studentId)) {
      seenMemberIds.add(member.studentId);
      uniqueActiveMemberships.push(member);
    }
  }

  const missing = uniqueActiveMemberships.filter(
    (m) => !existingStudentIds.has(m.studentId),
  );

  if (missing.length === 0) {
    console.log('[backfill] All active group students are already present in this exam. Nothing to do.');
    return;
  }

  console.log(`[backfill] Found ${missing.length} missing students to add.`);

  const maxRank = exam.results.reduce((max, r) => Math.max(max, r.rank), 0);

  await prisma.$transaction(
    missing.map((member, index) =>
      prisma.examResult.create({
        data: {
          examId: exam.id,
          studentId: member.studentId,
          score: 0,
          comment: '',
          rank: maxRank + index + 1,
        },
      }),
    ),
  );

  for (const member of missing) {
    console.log(
      `  + Added: ${member.student.firstName} ${member.student.lastName} (${member.student.studentCode})`,
    );
  }

  const finalCount = await prisma.examResult.count({
    where: { examId: exam.id },
  });

  console.log(
    `[backfill] Successfully backfilled ${missing.length} students. Exam now has ${finalCount} total results.`,
  );
}

main()
  .catch((err) => {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
