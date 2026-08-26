import {
  courseCreateInputSchema,
  lessonDurationMinutesSchema,
  paginationQuerySchema,
} from '@golden-study/contracts';
import { describe, expect, it } from 'vitest';

import { toPaginationMeta } from './pagination.js';

describe('pagination contracts', () => {
  it('parses defaults and caps limit', () => {
    expect(paginationQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
    });
    expect(() => paginationQuerySchema.parse({ limit: '101' })).toThrowError();
  });

  it('calculates stable pagination meta', () => {
    expect(toPaginationMeta(2, 20, 41)).toEqual({
      page: 2,
      limit: 20,
      total: 41,
      totalPages: 3,
    });
  });
});

describe('core academic contracts', () => {
  it('accepts only supported lesson durations', () => {
    expect(lessonDurationMinutesSchema.parse(90)).toBe(90);
    expect(() => lessonDurationMinutesSchema.parse(75)).toThrowError();
  });

  it('rejects unknown course fields', () => {
    expect(() =>
      courseCreateInputSchema.parse({
        title: 'English',
        durationMonths: 6,
        pricePerMonthUzs: 600_000,
        unexpected: true,
      }),
    ).toThrowError();
  });
});
