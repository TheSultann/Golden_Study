import { Role } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from '../auth/password.service.js';
import { createAccessToken } from '../auth/token.service.js';

const userId = '70000000-0000-4000-8000-000000000001';
let accessToken = '';
let courseId = '';
let roomId = '';
let teacherId = '';

describe('Courses and Rooms API', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      update: { isActive: true, role: Role.SUPER_ADMIN },
      create: {
        id: userId,
        login: 'catalog-integration-admin',
        passwordHash: await hashPassword('password123'),
        role: Role.SUPER_ADMIN,
      },
    });
    accessToken = createAccessToken({
      id: userId,
      login: 'catalog-integration-admin',
      role: 'SUPER_ADMIN',
      teacherId: null,
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { login: { startsWith: 'teacher-integration-' } },
    });
    await prisma.teacher.deleteMany({
      where: { phone: { startsWith: '+998900001' } },
    });
    await prisma.course.deleteMany({
      where: { title: { startsWith: 'Integration Course' } },
    });
    await prisma.room.deleteMany({
      where: { name: { startsWith: 'Integration Room' } },
    });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('creates, lists, updates, deactivates and reactivates a course', async () => {
    const created = await auth(
      request(createApp()).post('/api/v1/courses'),
    )
      .send({
        title: 'Integration Course A',
        description: 'Test',
        durationMonths: 6,
        pricePerMonthUzs: 600000,
      });
    expect(created.status).toBe(201);
    courseId = (created.body as { data: { id: string } }).data.id;

    const listed = await auth(
      request(createApp()).get(
        '/api/v1/courses?search=Integration&page=1&limit=10',
      ),
    );
    expect(listed.status).toBe(200);
    expect(
      (
        listed.body as {
          data: Array<{ id: string }>;
        }
      ).data,
    ).toContainEqual(expect.objectContaining({ id: courseId }));

    const updated = await auth(
      request(createApp()).patch(`/api/v1/courses/${courseId}`),
    )
      .send({ pricePerMonthUzs: 650000 });
    expect(updated.status).toBe(200);
    expect(
      (updated.body as { data: { pricePerMonthUzs: number } }).data
        .pricePerMonthUzs,
    ).toBe(650000);

    expect(
      (await auth(request(createApp()).delete(`/api/v1/courses/${courseId}`)))
        .status,
    ).toBe(204);

    const reactivated = await auth(
      request(createApp()).patch(`/api/v1/courses/${courseId}/status`),
    ).send({ isActive: true });
    expect(reactivated.status).toBe(200);
    expect((reactivated.body as { data: { isActive: boolean } }).data.isActive)
      .toBe(true);
  });

  it('rejects a case-insensitive duplicate course title', async () => {
    await auth(request(createApp()).post('/api/v1/courses')).send({
      title: 'Integration Course Duplicate',
      durationMonths: 6,
      pricePerMonthUzs: 500000,
    });
    const duplicate = await auth(
      request(createApp()).post('/api/v1/courses'),
    ).send({
      title: 'integration course duplicate',
      durationMonths: 6,
      pricePerMonthUzs: 500000,
    });

    expect(duplicate.status).toBe(409);
  });

  it('creates, updates, lists and archives a room', async () => {
    const created = await auth(request(createApp()).post('/api/v1/rooms'))
      .send({ name: 'Integration Room A' });
    expect(created.status).toBe(201);
    roomId = (created.body as { data: { id: string } }).data.id;

    const listed = await auth(
      request(createApp()).get('/api/v1/rooms?search=Integration'),
    );
    expect(listed.status).toBe(200);

    const updated = await auth(
      request(createApp()).patch(`/api/v1/rooms/${roomId}`),
    )
      .send({ name: 'Integration Room B' });
    expect(updated.status).toBe(200);

    expect(
      (await auth(request(createApp()).delete(`/api/v1/rooms/${roomId}`)))
        .status,
    ).toBe(204);
  });

  it('creates Teacher and User transactionally, lists and updates teacher', async () => {
    const created = await auth(
      request(createApp()).post('/api/v1/teachers'),
    ).send({
      firstName: 'Integration',
      lastName: 'Teacher',
      phone: '+998900001111',
      salaryType: 'FIXED',
      fixedSalaryUzs: 5000000,
      login: 'teacher-integration-a',
      password: 'SecurePass123',
    });

    expect(created.status).toBe(201);
    teacherId = (created.body as { data: { id: string } }).data.id;
    expect(
      await prisma.user.findUnique({
        where: { login: 'teacher-integration-a' },
      }),
    ).toMatchObject({ teacherId, role: 'TEACHER' });

    const listed = await auth(
      request(createApp()).get('/api/v1/teachers?search=Integration'),
    );
    expect(listed.status).toBe(200);
    expect((listed.body as { meta: { total: number } }).meta.total).toBe(1);

    const updated = await auth(
      request(createApp()).patch(`/api/v1/teachers/${teacherId}`),
    ).send({
      salaryType: 'PER_STUDENT',
      perStudentRateUzs: 150000,
    });
    expect(updated.status).toBe(200);
    expect((updated.body as { data: unknown }).data).toMatchObject({
      salaryType: 'PER_STUDENT',
      fixedSalaryUzs: null,
      perStudentRateUzs: 150000,
    });
  });

  it('allows teacher to read only own profile', async () => {
    const teacherUser = await prisma.user.findUniqueOrThrow({
      where: { login: 'teacher-integration-a' },
    });
    const teacherToken = createAccessToken({
      id: teacherUser.id,
      login: teacherUser.login,
      role: 'TEACHER',
      teacherId,
    });

    expect(
      (
        await request(createApp())
          .get(`/api/v1/teachers/${teacherId}`)
          .set('Authorization', `Bearer ${teacherToken}`)
      ).status,
    ).toBe(200);

    const otherTeacher = await prisma.teacher.create({
      data: {
        firstName: 'Other',
        lastName: 'Teacher',
        phone: '+998900001112',
        salaryType: 'FIXED',
        fixedSalaryUzs: 1,
      },
    });
    expect(
      (
        await request(createApp())
          .get(`/api/v1/teachers/${otherTeacher.id}`)
          .set('Authorization', `Bearer ${teacherToken}`)
      ).status,
    ).toBe(403);
  });

  it('archives teacher without active groups and disables login', async () => {
    const response = await auth(
      request(createApp()).delete(`/api/v1/teachers/${teacherId}`),
    );
    expect(response.status).toBe(204);
    expect(
      await prisma.user.findUnique({
        where: { login: 'teacher-integration-a' },
      }),
    ).toMatchObject({ isActive: false });
  });
});

function auth(test: request.Test): request.Test {
  return test.set('Authorization', `Bearer ${accessToken}`);
}
