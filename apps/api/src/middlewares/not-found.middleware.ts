import type { RequestHandler } from 'express';

import { ApiError } from '../common/errors/api-error.js';

export const notFoundMiddleware: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
};
