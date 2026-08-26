import { config } from 'dotenv';
import path from 'node:path';
config({ path: path.resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning ALL data (courses, rooms, students, groups, attendance, leads, payments)...');

  await prisma.$transaction([
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
    // Delete all users except main admin
    prisma.user.deleteMany({
      where: {
        login: { not: 'admin' },
      },
    }),
    prisma.teacher.deleteMany({}),
    prisma.studentCodeCounter.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', nextValue: 101 },
      update: { nextValue: 101 },
    }),
  ]);

  console.log('Successfully cleaned ALL courses, rooms, students, groups, leads and payments!');
}

main()
  .catch((e) => {
    console.error('Clean failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
