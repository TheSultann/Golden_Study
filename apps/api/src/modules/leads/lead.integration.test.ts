import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const prefix = 'Lead Integration';
const adminId = '73000000-0000-4000-8000-000000000001';
let token = '';
let courseId = '';
let teacherId = '';
let groupId = '';
let leadId = '';

describe('Leads API', () => {
  beforeAll(async () => {
    const admin = await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true },
      create: {
        id: adminId,
        login: 'lead-integration-admin',
        passwordHash: await hashPassword('password123'),
        role: 'SUPER_ADMIN',
      },
    });
    await prisma.group.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.course.deleteMany({ where: { title: { startsWith: prefix } } });
    await prisma.teacher.deleteMany({ where: { phone: '+998900004001' } });

    const course = await prisma.course.create({
      data: {
        title: `${prefix} Course`,
        durationMonths: 6,
        pricePerMonthUzs: 500000,
      },
    });
    const teacher = await prisma.teacher.create({
      data: {
        firstName: 'Lead',
        lastName: 'Teacher',
        phone: '+998900004001',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    const group = await prisma.group.create({
      data: {
        name: `${prefix} Group`,
        courseId: course.id,
        teacherId: teacher.id,
        weekdays: ['MON'],
        lessonStartMinutes: 600,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-07-01'),
      },
    });
    courseId = course.id;
    teacherId = teacher.id;
    groupId = group.id;
    token = createAccessToken({
      id: admin.id,
      login: admin.login,
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
  });

  afterAll(async () => {
    await prisma.groupStudent.deleteMany({
      where: { groupId },
    });
    await prisma.lead.deleteMany({
      where: { fullName: { startsWith: prefix } },
    });
    await prisma.studentStatusPeriod.deleteMany({
      where: { student: { firstName: { startsWith: prefix } } },
    });
    await prisma.student.deleteMany({
      where: { firstName: { startsWith: prefix } },
    });
    await prisma.group.deleteMany({ where: { id: groupId } });
    await prisma.user.deleteMany({
      where: { login: 'lead-integration-admin' },
    });
    await prisma.teacher.deleteMany({ where: { id: teacherId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
  });

  it('creates, lists, updates and moves lead through funnel', async () => {
    const created = await auth(
      request(createApp()).post('/api/v1/leads'),
    ).send({
      fullName: `${prefix} Ali`,
      phone: '+998901234567',
      interestedCourseId: courseId,
      teacherId,
      comment: 'Instagram',
    });
    expect(created.status).toBe(201);
    leadId = (created.body as { data: { id: string } }).data.id;

    const listed = await auth(
      request(createApp()).get('/api/v1/leads?search=Lead&status=NEW'),
    );
    expect(listed.status).toBe(200);
    expect(
      (listed.body as { data: Array<{ id: string }> }).data,
    ).toContainEqual(expect.objectContaining({ id: leadId }));

    expect(
      (
        await auth(
          request(createApp()).patch(`/api/v1/leads/${leadId}`),
        ).send({ comment: 'Called' })
      ).status,
    ).toBe(200);
    const moved = await auth(
      request(createApp()).patch(`/api/v1/leads/${leadId}/status`),
    ).send({ status: 'TRIAL' });
    expect(moved.status).toBe(200);
    expect((moved.body as { data: { status: string } }).data.status).toBe(
      'TRIAL',
    );
  });

  it('converts lead once and creates membership transactionally', async () => {
    const converted = await auth(
      request(createApp()).post(`/api/v1/leads/${leadId}/convert`),
    ).send({ groupId });
    expect(converted.status).toBe(201);
    const data = (
      converted.body as {
        data: { lead: { status: string }; student: { id: string; studentCode: string } };
      }
    ).data;
    expect(data.lead.status).toBe('CONVERTED');
    expect(data.student.studentCode).toMatch(/^ST\d+$/);
    expect(
      await prisma.groupStudent.count({
        where: { groupId, studentId: data.student.id, status: 'ACTIVE' },
      }),
    ).toBe(1);

    expect(
      (
        await auth(
          request(createApp()).post(`/api/v1/leads/${leadId}/convert`),
        ).send({})
      ).status,
    ).toBe(409);
  });

  it('archives lead instead of deleting it', async () => {
    const created = await auth(
      request(createApp()).post('/api/v1/leads'),
    ).send({
      fullName: `${prefix} Archive`,
      phone: '+998901234568',
    });
    const id = (created.body as { data: { id: string } }).data.id;
    expect(
      (await auth(request(createApp()).delete(`/api/v1/leads/${id}`))).status,
    ).toBe(204);
    expect(await prisma.lead.findUnique({ where: { id } })).toMatchObject({
      status: 'ARCHIVED',
    });
  });
});

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${token}`);
}
