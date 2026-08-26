import {
  manualTransactionCreateInputSchema,
  reversalInputSchema,
  studentPaymentCreateInputSchema,
  transactionListQuerySchema,
  uuidParamSchema,
} from '@golden-study/contracts';
import { Router } from 'express';

import {
  paginatedResponse,
  successResponse,
} from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { LedgerService } from './ledger.service.js';
import type { PaymentService } from './payment.service.js';

export function createTransactionRouter(
  authService: AuthService,
  ledger: LedgerService,
): Router {
  const router = adminRouter(authService);
  router.get('/', async (request, response) => {
    const result = await ledger.list(
      transactionListQuerySchema.parse(request.query),
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  router.post('/', async (request, response) => {
    const result = await ledger.createManual(
      manualTransactionCreateInputSchema.parse(request.body as unknown),
      request.user!.id,
    );
    response
      .status(result.created ? 201 : 200)
      .json(successResponse(result.data));
  });
  router.post('/:id/reverse', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const { comment } = reversalInputSchema.parse(request.body as unknown);
    response
      .status(201)
      .json(
        successResponse(await ledger.reverse(id, comment, request.user!.id)),
      );
  });
  return router;
}

export function createPaymentRouter(
  authService: AuthService,
  payments: PaymentService,
): Router {
  const router = adminRouter(authService);
  router.post('/student', async (request, response) => {
    const result = await payments.create(
      studentPaymentCreateInputSchema.parse(request.body as unknown),
      request.user!.id,
    );
    response
      .status(result.created ? 201 : 200)
      .json(successResponse(result.data));
  });
  router.post('/:id/reverse', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const { comment } = reversalInputSchema.parse(request.body as unknown);
    response
      .status(201)
      .json(
        successResponse(await payments.reverse(id, comment, request.user!.id)),
      );
  });
  return router;
}

export function createStudentTransactionRouter(
  authService: AuthService,
  ledger: LedgerService,
): Router {
  const router = adminRouter(authService);
  router.get('/:id/transactions', async (request, response) => {
    const { id } = uuidParamSchema.parse(request.params);
    const result = await ledger.list(
      transactionListQuerySchema.parse({ ...request.query, studentId: id }),
    );
    response.json(paginatedResponse(result.data, result.meta));
  });
  return router;
}

function adminRouter(authService: AuthService): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN'));
  return router;
}
