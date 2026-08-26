import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { openApiDocument } from './config/swagger.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { healthRouter } from './modules/health/health.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { PrismaAuthRepository } from './modules/auth/prisma-auth.repository.js';
import { prisma } from './config/prisma.js';
import { CourseService } from './modules/courses/course.service.js';
import { createCourseRouter } from './modules/courses/course.routes.js';
import { RoomService } from './modules/rooms/room.service.js';
import { createRoomRouter } from './modules/rooms/room.routes.js';
import { createTeacherRouter } from './modules/teachers/teacher.routes.js';
import { TeacherService } from './modules/teachers/teacher.service.js';
import { createGroupRouter } from './modules/groups/group.routes.js';
import { GroupService } from './modules/groups/group.service.js';
import {
  createMembershipRouter,
  createStudentRouter,
} from './modules/students/student.routes.js';
import { StudentService } from './modules/students/student.service.js';
import { createLeadRouter } from './modules/leads/lead.routes.js';
import { LeadService } from './modules/leads/lead.service.js';
import {
  createAttendanceRouter,
  createStudentAttendanceRouter,
} from './modules/attendance/attendance.routes.js';
import { AttendanceService } from './modules/attendance/attendance.service.js';
import {
  createPaymentRouter,
  createStudentTransactionRouter,
  createTransactionRouter,
} from './modules/finance/finance.routes.js';
import { LedgerService } from './modules/finance/ledger.service.js';
import { PaymentService } from './modules/finance/payment.service.js';
import { BillingService } from './modules/billing/billing.service.js';
import { createBillingRouter } from './modules/billing/billing.routes.js';
import { MonthlyBillingService } from './modules/billing/monthly-billing.service.js';
import { KpiService } from './modules/kpi/kpi.service.js';
import { createKpiRouter } from './modules/kpi/kpi.routes.js';
import { FinanceQueryService } from './modules/finance/finance-query.service.js';
import { createFinanceQueryRouter } from './modules/finance/finance-query.routes.js';
import { DashboardService } from './modules/dashboard/dashboard.service.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { SettingsService } from './modules/settings/settings.service.js';
import { createSettingsRouter } from './modules/settings/settings.routes.js';
import { StaffService } from './modules/staff/staff.service.js';
import { createStaffRouter } from './modules/staff/staff.routes.js';
import { AnnouncementService } from './modules/announcements/announcement.service.js';
import { createAnnouncementRouter } from './modules/announcements/announcement.routes.js';
import { ExamService } from './modules/exams/exam.service.js';
import { createExamRouter } from './modules/exams/exam.routes.js';
import { TeacherPanelService } from './modules/teachers/teacher-panel.service.js';
import { createTeacherPanelRouter } from './modules/teachers/teacher-panel.routes.js';
import { TelegramService } from './modules/telegram/telegram.service.js';
import { createTelegramRouter } from './modules/telegram/telegram.routes.js';
import {
  createNotificationQueue,
  startNotificationWorker,
} from './queue/notification-queue.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  const allowedOrigins = new Set([
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ]);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.NODE_ENV === 'development' || (origin && allowedOrigins.has(origin))) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api/openapi.json', (_request, response) => {
    response.json(openApiDocument);
  });
  app.use('/api/v1/health', healthRouter);
  const authService = new AuthService(new PrismaAuthRepository(prisma));
  app.use('/api/v1/auth', createAuthRouter(authService));
  app.use(
    '/api/v1/courses',
    createCourseRouter(authService, new CourseService(prisma)),
  );
  app.use(
    '/api/v1/rooms',
    createRoomRouter(authService, new RoomService(prisma)),
  );
  app.use(
    '/api/v1/teachers',
    createTeacherRouter(authService, new TeacherService(prisma)),
  );
  app.use(
    '/api/v1/groups',
    createGroupRouter(authService, new GroupService(prisma)),
  );
  const studentService = new StudentService(prisma);
  app.use(
    '/api/v1/students',
    createStudentRouter(authService, studentService),
  );
  app.use(
    '/api/v1/groups',
    createMembershipRouter(authService, studentService),
  );
  app.use(
    '/api/v1/leads',
    createLeadRouter(authService, new LeadService(prisma)),
  );
  const kpiService = new KpiService(prisma);
  const billingService = new BillingService(prisma, kpiService);
  const notificationQueue = createNotificationQueue();
  const telegramService = new TelegramService(prisma, notificationQueue);
  notificationQueue.register((payload) => telegramService.processor(payload));
  if (notificationQueue.kind === 'bullmq') {
    startNotificationWorker((payload) => telegramService.processor(payload));
  }
  const attendanceService = new AttendanceService(
    prisma,
    billingService,
    telegramService,
  );
  app.use(
    '/api/v1/attendance',
    createAttendanceRouter(authService, attendanceService),
  );
  app.use(
    '/api/v1/students',
    createStudentAttendanceRouter(authService, attendanceService),
  );
  const ledgerService = new LedgerService(prisma);
  app.use(
    '/api/v1/transactions',
    createTransactionRouter(authService, ledgerService),
  );
  app.use(
    '/api/v1/payments',
    createPaymentRouter(authService, new PaymentService(prisma, telegramService)),
  );
  app.use(
    '/api/v1/students',
    createStudentTransactionRouter(authService, ledgerService),
  );
  app.use(
    '/api/v1/billing',
    createBillingRouter(
      authService,
      billingService,
      new MonthlyBillingService(prisma, kpiService),
    ),
  );
  app.use('/api/v1/teachers', createKpiRouter(authService, kpiService));
  app.use(
    '/api/v1/finance',
    createFinanceQueryRouter(authService, new FinanceQueryService(prisma)),
  );
  app.use(
    '/api/v1/dashboard',
    createDashboardRouter(authService, new DashboardService(prisma)),
  );
  app.use(
    '/api/v1/settings',
    createSettingsRouter(authService, new SettingsService(prisma)),
  );
  app.use(
    '/api/v1/staff',
    createStaffRouter(authService, new StaffService(prisma)),
  );
  app.use(
    '/api/v1/announcements',
    createAnnouncementRouter(
      authService,
      new AnnouncementService(prisma, telegramService),
    ),
  );
  app.use(
    '/api/v1/exams',
    createExamRouter(authService, new ExamService(prisma, telegramService)),
  );
  app.use(
    '/api/v1/teachers',
    createTeacherPanelRouter(authService, new TeacherPanelService(prisma)),
  );
  const telegramRouter = createTelegramRouter(authService, telegramService);
  app.use('/api/v1/telegram-bot', telegramRouter);
  app.use('/api/v1/telegram', telegramRouter);


  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
