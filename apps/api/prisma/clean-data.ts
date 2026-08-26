import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { PrismaClient, Role } from '@prisma/client';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(currentDir, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning ALL test data (keeping only SUPER_ADMIN)...');

  await prisma.$transaction([
    prisma.examResult.deleteMany({}),
    prisma.exam.deleteMany({}),
    prisma.telegramNotificationLog.deleteMany({}),
    prisma.telegramLink.deleteMany({}),
    prisma.announcement.deleteMany({}),
    prisma.payment.deleteMany({}),
    prisma.ledgerEntry.deleteMany({}),
    prisma.attendance.deleteMany({}),
    prisma.groupStudent.deleteMany({}),
    prisma.studentStatusPeriod.deleteMany({}),
    prisma.lead.deleteMany({}),
    prisma.group.deleteMany({}),
    prisma.student.deleteMany({}),
    prisma.course.deleteMany({}),
    prisma.room.deleteMany({}),
    prisma.billingRun.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.refreshToken.deleteMany({}),
    // Delete all users except SUPER_ADMIN
    prisma.user.deleteMany({
      where: {
        role: { not: Role.SUPER_ADMIN },
      },
    }),
    prisma.teacher.deleteMany({}),
    prisma.studentCodeCounter.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', nextValue: 101 },
      update: { nextValue: 101 },
    }),
  ]);

  console.log('Successfully cleaned database! Only SUPER_ADMIN remains.');
}


main()
  .catch((e) => {
    console.error('Clean failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
