import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('API application', () => {
  it('returns health status using the common response envelope', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
      },
    });
  });

  it('returns the common error envelope for an unknown route', async () => {
    const response = await request(createApp()).get('/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });
});
