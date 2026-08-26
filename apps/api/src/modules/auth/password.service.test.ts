import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.service.js';

describe('password service', () => {
  it('hashes a password without storing the raw value', async () => {
    const hash = await hashPassword('strong-password');

    expect(hash).not.toBe('strong-password');
    await expect(verifyPassword('strong-password', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('strong-password');

    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
