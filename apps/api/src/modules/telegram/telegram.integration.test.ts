import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';

describe('Telegram Integration API & RBAC', () => {
  const app = createApp();

  async function getAdminToken(): Promise<string> {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'admin', password: 'admin-local-2026' });
    if (res.body?.data?.accessToken) return res.body.data.accessToken as string;
    const res2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    return res2.body.data.accessToken as string;
  }

  async function getTeacherToken(): Promise<string> {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'teacher', password: 'teacher-local-2026' });
    if (res.body?.data?.accessToken) return res.body.data.accessToken as string;
    const res2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'teacher.teacher', password: '12345678' });
    return res2.body.data.accessToken as string;
  }

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/v1/telegram-bot');
    expect(response.status).toBe(401);
  });

  it('rejects teacher role requests with 403 Forbidden', async () => {
    const teacherToken = await getTeacherToken();
    const response = await request(app)
      .get('/api/v1/telegram-bot')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(response.status).toBe(403);
  });

  it('returns telegram overview for ADMIN role', async () => {
    const adminToken = await getAdminToken();
    const response = await request(app)
      .get('/api/v1/telegram-bot')
      .set('Authorization', `Bearer ${adminToken}`);

    if (response.status !== 200) {
      console.log('TELEGRAM_TEST_ERROR:', JSON.stringify(response.body, null, 2));
    }

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.queue).toBeDefined();
    expect(response.body.data.service.status).toBe('online');
  });

  it('creates pending link, approves it via API and updates DB status to ACTIVE', async () => {
    const adminToken = await getAdminToken();
    const student = await prisma.student.findFirst();
    if (!student) return;

    const link = await prisma.telegramLink.create({
      data: {
        telegramChatId: 'test-chat-999',
        studentId: student.id,
        parentName: 'Test Parent',
        parentPhone: '+998909999999',
        status: 'PENDING',
      },
    });

    const approveResponse = await request(app)
      .patch(`/api/v1/telegram-bot/links/${link.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe('active');

    const dbLink = await prisma.telegramLink.findUnique({
      where: { id: link.id },
    });
    expect(dbLink?.status).toBe('ACTIVE');
  });
});
