import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { ApiError } from '../common/errors/api-error.js';
import { logger } from '../config/logger.js';

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  const apiError =
    error instanceof ApiError
      ? error
      : error instanceof ZodError
        ? new ApiError(
            400,
            'VALIDATION_ERROR',
            'Invalid request',
            error.issues,
          )
        : new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');

  if (!(error instanceof ApiError) || apiError.statusCode >= 500) {
    logger.error({ err: error }, 'Request failed');
  }

  response.status(apiError.statusCode).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
  });
};
