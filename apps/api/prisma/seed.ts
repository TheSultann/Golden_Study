import {
  BillingMode,
  GroupStatus,
  GroupStudentStatus,
  PrismaClient,
  Role,
  SalaryType,
  StudentStatus,
  Weekday,
} from '@prisma/client';
import { hash } from 'bcryptjs';

import { env } from '../src/config/env.js';

const prisma = new PrismaClient();
const joinedAt = new Date('2026-01-05T00:00:00.000Z');

async function main(): Promise<void> {
  const [superAdminHash, adminHash, teacherHash] = await Promise.all([
    hash(env.SEED_SUPER_ADMIN_PASSWORD, env.BCRYPT_COST),
    hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_COST),
    hash(env.SEED_TEACHER_PASSWORD, env.BCRYPT_COST),
  ]);

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {
      centerName: 'Golden Study',
      timezone: 'Asia/Tashkent',
    },
    create: {
      id: 'singleton',
      centerName: 'Golden Study',
      billingMode: BillingMode.DAILY,
      timezone: 'Asia/Tashkent',
    },
  });

  const teacher = await prisma.teacher.upsert({
    where: { id: '20000000-0000-4000-8000-000000000001' },
    update: {
      firstName: 'Alisher',
      lastName: 'Karimov',
      phone: '+998901234567',
      isActive: true,
    },
    create: {
      id: '20000000-0000-4000-8000-000000000001',
      firstName: 'Alisher',
      lastName: 'Karimov',
      phone: '+998901234567',
      salaryType: SalaryType.PERCENT,
      kpiRateBasisPoints: 8_000,
    },
  });

  await Promise.all([
    upsertUser('superadmin', superAdminHash, Role.SUPER_ADMIN, null),
    upsertUser('admin', adminHash, Role.ADMIN, null),
    upsertUser('teacher', teacherHash, Role.TEACHER, teacher.id),
  ]);

  const courseInputs = [
    ['30000000-0000-4000-8000-000000000001', 'Ingliz tili', 6, 600_000],
    ['30000000-0000-4000-8000-000000000002', 'Matematika', 9, 500_000],
    ['30000000-0000-4000-8000-000000000003', 'Kimyo', 6, 550_000],
  ] as const;

  for (const [id, title, durationMonths, pricePerMonthUzs] of courseInputs) {
    await prisma.course.upsert({
      where: { id },
      update: { title, durationMonths, pricePerMonthUzs, isActive: true },
      create: { id, title, durationMonths, pricePerMonthUzs },
    });
  }

  for (let index = 1; index <= 4; index += 1) {
    const id = `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
    await prisma.room.upsert({
      where: { id },
      update: { name: `${index}-xona`, isActive: true },
      create: { id, name: `${index}-xona` },
    });
  }

  const groupInputs = [
    {
      id: '50000000-0000-4000-8000-000000000001',
      name: 'English A1',
      courseId: courseInputs[0][0]!,
      roomId: '40000000-0000-4000-8000-000000000001',
      weekdays: [Weekday.MON, Weekday.WED, Weekday.FRI],
      lessonStartMinutes: 1_080,
      startDate: new Date('2026-01-05T00:00:00.000Z'),
      endDate: new Date('2026-04-05T00:00:00.000Z'),
    },
    {
      id: '50000000-0000-4000-8000-000000000002',
      name: 'Matematika M1',
      courseId: courseInputs[1][0]!,
      roomId: '40000000-0000-4000-8000-000000000002',
      weekdays: [Weekday.TUE, Weekday.THU, Weekday.SAT],
      lessonStartMinutes: 960,
      startDate: new Date('2026-01-05T00:00:00.000Z'),
      endDate: new Date('2026-07-05T00:00:00.000Z'),
    },
  ];

  for (const group of groupInputs) {
    await prisma.group.upsert({
      where: { id: group.id },
      update: {
        ...group,
        teacherId: teacher.id,
        status: GroupStatus.ACTIVE,
      },
      create: {
        ...group,
        teacherId: teacher.id,
        status: GroupStatus.ACTIVE,
      },
    });
  }
}

function upsertUser(
  login: string,
  passwordHash: string,
  role: Role,
  teacherId: string | null,
) {
  return prisma.user.upsert({
    where: { login },
    update: { passwordHash, role, teacherId, isActive: true },
    create: { login, passwordHash, role, teacherId },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
