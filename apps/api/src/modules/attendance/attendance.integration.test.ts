import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

interface AttendanceRowPayload {
  studentId: string;
  rating?: number | null;
  homeworkScore?: number | null;
  topicScore?: number | null;
  dictionaryScore?: number | null;
  homeworkDone?: boolean;
}

interface AttendanceSessionPayload {
  homeworkText: string;
  rows: AttendanceRowPayload[];
}

interface ApiDataResponse<T> {
  success: boolean;
  data: T;
}

const prefix = 'Attendance Integration';
const adminId = '74000000-0000-4000-8000-000000000001';
let adminToken = '';
let teacherToken = '';
let groupId = '';
let studentId = '';
let attendanceId = '';

describe('Attendance API', () => {
  beforeAll(async () => {
    await cleanupAttendanceFixtures();
    const admin = await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: 'attendance-integration-admin',
        passwordHash: await hashPassword('password123'),
        role: 'SUPER_ADMIN',
      },
    });
    const course = await prisma.course.create({
      data: {
        title: `${prefix} Course`,
        durationMonths: 6,
        pricePerMonthUzs: 500000,
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Attendance',
        lastName: 'Teacher',
        phone: '+998900005001',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    const teacherUser = await prisma.user.create({
      data: {
        login: 'attendance-integration-teacher',
        passwordHash: await hashPassword('password123'),
        role: 'TEACHER',
        teacherId: teacher.id,
      },
    });
    const group = await prisma.group.create({
      data: {
        name: `${prefix} Group`,
        courseId: course.id,
        teacherId: teacher.id,
        weekdays: ['WED'],
        lessonStartMinutes: 600,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-07-31'),
      },
    });
    const student = await prisma.student.create({
      data: {
        studentCode: `STA${Date.now()}`,
        firstName: `${prefix} Student`,
        lastName: 'One',
        groups: {
          create: {
            groupId: group.id,
            joinedAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        },
      },
    });
    groupId = group.id;
    studentId = student.id;
    adminToken = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
    teacherToken = createAccessToken({
      id: teacherUser.id,
      login: teacherUser.login,
      role: 'TEACHER',
      teacherId: teacher.id,
    });
  });

  afterAll(cleanupAttendanceFixtures);

  it('loads session students active on selected date', async () => {
    const response = await teacher(
      request(createApp()).get(
        `/api/v1/attendance/group/${groupId}/date/2026-07-08`,
      ),
    );
    expect(response.status).toBe(200);
    expect(
      (response.body as { data: { rows: Array<{ studentId: string }> } }).data
        .rows,
    ).toContainEqual(expect.objectContaining({ studentId }));
  });

  it('upserts once, admin locks row and teacher cannot overwrite it', async () => {
    const teacherSave = await teacher(
      request(createApp()).post('/api/v1/attendance'),
    ).send(session('CAME', 5));
    expect(teacherSave.status).toBe(200);
    attendanceId = (
      teacherSave.body as { data: { rows: Array<{ id: string }> } }
    ).data.rows[0]!.id;

    const adminSave = await admin(
      request(createApp()).post('/api/v1/attendance'),
    ).send(session('ABSENT', null));
    expect(adminSave.status).toBe(200);
    expect(
      (
        adminSave.body as {
          data: { rows: Array<{ lockedByAdmin: boolean }> };
        }
      ).data.rows[0]!.lockedByAdmin,
    ).toBe(true);
    expect(
      await prisma.attendance.count({
        where: { groupId, studentId, date: new Date('2026-07-08') },
      }),
    ).toBe(1);

    expect(
      (
        await teacher(
          request(createApp()).post('/api/v1/attendance'),
        ).send(session('CAME', 4))
      ).status,
    ).toBe(403);
  });

  it('allows admin correction and soft reversal', async () => {
    const corrected = await admin(
      request(createApp()).patch(`/api/v1/attendance/${attendanceId}`),
    ).send({
      status: 'EXCUSED',
      rating: null,
      homeworkDone: false,
      comment: 'Medical reason',
    });
    expect(corrected.status).toBe(200);
    expect(
      (corrected.body as { data: { status: string } }).data.status,
    ).toBe('EXCUSED');

    expect(
      (
        await admin(
          request(createApp()).delete(`/api/v1/attendance/${attendanceId}`),
        )
      ).status,
    ).toBe(204);
    expect(
      await prisma.attendance.findUnique({ where: { id: attendanceId } }),
    ).toMatchObject({ isReversed: true, reversedByUserId: adminId });
  });

  it('returns student attendance history with teacher ownership', async () => {
    const history = await teacher(
      request(createApp()).get(`/api/v1/students/${studentId}/attendance`),
    );
    expect(history.status).toBe(200);
    expect((history.body as { meta: { total: number } }).meta.total).toBe(1);
  });

  it('saves and returns GroupLesson homeworkText and computes rating from scores', async () => {
    const saveRes = await admin(
      request(createApp()).post('/api/v1/attendance'),
    ).send({
      groupId,
      date: '2026-07-09',
      homeworkText: 'Unit 5 mashqlari va yangi 20 ta so‘z',
      items: [
        {
          studentId,
          status: 'CAME',
          homeworkScore: 80,
          topicScore: 90,
          dictionaryScore: 100,
          homeworkDone: true,
          comment: 'Yaxshi qatnashdi',
        },
      ],
    });
    expect(saveRes.status).toBe(200);
    const saveBody = saveRes.body as ApiDataResponse<AttendanceSessionPayload>;
    expect(saveBody.data.homeworkText).toBe('Unit 5 mashqlari va yangi 20 ta so‘z');
    const savedRow = saveBody.data.rows[0];
    expect(savedRow?.rating).toBe(90); // Math.round((80 + 90 + 100) / 3)
    expect(savedRow?.homeworkScore).toBe(80);
    expect(savedRow?.topicScore).toBe(90);
    expect(savedRow?.dictionaryScore).toBe(100);
    expect(savedRow?.homeworkDone).toBe(true);

    // Get session verifies homeworkText and scores
    const sessionRes = await admin(
      request(createApp()).get(`/api/v1/attendance/group/${groupId}/date/2026-07-09`),
    );
    expect(sessionRes.status).toBe(200);
    const sessionBody = sessionRes.body as ApiDataResponse<AttendanceSessionPayload>;
    expect(sessionBody.data.homeworkText).toBe('Unit 5 mashqlari va yangi 20 ta so‘z');
    const sessionRow = sessionBody.data.rows.find((r) => r.studentId === studentId);
    expect(sessionRow?.rating).toBe(90);
    expect(sessionRow?.homeworkScore).toBe(80);
    expect(sessionRow?.topicScore).toBe(90);
    expect(sessionRow?.dictionaryScore).toBe(100);
  });

  it('allows teacher to save attendance via PUT /teachers/me/attendance and returns computed rating', async () => {
    const putRes = await teacher(
      request(createApp()).put('/api/v1/teachers/me/attendance'),
    ).send({
      groupId,
      groupName: `${prefix} Group`,
      date: '2026-07-15',
      homeworkText: 'Keyingi darsga 5 ta yangi mavzu',
      rows: [
        {
          studentId,
          studentCode: 'ST1',
          studentName: `${prefix} Student One`,
          status: 'came',
          rating: 0,
          homeworkScore: 70,
          topicScore: 80,
          dictionaryScore: 90,
          homeworkDone: false,
          comment: 'Faol',
          lockedByAdmin: false,
        },
      ],
    });
    expect(putRes.status).toBe(200);
    const body = (putRes.body as ApiDataResponse<AttendanceSessionPayload>).data;
    expect(body.homeworkText).toBe('Keyingi darsga 5 ta yangi mavzu');
    const firstRow = body.rows[0];
    expect(firstRow?.rating).toBe(80); // Math.round((70 + 80 + 90) / 3)
    expect(firstRow?.homeworkScore).toBe(70);
    expect(firstRow?.topicScore).toBe(80);
    expect(firstRow?.dictionaryScore).toBe(90);
    expect(firstRow?.homeworkDone).toBe(true);

    // Verify GET /teachers/me/attendance returns the same computed scores and homeworkText
    const getRes = await teacher(
      request(createApp()).get(`/api/v1/teachers/me/attendance?groupId=${groupId}&date=2026-07-15`),
    );
    expect(getRes.status).toBe(200);
    const getData = (getRes.body as ApiDataResponse<AttendanceSessionPayload>).data;
    expect(getData.homeworkText).toBe('Keyingi darsga 5 ta yangi mavzu');
    const getFirstRow = getData.rows[0];
    expect(getFirstRow?.rating).toBe(80);
    expect(getFirstRow?.homeworkScore).toBe(70);
    expect(getFirstRow?.topicScore).toBe(80);
    expect(getFirstRow?.dictionaryScore).toBe(90);
  });

  it('computes smart average rating skipping null scores on both admin and teacher endpoints', async () => {
    // 1. Admin saves attendance with only topicScore = 95
    const adminSave = await admin(
      request(createApp()).post('/api/v1/attendance'),
    ).send({
      groupId,
      date: '2026-07-17',
      homeworkText: 'Yangi mavzu vazifalari',
      items: [
        {
          studentId,
          status: 'CAME',
          topicScore: 95,
          homeworkScore: null,
          dictionaryScore: null,
          homeworkDone: false,
          comment: 'Faqat dars baholandi',
        },
      ],
    });
    expect(adminSave.status).toBe(200);
    const adminRow = (adminSave.body as ApiDataResponse<AttendanceSessionPayload>).data.rows[0];
    expect(adminRow?.rating).toBe(95); // Must be 95, NOT Math.round((0 + 95 + 0) / 3) = 32
    expect(adminRow?.topicScore).toBe(95);
    expect(adminRow?.homeworkScore).toBeNull();
    expect(adminRow?.dictionaryScore).toBeNull();

    // 2. Teacher saves attendance with homeworkScore = 80 and topicScore = 90 (dictionary null)
    const teacherPut = await teacher(
      request(createApp()).put('/api/v1/teachers/me/attendance'),
    ).send({
      groupId,
      groupName: `${prefix} Group`,
      date: '2026-07-18',
      homeworkText: '',
      rows: [
        {
          studentId,
          studentCode: 'ST1',
          studentName: `${prefix} Student One`,
          status: 'came',
          homeworkScore: 80,
          topicScore: 90,
          dictionaryScore: null,
          homeworkDone: true,
          comment: 'Lug‘at berilmadi',
          lockedByAdmin: false,
        },
      ],
    });
    expect(teacherPut.status).toBe(200);
    const teacherRow = (teacherPut.body as ApiDataResponse<AttendanceSessionPayload>).data.rows[0];
    expect(teacherRow?.rating).toBe(85); // Math.round((80 + 90) / 2) = 85, NOT 57
    expect(teacherRow?.homeworkScore).toBe(80);
    expect(teacherRow?.topicScore).toBe(90);
    expect(teacherRow?.dictionaryScore).toBeNull();
  });

  it('preserves historical rating across score fields when homeworkScore is null in DB', async () => {
    // Manually create a legacy record with rating but null specific scores
    await prisma.attendance.upsert({
      where: {
        groupId_studentId_date: {
          groupId,
          studentId,
          date: new Date('2026-07-16T00:00:00.000Z'),
        },
      },
      create: {
        groupId,
        studentId,
        date: new Date('2026-07-16T00:00:00.000Z'),
        status: 'CAME',
        rating: 88,
        homeworkScore: null,
        topicScore: null,
        dictionaryScore: null,
        homeworkDone: true,
        createdByUserId: adminId,
      },
      update: {
        status: 'CAME',
        rating: 88,
        homeworkScore: null,
        topicScore: null,
        dictionaryScore: null,
      },
    });

    const sessionRes = await admin(
      request(createApp()).get(`/api/v1/attendance/group/${groupId}/date/2026-07-16`),
    );
    expect(sessionRes.status).toBe(200);
    const sessionData = (sessionRes.body as ApiDataResponse<AttendanceSessionPayload>).data;
    const row = sessionData.rows.find((r) => r.studentId === studentId);
    expect(row?.rating).toBe(88);
    expect(row?.homeworkScore).toBe(88);
    expect(row?.topicScore).toBe(88);
    expect(row?.dictionaryScore).toBe(88);

    const teacherRes = await teacher(
      request(createApp()).get(`/api/v1/teachers/me/attendance?groupId=${groupId}&date=2026-07-16`),
    );
    expect(teacherRes.status).toBe(200);
    const teacherData = (teacherRes.body as ApiDataResponse<AttendanceSessionPayload>).data;
    const teacherRow = teacherData.rows.find((r) => r.studentId === studentId);
    expect(teacherRow?.rating).toBe(88);
    expect(teacherRow?.homeworkScore).toBe(88);
    expect(teacherRow?.topicScore).toBe(88);
    expect(teacherRow?.dictionaryScore).toBe(88);
  });
});

async function cleanupAttendanceFixtures() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: adminId },
        { login: { startsWith: 'attendance-integration-' } },
      ],
    },
    select: { id: true },
  });
  const students = await prisma.student.findMany({
    where: { firstName: { startsWith: prefix } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const studentIds = students.map(({ id }) => id);
  await prisma.auditLog.deleteMany({
    where: { actorUserId: { in: userIds } },
  });
  await prisma.payment.deleteMany({
    where: { studentId: { in: studentIds } },
  });
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      OR: [
        { createdByUserId: { in: userIds } },
        { studentId: { in: studentIds } },
      ],
    },
    select: { id: true },
  });
  const entryIds = entries.map(({ id }) => id);
  await prisma.ledgerEntry.deleteMany({
    where: { reversalOfId: { in: entryIds } },
  });
  await prisma.ledgerEntry.deleteMany({ where: { id: { in: entryIds } } });
  await prisma.attendance.deleteMany({
    where: { group: { name: { startsWith: prefix } } },
  });
  await prisma.groupStudent.deleteMany({
    where: { group: { name: { startsWith: prefix } } },
  });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.group.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.teacher.deleteMany({
    where: { phone: { startsWith: '+998900005' } },
  });
  await prisma.course.deleteMany({ where: { title: { startsWith: prefix } } });
}

function session(status: 'CAME' | 'ABSENT', rating: number | null) {
  return {
    groupId,
    date: '2026-07-08',
    items: [
      {
        studentId,
        status,
        rating,
        homeworkDone: status === 'CAME',
        comment: '',
      },
    ],
  };
}

function admin(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${adminToken}`);
}

function teacher(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${teacherToken}`);
}
