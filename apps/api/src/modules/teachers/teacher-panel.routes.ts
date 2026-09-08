import { Router } from 'express';
import { successResponse } from '../../common/http/api-response.js';
import { createAuthenticate } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { TeacherPanelService } from './teacher-panel.service.js';

export function createTeacherPanelRouter(
  authService: AuthService,
  service: TeacherPanelService,
): Router {
  const router = Router();
  router.use(createAuthenticate(authService));
  router.use(requireRoles('SUPER_ADMIN', 'ADMIN', 'TEACHER'));

  router.get('/me/dashboard', async (request, response) => {
    const data = await service.getDashboard(request.user!);
    response.json(successResponse(data));
  });

  router.get('/me/schedule', async (request, response) => {
    const data = await service.getSchedule(request.user!);
    response.json(successResponse(data));
  });

  router.get('/me/rating', async (request, response) => {
    const data = await service.getRating(request.user!);
    response.json(successResponse(data));
  });

  router.get('/me/salary', async (request, response) => {
    const data = await service.getSalaryOverview(request.user!);
    response.json(successResponse(data));
  });

  router.get('/me/attendance/groups', async (request, response) => {
    const data = await service.getAttendanceGroups(request.user!);
    response.json(successResponse(data));
  });

  router.get('/me/attendance', async (request, response) => {
    const groupId = request.query.groupId as string;
    const date = request.query.date as string;
    const data = await service.getAttendance(request.user!, groupId, date);
    response.json(successResponse(data));
  });

  router.put('/me/attendance', async (request, response) => {
    const data = await service.saveAttendance(request.user!, request.body);
    response.json(successResponse(data));
  });

  router.get('/me/exams', async (request, response) => {
    const data = await service.getExams(request.user!);
    response.json(successResponse(data));
  });

  router.get('/me/exams/groups', async (request, response) => {
    const data = await service.getExamGroups(request.user!);
    response.json(successResponse(data));
  });

  router.put('/me/exams/:id', async (request, response) => {
    const data = await service.saveExam(request.user!, request.body);
    response.json(successResponse(data));
  });

  router.delete('/me/exams/:id', async (request, response) => {
    await service.deleteExam(request.user!, request.params.id);
    response.json(successResponse({ success: true }));
  });

  return router;
}
