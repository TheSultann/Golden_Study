import {
  createSpeakingTopicSchema,
  gradeSpeakingSubmissionSchema,
  gradeStudentSpeakingSchema,
  querySpeakingSchema,
  submitSpeakingSubmissionSchema,
  type CreateSpeakingTopicInput,
  type GradeSpeakingSubmissionInput,
  type GradeStudentSpeakingInput,
  type SubmitSpeakingSubmissionInput,
} from '@golden-study/contracts';
import { Readable } from 'node:stream';
import { Router } from 'express';
import { z } from 'zod';

import { successResponse } from '../../common/http/api-response.js';
import { logger } from '../../config/logger.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import {
  validateBody,
  validateParams,
} from '../../middlewares/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SpeakingService } from './speaking.service.js';

const submissionIdParamSchema = z.object({ id: z.string().min(1).max(64) });

export function createSpeakingRouter(
  authService: AuthService,
  service: SpeakingService,
): Router {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const requireStaff = requireRoles('SUPER_ADMIN', 'ADMIN', 'TEACHER');

  // GET /api/v1/speaking/topics
  router.get('/topics', authenticate, requireStaff, async (request, response) => {
    const groupId = request.query.groupId ? String(request.query.groupId) : undefined;
    const data = await service.listTopics(groupId, request.user!);
    response.json(successResponse(data));
  });

  // POST /api/v1/speaking/topics
  router.post(
    '/topics',
    authenticate,
    requireStaff,
    validateBody(createSpeakingTopicSchema),
    async (request, response) => {
      const data = await service.createTopic(
        request.body as CreateSpeakingTopicInput,
        request.user!,
      );
      response.status(201).json(successResponse(data));
    },
  );

  // GET /api/v1/speaking/submissions
  router.get('/submissions', authenticate, requireStaff, async (request, response) => {
    const query = querySpeakingSchema.parse(request.query);
    const data = await service.listSubmissions(query, request.user!);
    response.json(successResponse(data));
  });

  // POST /api/v1/speaking/submissions/:id/grade
  router.post(
    '/submissions/:id/grade',
    authenticate,
    requireStaff,
    validateParams(submissionIdParamSchema),
    validateBody(gradeSpeakingSubmissionSchema),
    async (request, response) => {
      const data = await service.gradeSubmission(
        String(request.params.id),
        request.body as GradeSpeakingSubmissionInput,
        request.user!,
      );
      response.json(successResponse(data));
    },
  );

  // POST /api/v1/speaking/submissions/grade-student
  router.post(
    '/submissions/grade-student',
    authenticate,
    requireStaff,
    validateBody(gradeStudentSpeakingSchema),
    async (request, response) => {
      const data = await service.gradeStudent(
        request.body as GradeStudentSpeakingInput,
        request.user!,
      );
      response.json(successResponse(data));
    },
  );

  // GET /api/v1/speaking/submissions/:id/audio
  router.get(
    '/submissions/:id/audio',
    authenticate,
    requireStaff,
    validateParams(submissionIdParamSchema),
    async (request, response) => {
      const rangeHeader = request.header('range');
      const audioResult = await service.getSubmissionAudio(
        String(request.params.id),
        request.user!,
        rangeHeader,
      );

      const contentType = audioResult.contentType || 'audio/ogg';

      // 1. In-memory buffer response with HTTP Range support
      if (audioResult.buffer) {
        let buffer = audioResult.buffer;
        let statusCode = audioResult.statusCode || 200;
        let contentRange: string | undefined;

        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
          const parts = rangeHeader.slice(6).split('-');
          const rawStart = parts[0]?.trim();
          const rawEnd = parts[1]?.trim();
          const total = buffer.length;

          let start = rawStart ? parseInt(rawStart, 10) : 0;
          let end = rawEnd ? parseInt(rawEnd, 10) : total - 1;

          if (Number.isNaN(start)) start = 0;
          if (Number.isNaN(end) || end >= total) end = total - 1;

          if (start > end || start >= total) {
            response.status(416);
            response.setHeader('Content-Range', `bytes */${total}`);
            response.end();
            return;
          }

          buffer = buffer.subarray(start, end + 1);
          statusCode = 206;
          contentRange = `bytes ${start}-${end}/${total}`;
        }

        response.status(statusCode);
        response.setHeader('Content-Type', contentType);
        response.setHeader('Content-Disposition', 'inline');
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        response.setHeader('Accept-Ranges', 'bytes');
        response.setHeader('Cache-Control', 'private, max-age=3600');
        if (contentRange) {
          response.setHeader('Content-Range', contentRange);
        }
        response.setHeader('Content-Length', String(buffer.length));
        response.send(buffer);
        return;
      }

      // 2. Streamed response (Telegram CDN or remote audio)
      if (audioResult.stream) {
        const statusCode = audioResult.statusCode || 200;
        response.status(statusCode);
        response.setHeader('Content-Type', contentType);
        response.setHeader('Content-Disposition', 'inline');
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        response.setHeader('Accept-Ranges', 'bytes');
        response.setHeader('Cache-Control', 'private, max-age=3600');
        if (audioResult.contentRange) {
          response.setHeader('Content-Range', audioResult.contentRange);
        }
        if (audioResult.contentLength !== undefined && audioResult.contentLength !== null) {
          response.setHeader('Content-Length', String(audioResult.contentLength));
        }

        // Handle both Node.js Readable streams and Web ReadableStreams safely
        let nodeStream: NodeJS.ReadableStream;
        const candidate = audioResult.stream as unknown as {
          pipe?: (...args: unknown[]) => unknown;
          destroy?: () => void;
        };

        if (typeof candidate?.pipe === 'function') {
          nodeStream = audioResult.stream as NodeJS.ReadableStream;
        } else {
          nodeStream = Readable.fromWeb(
            audioResult.stream as Parameters<typeof Readable.fromWeb>[0],
          );
        }

        nodeStream.on('error', (err) => {
          logger.error({ err }, 'Error streaming audio');
          if (!response.headersSent) {
            response.status(500).end();
          }
        });

        request.on('close', () => {
          if (!response.writableEnded) {
            const streamWithDestroy = nodeStream as unknown as { destroy?: () => void };
            if (typeof streamWithDestroy.destroy === 'function') {
              streamWithDestroy.destroy();
            }
          }
        });

        nodeStream.pipe(response);
        return;
      }

      response.status(404).end();
    },
  );

  // POST /api/v1/speaking/submissions
  router.post(
    '/submissions',
    async (request, response, next) => {
      if (request.header('authorization')) {
        return authenticate(request, response, (err) => {
          if (err) return next(err);
          next();
        });
      }
      next();
    },
    validateBody(submitSpeakingSubmissionSchema),
    async (request, response) => {
      const data = await service.createSubmission(
        request.body as SubmitSpeakingSubmissionInput,
        request.user,
      );
      response.status(201).json(successResponse(data));
    },
  );

  return router;
}
