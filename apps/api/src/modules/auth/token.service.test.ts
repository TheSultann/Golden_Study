import { describe, expect, it } from 'vitest';

import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './token.service.js';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  login: 'teacher',
  role: 'TEACHER' as const,
  teacherId: '22222222-2222-4222-8222-222222222222',
};

describe('token service', () => {
  it('creates and verifies an access token with role ownership data', () => {
    const payload = verifyAccessToken(createAccessToken(user));

    expect(payload).toMatchObject({
      sub: user.id,
      role: 'TEACHER',
      teacherId: user.teacherId,
      type: 'access',
    });
  });

  it('creates and verifies a refresh token with its session id', () => {
    const payload = verifyRefreshToken(
      createRefreshToken(user.id, '33333333-3333-4333-8333-333333333333'),
    );

    expect(payload).toMatchObject({
      sub: user.id,
      jti: '33333333-3333-4333-8333-333333333333',
      type: 'refresh',
    });
  });

  it('does not accept a refresh token as an access token', () => {
    const token = createRefreshToken(
      user.id,
      '33333333-3333-4333-8333-333333333333',
    );

    expect(() => verifyAccessToken(token)).toThrowError();
  });

  it('hashes refresh tokens deterministically without retaining raw token', () => {
    const token = 'raw-refresh-token';

    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});
