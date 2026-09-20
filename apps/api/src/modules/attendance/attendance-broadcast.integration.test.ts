import { GroupStatus, Role, Weekday } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { createAccessToken } from '../auth/token.service.js';

const adminId = '70000000-0000-4000-8000-000000000222';
const teacherUserId = '70000000-0000-4000-8000-000000000223';
const foreignTeacherUserId = '70000000-0000-4000-8000-000000000224';
const suffix = Date.now().toString(36);

let adminToken = '';
let teacherToken = '';
let foreignTeacherToken = '';
let groupId = '';
let studentId = '';
let linkId = '';
const testChatId = `-100998877${suffix}`;

describe('Attendance Lesson Broadcast Integration', () => {
  async function cleanup() {
    await prisma.telegramNotificationLog.deleteMany({
      where: {
        OR: [
          { telegramLinkId: linkId },
          { jobId: { contains: suffix } },
        ],
      },
    }).catch(() => undefined);
    await prisma.attendance.deleteMany({
      where: {
        OR: [
          { groupId },
          { group: { name: { contains: suffix } } },
        ],
      },
    }).catch(() => undefined);
    await prisma.groupLesson.deleteMany({
      where: {
        OR: [
          { groupId },
          { group: { name: { contains: suffix } } },
        ],
      },
    }).catch(() => undefined);
    await prisma.telegramLink.deleteMany({
      where: {
        OR: [
          { telegramChatId: `att-bc-student-chat-${suffix}` },
          { telegramChatId: `att-bc-student-second-${suffix}` },
          { studentId },
        ],
      },
    }).catch(() => undefined);
    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [
          { studentId },
          { student: { studentCode: { contains: suffix.toUpperCase() } } },
          { createdByUserId: { in: [adminId, teacherUserId, foreignTeacherUserId] } },
        ],
      },
    }).catch(() => undefined);
    await prisma.auditLog.deleteMany({
      where: { actorUserId: { in: [adminId, teacherUserId, foreignTeacherUserId] } },
    }).catch(() => undefined);
    await prisma.groupStudent.deleteMany({
      where: {
        OR: [
          { groupId },
          { studentId },
          { group: { name: { contains: suffix } } },
        ],
      },
    }).catch(() => undefined);
    if (studentId) {
      await prisma.student.delete({ where: { id: studentId } }).catch(() => undefined);
    }
    await prisma.student.deleteMany({
      where: { studentCode: { contains: suffix.toUpperCase() } },
    }).catch(() => undefined);
    if (groupId) {
      await prisma.group.delete({ where: { id: groupId } }).catch(() => undefined);
    }
    await prisma.group.deleteMany({
      where: { name: { contains: suffix } },
    }).catch(() => undefined);
    await prisma.teacher.deleteMany({
      where: { lastName: { contains: suffix } },
    }).catch(() => undefined);
    await prisma.room.deleteMany({
      where: { name: { contains: suffix } },
    }).catch(() => undefined);
    await prisma.course.deleteMany({
      where: { title: { contains: suffix } },
    }).catch(() => undefined);
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, teacherUserId, foreignTeacherUserId] } },
    }).catch(() => undefined);
  }

  beforeAll(async () => {
    await cleanup();

    // 1. Admin
    await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true, login: `att-bc-admin-${suffix}` },
      create: {
        id: adminId,
        login: `att-bc-admin-${suffix}`,
        passwordHash: 'x',
        role: Role.SUPER_ADMIN,
      },
    });
    adminToken = createAccessToken({
      id: adminId,
      login: `att-bc-admin-${suffix}`,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });

    // 2. Teachers
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Broadcast',
        lastName: `Teacher ${suffix}`,
        phone: `+9989000880${suffix.slice(-2)}`,
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    await prisma.user.upsert({
      where: { id: teacherUserId },
      update: { isActive: true, teacherId: teacher.id, login: `att-bc-teacher-${suffix}` },
      create: {
        id: teacherUserId,
        login: `att-bc-teacher-${suffix}`,
        passwordHash: 'x',
        role: Role.TEACHER,
        teacherId: teacher.id,
      },
    });
    teacherToken = createAccessToken({
      id: teacherUserId,
      login: `att-bc-teacher-${suffix}`,
      role: 'TEACHER',
      teacherId: teacher.id,
    });

    const foreignTeacher = await prisma.teacher.create({
      data: {
        firstName: 'Foreign',
        lastName: `Teacher ${suffix}`,
        phone: `+9989000881${suffix.slice(-2)}`,
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    await prisma.user.upsert({
      where: { id: foreignTeacherUserId },
      update: { isActive: true, teacherId: foreignTeacher.id, login: `att-bc-fteacher-${suffix}` },
      create: {
        id: foreignTeacherUserId,
        login: `att-bc-fteacher-${suffix}`,
        passwordHash: 'x',
        role: Role.TEACHER,
        teacherId: foreignTeacher.id,
      },
    });
    foreignTeacherToken = createAccessToken({
      id: foreignTeacherUserId,
      login: `att-bc-fteacher-${suffix}`,
      role: 'TEACHER',
      teacherId: foreignTeacher.id,
    });

    // 3. Course and Room
    const course = await prisma.course.create({
      data: {
        title: `Broadcast Course ${suffix}`,
        durationMonths: 3,
        pricePerMonthUzs: 500000,
      },
    });
    const room = await prisma.room.create({
      data: { name: `Xona ${suffix}` },
    });

    // 4. Group with linked Telegram chat
    const group = await prisma.group.create({
      data: {
        name: `Broadcast Group ${suffix}`,
        courseId: course.id,
        teacherId: teacher.id,
        roomId: room.id,
        weekdays: [Weekday.MON, Weekday.WED, Weekday.FRI],
        lessonStartMinutes: 540,
        status: GroupStatus.ACTIVE,
        startDate: new Date('2026-09-01'),
        telegramChatId: testChatId,
        telegramChatTitle: `Test Group Chat ${suffix}`,
      },
    });

    // 5. Student with linked Telegram
    const student = await prisma.student.create({
      data: {
        studentCode: `BC${suffix.toUpperCase()}`,
        firstName: 'Jasur',
        lastName: `Aliyev ${suffix}`,
      },
    });
    const link = await prisma.telegramLink.create({
      data: {
        telegramChatId: `att-bc-student-chat-${suffix}`,
        studentId: student.id,
        status: 'ACTIVE',
      },
    });
    await prisma.groupStudent.create({
      data: {
        groupId: group.id,
        studentId: student.id,
        joinedAt: new Date('2026-09-01'),
        status: 'ACTIVE',
      },
    });

    groupId = group.id;
    studentId = student.id;
    linkId = link.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('rejects broadcast when both topic and homeworkText are empty', async () => {
    const response = await request(createApp())
      .post(`/api/v1/attendance/group/${groupId}/broadcast`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-09-21',
        topic: '   ',
        homeworkText: '',
        sendToGroupChat: true,
        sendToStudents: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.error?.message || response.body.message).toContain('Mavzu yoki uyga vazifa');
  });

  it('rejects broadcast from a teacher who does not teach the group', async () => {
    const response = await request(createApp())
      .post(`/api/v1/attendance/group/${groupId}/broadcast`)
      .set('Authorization', `Bearer ${foreignTeacherToken}`)
      .send({
        date: '2026-09-21',
        topic: 'Lesson 1: Intro',
        homeworkText: 'Exercise 1-5',
        sendToGroupChat: true,
        sendToStudents: true,
      });

    expect(response.status).toBe(403);
  });

  it('successfully broadcasts lesson summary and queues student notifications', async () => {
    let capturedGroupMessage = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (typeof init?.body === 'string') {
        const parsed = JSON.parse(init.body);
        if (parsed.chat_id === testChatId) {
          capturedGroupMessage = parsed.text;
        }
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
        json: async () => ({ ok: true }),
      } as Response;
    });

    try {
      // First save attendance with a score
      await request(createApp())
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          groupId,
          date: '2026-09-21',
          items: [
            {
              studentId,
              status: 'CAME',
              rating: 5,
              homeworkDone: true,
              topicScore: 5,
              homeworkScore: 5,
              dictionaryScore: 5,
              comment: 'A’lo!',
            },
          ],
        });

      const response = await request(createApp())
        .post(`/api/v1/attendance/group/${groupId}/broadcast`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: '2026-09-21',
          topic: 'Present Continuous mavzusi',
          homeworkText: 'Workbook 45-bet, 1-3 mashqlar',
          sendToGroupChat: true,
          sendToStudents: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        success: true,
        groupChatSent: true,
        studentsSentCount: 1,
      });
      expect(response.body.data.nextLessonSummary).toContain('23.09.2026'); // Next lesson after 2026-09-21 (Mon) is Wed 2026-09-23

      // STRICT PRIVACY RULE VERIFICATION:
      // The group chat message MUST contain topic & homework,
      // but MUST NOT contain student name, rating, score, or status!
      expect(capturedGroupMessage).toContain('Present Continuous mavzusi');
      expect(capturedGroupMessage).toContain('Workbook 45-bet');
      expect(capturedGroupMessage).not.toContain('Jasur');
      expect(capturedGroupMessage).not.toContain('Aliyev');
      expect(capturedGroupMessage).not.toContain('A’lo!');
      expect(capturedGroupMessage).not.toContain('Baho');
      expect(capturedGroupMessage).not.toContain('Keldi');

      // Check that GroupLesson was saved in DB
      const lesson = await prisma.groupLesson.findFirst({
        where: { groupId },
      });
      expect(lesson).not.toBeNull();
      expect(lesson?.homeworkText).toContain('Present Continuous');

      // Check that student lesson_broadcast notification log was created
      const log = await prisma.telegramNotificationLog.findFirst({
        where: {
          telegramLinkId: linkId,
          triggerType: 'LESSON_BROADCAST',
        },
      });
      expect(log).not.toBeNull();
      expect(log?.jobId).toContain(`lesson_broadcast:${groupId}:${studentId}:2026-09-21`);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('delivers broadcast to multiple parent links and allows re-broadcasting updated content', async () => {
    // Add second active link for the student (e.g. father + mother)
    const secondLink = await prisma.telegramLink.create({
      data: {
        telegramChatId: `att-bc-student-second-${suffix}`,
        studentId,
        status: 'ACTIVE',
      },
    });

    try {
      const response = await request(createApp())
        .post(`/api/v1/attendance/group/${groupId}/broadcast`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          date: '2026-09-21',
          topic: 'Present Continuous (Kengaytirilgan)',
          homeworkText: 'Yangi mashqlar 1-10 to‘liq',
          sendToGroupChat: false,
          sendToStudents: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.studentsSentCount).toBe(1);

      // Verify BOTH links received separate notification records without collision
      const logsFirst = await prisma.telegramNotificationLog.findMany({
        where: { telegramLinkId: linkId, triggerType: 'LESSON_BROADCAST' },
      });
      const logsSecond = await prisma.telegramNotificationLog.findMany({
        where: { telegramLinkId: secondLink.id, triggerType: 'LESSON_BROADCAST' },
      });

      expect(logsFirst.length).toBeGreaterThanOrEqual(2); // First broadcast + updated broadcast
      expect(logsSecond).toHaveLength(1); // Second link received this updated broadcast
      expect(logsSecond[0]?.jobId).toContain(secondLink.id);
    } finally {
      await prisma.telegramNotificationLog.deleteMany({ where: { telegramLinkId: secondLink.id } });
      await prisma.telegramLink.delete({ where: { id: secondLink.id } }).catch(() => undefined);
    }
  });

  it('delivers updated notification to student when grades are updated even with identical topic and homework', async () => {
    // 1. Initial broadcast with topic "salom" and homework "salom"
    const firstBroadcast = await request(createApp())
      .post(`/api/v1/attendance/group/${groupId}/broadcast`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        date: '2026-09-21',
        topic: 'salom',
        homeworkText: 'salom',
        sendToGroupChat: false,
        sendToStudents: true,
      });
    expect(firstBroadcast.status).toBe(200);

    // 2. Teacher updates student attendance and assigns rating & score breakdown
    await request(createApp())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        groupId,
        date: '2026-09-21',
        items: [
          {
            studentId,
            status: 'CAME',
            rating: 67,
            homeworkDone: true,
            topicScore: 60,
            homeworkScore: 50,
            dictionaryScore: 90,
            comment: 'Yaxshi!',
          },
        ],
      });

    // 3. Teacher re-broadcasts with the EXACT same topic "salom" and homework "salom"
    const countBefore = await prisma.telegramNotificationLog.count({
      where: { telegramLinkId: linkId, triggerType: 'LESSON_BROADCAST' },
    });

    const secondBroadcast = await request(createApp())
      .post(`/api/v1/attendance/group/${groupId}/broadcast`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        date: '2026-09-21',
        topic: 'salom',
        homeworkText: 'salom',
        sendToGroupChat: false,
        sendToStudents: true,
      });

    expect(secondBroadcast.status).toBe(200);
    expect(secondBroadcast.body.data.studentsSentCount).toBe(1);

    // 4. Verify a new notification log was created containing the updated scores in payload
    const countAfter = await prisma.telegramNotificationLog.count({
      where: { telegramLinkId: linkId, triggerType: 'LESSON_BROADCAST' },
    });
    expect(countAfter).toBe(countBefore + 1);

    const latestLog = await prisma.telegramNotificationLog.findFirst({
      where: { telegramLinkId: linkId, triggerType: 'LESSON_BROADCAST' },
      orderBy: { queuedAt: 'desc' },
    });
    expect(latestLog).not.toBeNull();
    const payload = JSON.parse(latestLog!.payload);
    expect(payload.rating).toBe(67);
    expect(payload.homeworkScore).toBe(50);
    expect(payload.topicScore).toBe(60);
    expect(payload.dictionaryScore).toBe(90);
  });

  it('allows unlinking Telegram chat from group via group endpoint', async () => {
    const response = await request(createApp())
      .post(`/api/v1/groups/${groupId}/unlink-telegram`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.telegramChatId).toBeNull();
    expect(response.body.data.telegramChatTitle).toBeNull();

    const dbGroup = await prisma.group.findUnique({ where: { id: groupId } });
    expect(dbGroup?.telegramChatId).toBeNull();
  });
});
