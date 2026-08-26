import { Role } from '@prisma/client';
import { authResponseSchema } from '@golden-study/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { prisma } from '../../config/prisma.js';
import { hashPassword } from './password.service.js';

describe('Auth API', () => {
  beforeAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany({
      where: { login: { in: ['integration-admin', 'integration-super'] } },
    });

    await prisma.user.createMany({
      data: [
        {
          login: 'integration-admin',
          passwordHash: await hashPassword('password123'),
          role: Role.ADMIN,
        },
        {
          login: 'integration-super',
          passwordHash: await hashPassword('password123'),
          role: Role.SUPER_ADMIN,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany({
      where: { login: { in: ['integration-admin', 'integration-super'] } },
    });
  });

  it('logs in, sets httpOnly refresh cookie and returns no refresh token', async () => {
    const response = await request(createApp()).post('/api/v1/auth/login').send({
      login: 'integration-admin',
      password: 'password123',
    });

    expect(response.status).toBe(200);
    const body = authResponseSchema.parse(response.body as unknown);
    expect(body.data.accessToken).toBeTruthy();
    expect(Reflect.get(body.data, 'refreshToken')).toBeUndefined();
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
  });

  it('returns current user for a valid access token', async () => {
    const login = await request(createApp()).post('/api/v1/auth/login').send({
      login: 'integration-admin',
      password: 'password123',
    });

    const loginBody = authResponseSchema.parse(login.body as unknown);
    const response = await request(createApp())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginBody.data.accessToken}`);

    expect(response.status).toBe(200);
    expect(
      (response.body as { data?: { login?: string } }).data?.login,
    ).toBe('integration-admin');
  });

  it('rotates refresh token and rejects replay', async () => {
    const agent = request.agent(createApp());
    await agent.post('/api/v1/auth/login').send({
      login: 'integration-admin',
      password: 'password123',
    });
    const firstRefresh = await agent.post('/api/v1/auth/refresh');
    const oldCookie = firstRefresh.request.cookies;

    expect(firstRefresh.status).toBe(200);

    const replay = await request(createApp())
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldCookie);

    expect(replay.status).toBe(401);
  });

  it('enforces SUPER_ADMIN role for session listing', async () => {
    const adminLogin = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        login: 'integration-admin',
        password: 'password123',
      });
    const adminLoginBody = authResponseSchema.parse(
      adminLogin.body as unknown,
    );
    const adminResponse = await request(createApp())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${adminLoginBody.data.accessToken}`);

    const superLogin = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        login: 'integration-super',
        password: 'password123',
      });
    const superLoginBody = authResponseSchema.parse(
      superLogin.body as unknown,
    );
    const superResponse = await request(createApp())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${superLoginBody.data.accessToken}`);

    expect(adminResponse.status).toBe(403);
    expect(superResponse.status).toBe(200);
    expect(
      Array.isArray((superResponse.body as { data?: unknown }).data),
    ).toBe(true);
  });

  it('logs out and clears refresh cookie', async () => {
    const agent = request.agent(createApp());
    await agent.post('/api/v1/auth/login').send({
      login: 'integration-admin',
      password: 'password123',
    });

    const response = await agent.post('/api/v1/auth/logout');

    expect(response.status).toBe(204);
    expect(response.headers['set-cookie']?.[0]).toContain('golden_refresh=;');
  });
});
