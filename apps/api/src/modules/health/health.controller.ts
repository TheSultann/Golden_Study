import type { RequestHandler } from 'express';

import { successResponse } from '../../common/http/api-response.js';

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json(
    successResponse({
      status: 'ok',
    }),
  );
};
