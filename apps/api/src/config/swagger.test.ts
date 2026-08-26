import { describe, expect, it } from 'vitest';

import { openApiDocument } from './swagger.js';

describe('OpenAPI document', () => {
  it.each([
    '/health',
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/auth/me',
    '/auth/sessions',
    '/courses',
    '/courses/{id}',
    '/rooms',
    '/rooms/{id}',
    '/teachers',
    '/teachers/{id}',
    '/groups',
    '/groups/{id}',
    '/groups/{id}/students',
    '/groups/{id}/students/{studentId}',
    '/groups/{id}/students/{studentId}/graduate',
    '/students',
    '/students/{id}',
    '/students/{id}/freeze',
    '/students/{id}/unfreeze',
    '/leads',
    '/leads/{id}',
    '/leads/{id}/status',
    '/leads/{id}/convert',
    '/attendance',
    '/attendance/group/{groupId}/date/{date}',
    '/attendance/{id}',
    '/students/{id}/attendance',
    '/transactions',
    '/transactions/{id}/reverse',
    '/payments/student',
    '/payments/{id}/reverse',
    '/students/{id}/transactions',
    '/billing/daily/reconcile',
    '/billing/monthly/reconcile',
    '/billing/runs',
    '/teachers/{id}/kpi',
    '/teachers/{id}/payout',
    '/teachers/{id}/payouts/{payoutId}/reverse',
    '/finance/summary',
    '/finance/debtors',
  ])('documents %s', (path) => {
    expect(openApiDocument.paths).toHaveProperty(path);
  });

  it.each([
    'LedgerEntry',
    'Payment',
    'BillingRun',
    'TeacherKpiSummary',
    'FinanceSummary',
    'Debtor',
  ])('defines %s schema', (schema) => {
    expect(openApiDocument.components.schemas).toHaveProperty(schema);
  });

  it('defines bearer and refresh cookie security schemes', () => {
    expect(openApiDocument.components.securitySchemes).toMatchObject({
      bearerAuth: { type: 'http', scheme: 'bearer' },
      refreshCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'golden_refresh',
      },
    });
  });
});
