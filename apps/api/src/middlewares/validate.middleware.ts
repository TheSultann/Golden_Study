import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { ApiError } from '../common/errors/api-error.js';

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(
        new ApiError(400, 'VALIDATION_ERROR', 'Invalid request body', result.error.issues),
      );
      return;
    }

    request.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      next(
        new ApiError(400, 'VALIDATION_ERROR', 'Invalid request parameters', result.error.issues),
      );
      return;
    }

    request.params = result.data as Record<string, string>;
    next();
  };
}
