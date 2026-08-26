import {
  authResponseSchema,
  authUserSchema,
  attendanceApiSchema,
  attendanceBulkSaveInputSchema,
  attendanceUpdateInputSchema,
  courseApiSchema,
  courseCreateInputSchema,
  groupApiSchema,
  groupCreateInputSchema,
  groupUpdateInputSchema,
  loginRequestSchema,
  leadApiSchema,
  leadConvertInputSchema,
  leadCreateInputSchema,
  leadStatusUpdateInputSchema,
  leadUpdateInputSchema,
  refreshResponseSchema,
  roomApiSchema,
  roomCreateInputSchema,
  sessionsResponseSchema,
  membershipApiSchema,
  membershipCreateInputSchema,
  studentApiSchema,
  studentCreateInputSchema,
  studentUpdateInputSchema,
  teacherApiSchema,
  teacherCreateInputSchema,
  teacherUpdateInputSchema,
  billingRunApiSchema,
  dailyBillingReconcileInputSchema,
  billingReconcileInputSchema,
  debtorApiSchema,
  financeSummaryApiSchema,
  ledgerEntryApiSchema,
  manualTransactionCreateInputSchema,
  paymentApiSchema,
  reversalInputSchema,
  studentPaymentCreateInputSchema,
  teacherKpiSummaryApiSchema,
  teacherPayoutInputSchema,
} from '@golden-study/contracts';
import { z } from 'zod';

const jsonContent = (schema: object) => ({
  'application/json': { schema },
});

const successResponse = (schema: string) => ({
  description: 'Successful response',
  content: jsonContent({ $ref: `#/components/schemas/${schema}` }),
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent({ $ref: '#/components/schemas/ErrorResponse' }),
});

const resourceResponse = (schema: string) => ({
  description: 'Successful response',
  content: jsonContent({
    type: 'object',
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', const: true },
      data: { $ref: `#/components/schemas/${schema}` },
    },
  }),
});

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
} as const;

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Golden Study CRM API',
    version: '0.2.0',
    description: 'Single-center Golden Study CRM backend API',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      refreshCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'golden_refresh',
      },
    },
    schemas: {
      LoginRequest: z.toJSONSchema(loginRequestSchema),
      AuthResponse: z.toJSONSchema(authResponseSchema),
      RefreshResponse: z.toJSONSchema(refreshResponseSchema),
      AuthUser: z.toJSONSchema(authUserSchema),
      Attendance: z.toJSONSchema(attendanceApiSchema),
      AttendanceBulkSaveInput: z.toJSONSchema(attendanceBulkSaveInputSchema),
      AttendanceUpdateInput: z.toJSONSchema(attendanceUpdateInputSchema),
      SessionsResponse: z.toJSONSchema(sessionsResponseSchema),
      Course: z.toJSONSchema(courseApiSchema),
      CourseCreateInput: z.toJSONSchema(courseCreateInputSchema),
      Group: z.toJSONSchema(groupApiSchema),
      GroupCreateInput: z.toJSONSchema(groupCreateInputSchema),
      GroupUpdateInput: z.toJSONSchema(groupUpdateInputSchema),
      Student: z.toJSONSchema(studentApiSchema),
      StudentCreateInput: z.toJSONSchema(studentCreateInputSchema),
      StudentUpdateInput: z.toJSONSchema(studentUpdateInputSchema),
      Membership: z.toJSONSchema(membershipApiSchema),
      MembershipCreateInput: z.toJSONSchema(membershipCreateInputSchema),
      Lead: z.toJSONSchema(leadApiSchema),
      LeadCreateInput: z.toJSONSchema(leadCreateInputSchema),
      LeadUpdateInput: z.toJSONSchema(leadUpdateInputSchema),
      LeadStatusUpdateInput: z.toJSONSchema(leadStatusUpdateInputSchema),
      LeadConvertInput: z.toJSONSchema(leadConvertInputSchema),
      Room: z.toJSONSchema(roomApiSchema),
      RoomCreateInput: z.toJSONSchema(roomCreateInputSchema),
      Teacher: z.toJSONSchema(teacherApiSchema),
      TeacherCreateInput: z.toJSONSchema(teacherCreateInputSchema),
      TeacherUpdateInput: z.toJSONSchema(teacherUpdateInputSchema),
      LedgerEntry: z.toJSONSchema(ledgerEntryApiSchema),
      Payment: z.toJSONSchema(paymentApiSchema),
      BillingRun: z.toJSONSchema(billingRunApiSchema),
      TeacherKpiSummary: z.toJSONSchema(teacherKpiSummaryApiSchema),
      FinanceSummary: z.toJSONSchema(financeSummaryApiSchema),
      Debtor: z.toJSONSchema(debtorApiSchema),
      ManualTransactionCreateInput: z.toJSONSchema(
        manualTransactionCreateInputSchema,
      ),
      StudentPaymentCreateInput: z.toJSONSchema(
        studentPaymentCreateInputSchema,
      ),
      ReversalInput: z.toJSONSchema(reversalInputSchema),
      DailyBillingReconcileInput: z.toJSONSchema(
        dailyBillingReconcileInputSchema,
      ),
      MonthlyBillingReconcileInput: z.toJSONSchema(
        billingReconcileInputSchema,
      ),
      TeacherPayoutInput: z.toJSONSchema(teacherPayoutInputSchema),
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', const: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Check API process health',
        responses: {
          '200': {
            description: 'API process is healthy',
            content: jsonContent({
              type: 'object',
              required: ['success', 'data'],
              properties: {
                success: { type: 'boolean', const: true },
                data: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string', const: 'ok' } },
                },
              },
            }),
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate user',
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/LoginRequest' }),
        },
        responses: {
          '200': successResponse('AuthResponse'),
          '400': errorResponse('Invalid request'),
          '401': errorResponse('Invalid credentials'),
          '429': errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token and issue access token',
        security: [{ refreshCookie: [] }],
        responses: {
          '200': successResponse('RefreshResponse'),
          '401': errorResponse('Invalid or expired refresh token'),
          '429': errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke current refresh session',
        security: [{ refreshCookie: [] }],
        responses: { '204': { description: 'Logged out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user',
            content: jsonContent({
              type: 'object',
              required: ['success', 'data'],
              properties: {
                success: { type: 'boolean', const: true },
                data: { $ref: '#/components/schemas/AuthUser' },
              },
            }),
          },
          '401': errorResponse('Authentication required'),
        },
      },
    },
    '/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'List active refresh sessions',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': successResponse('SessionsResponse'),
          '401': errorResponse('Authentication required'),
          '403': errorResponse('SUPER_ADMIN role required'),
        },
      },
    },
    '/courses': {
      get: {
        tags: ['Courses'],
        summary: 'List courses with pagination and filters',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Paginated course list' },
          '401': errorResponse('Authentication required'),
        },
      },
      post: {
        tags: ['Courses'],
        summary: 'Create course',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/CourseCreateInput',
          }),
        },
        responses: {
          '201': resourceResponse('Course'),
          '400': errorResponse('Invalid request'),
          '403': errorResponse('Admin role required'),
          '409': errorResponse('Course title already exists'),
        },
      },
    },
    '/courses/{id}': {
      get: {
        tags: ['Courses'],
        summary: 'Get course',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': resourceResponse('Course'),
          '404': errorResponse('Course not found'),
        },
      },
      patch: {
        tags: ['Courses'],
        summary: 'Update course',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/CourseCreateInput',
          }),
        },
        responses: {
          '200': resourceResponse('Course'),
          '400': errorResponse('Invalid request'),
          '403': errorResponse('Admin role required'),
          '409': errorResponse('Course title already exists'),
        },
      },
      delete: {
        tags: ['Courses'],
        summary: 'Deactivate course',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '204': { description: 'Course deactivated' },
          '409': errorResponse('Course has active groups'),
        },
      },
    },
    '/rooms': {
      get: {
        tags: ['Rooms'],
        summary: 'List rooms with pagination and filters',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated room list' } },
      },
      post: {
        tags: ['Rooms'],
        summary: 'Create room',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/RoomCreateInput',
          }),
        },
        responses: {
          '201': resourceResponse('Room'),
          '409': errorResponse('Room name already exists'),
        },
      },
    },
    '/rooms/{id}': {
      get: {
        tags: ['Rooms'],
        summary: 'Get room',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': resourceResponse('Room'),
          '404': errorResponse('Room not found'),
        },
      },
      patch: {
        tags: ['Rooms'],
        summary: 'Update room',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/RoomCreateInput',
          }),
        },
        responses: {
          '200': resourceResponse('Room'),
          '409': errorResponse('Room name already exists'),
        },
      },
      delete: {
        tags: ['Rooms'],
        summary: 'Deactivate room',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '204': { description: 'Room deactivated' },
          '409': errorResponse('Room has active groups'),
        },
      },
    },
    '/teachers': {
      get: {
        tags: ['Teachers'],
        summary: 'List teachers with pagination and filters',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Paginated teacher list' },
          '403': errorResponse('Admin role required'),
        },
      },
      post: {
        tags: ['Teachers'],
        summary: 'Create teacher and login',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/TeacherCreateInput',
          }),
        },
        responses: {
          '201': resourceResponse('Teacher'),
          '400': errorResponse('Invalid salary or input'),
          '403': errorResponse('Admin role required'),
          '409': errorResponse('Login already exists'),
        },
      },
    },
    '/teachers/{id}': {
      get: {
        tags: ['Teachers'],
        summary: 'Get teacher profile',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': resourceResponse('Teacher'),
          '403': errorResponse('Teacher may read only own profile'),
          '404': errorResponse('Teacher not found'),
        },
      },
      patch: {
        tags: ['Teachers'],
        summary: 'Update teacher and login',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/TeacherUpdateInput',
          }),
        },
        responses: {
          '200': resourceResponse('Teacher'),
          '400': errorResponse('Invalid salary or input'),
          '403': errorResponse('Admin role required'),
          '409': errorResponse('Login already exists'),
        },
      },
      delete: {
        tags: ['Teachers'],
        summary: 'Deactivate teacher and login',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '204': { description: 'Teacher deactivated' },
          '409': errorResponse('Teacher has active groups'),
        },
      },
    },
    '/groups': {
      get: {
        tags: ['Groups'],
        summary: 'List groups; teacher scope is applied server-side',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated group list' } },
      },
      post: {
        tags: ['Groups'],
        summary: 'Create group and validate schedule conflicts',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/GroupCreateInput',
          }),
        },
        responses: {
          '201': resourceResponse('Group'),
          '400': errorResponse('Invalid schedule'),
          '403': errorResponse('Admin role required'),
          '409': errorResponse('Teacher, room or name conflict'),
          '422': errorResponse('Inactive dependency'),
        },
      },
    },
    '/groups/{id}': {
      get: {
        tags: ['Groups'],
        summary: 'Get group',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': resourceResponse('Group'),
          '403': errorResponse('Teacher may read only own group'),
          '404': errorResponse('Group not found'),
        },
      },
      patch: {
        tags: ['Groups'],
        summary: 'Update group and recalculate end date',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/GroupUpdateInput',
          }),
        },
        responses: {
          '200': resourceResponse('Group'),
          '403': errorResponse('Admin role required'),
          '409': errorResponse('Schedule or name conflict'),
          '422': errorResponse('Inactive dependency'),
        },
      },
      delete: {
        tags: ['Groups'],
        summary: 'Archive group',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '204': { description: 'Group archived' },
          '404': errorResponse('Group not found'),
        },
      },
    },
    '/groups/{id}/students': {
      get: {
        tags: ['Memberships'],
        summary: 'List active students in group',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': { description: 'Student list' },
          '403': errorResponse('Teacher may read only own group'),
        },
      },
      post: {
        tags: ['Memberships'],
        summary: 'Add active student to active group',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/MembershipCreateInput',
          }),
        },
        responses: {
          '201': resourceResponse('Membership'),
          '409': errorResponse('Active membership exists'),
          '422': errorResponse('Student or group is inactive'),
        },
      },
    },
    '/groups/{id}/students/{studentId}': {
      delete: {
        tags: ['Memberships'],
        summary: 'Remove student and preserve membership history',
        security: [{ bearerAuth: [] }],
        parameters: [
          idParameter,
          {
            ...idParameter,
            name: 'studentId',
          },
        ],
        responses: {
          '204': { description: 'Membership closed as removed' },
          '404': errorResponse('Active membership not found'),
        },
      },
    },
    '/groups/{id}/students/{studentId}/graduate': {
      patch: {
        tags: ['Memberships'],
        summary: 'Graduate student from group',
        security: [{ bearerAuth: [] }],
        parameters: [
          idParameter,
          {
            ...idParameter,
            name: 'studentId',
          },
        ],
        responses: {
          '200': resourceResponse('Membership'),
          '404': errorResponse('Active membership not found'),
        },
      },
    },
    '/students': {
      get: {
        tags: ['Students'],
        summary: 'List students; teacher scope is applied server-side',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated student list' } },
      },
      post: {
        tags: ['Students'],
        summary: 'Create student with atomic ST code',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/StudentCreateInput',
          }),
        },
        responses: {
          '201': resourceResponse('Student'),
          '400': errorResponse('Invalid input'),
          '403': errorResponse('Admin role required'),
        },
      },
    },
    '/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Get student',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': resourceResponse('Student'),
          '403': errorResponse('Teacher may read only own student'),
          '404': errorResponse('Student not found'),
        },
      },
      patch: {
        tags: ['Students'],
        summary: 'Update student',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/StudentUpdateInput',
          }),
        },
        responses: {
          '200': resourceResponse('Student'),
          '403': errorResponse('Admin role required'),
        },
      },
      delete: {
        tags: ['Students'],
        summary: 'Archive student and close active memberships',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: { '204': { description: 'Student archived' } },
      },
    },
    '/students/{id}/freeze': {
      patch: {
        tags: ['Students'],
        summary: 'Freeze active student',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': resourceResponse('Student'),
          '422': errorResponse('Invalid state transition'),
        },
      },
    },
    '/students/{id}/unfreeze': {
      patch: {
        tags: ['Students'],
        summary: 'Unfreeze frozen student',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': resourceResponse('Student'),
          '422': errorResponse('Invalid state transition'),
        },
      },
    },
    '/leads': {
      get: {
        tags: ['Leads'],
        summary: 'List leads with funnel filters',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Paginated leads' },
          '403': errorResponse('Admin role required'),
        },
      },
      post: {
        tags: ['Leads'],
        summary: 'Create lead',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/LeadCreateInput' }),
        },
        responses: {
          '201': resourceResponse('Lead'),
          '422': errorResponse('Inactive course or teacher'),
        },
      },
    },
    '/leads/{id}': {
      get: {
        tags: ['Leads'],
        summary: 'Get lead',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': resourceResponse('Lead'),
          '404': errorResponse('Lead not found'),
        },
      },
      patch: {
        tags: ['Leads'],
        summary: 'Update non-terminal lead',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/LeadUpdateInput' }),
        },
        responses: {
          '200': resourceResponse('Lead'),
          '422': errorResponse('Terminal lead or inactive dependency'),
        },
      },
      delete: {
        tags: ['Leads'],
        summary: 'Archive lead',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '204': { description: 'Lead archived' },
          '422': errorResponse('Converted lead cannot archive'),
        },
      },
    },
    '/leads/{id}/status': {
      patch: {
        tags: ['Leads'],
        summary: 'Move lead through non-terminal funnel status',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/LeadStatusUpdateInput',
          }),
        },
        responses: {
          '200': resourceResponse('Lead'),
          '422': errorResponse('Lead is terminal'),
        },
      },
    },
    '/leads/{id}/convert': {
      post: {
        tags: ['Leads'],
        summary: 'Convert lead to student transactionally',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/LeadConvertInput' }),
        },
        responses: {
          '201': { description: 'Lead converted and student created' },
          '409': errorResponse('Lead already converted'),
          '422': errorResponse('Lead archived or group inactive'),
        },
      },
    },
    '/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'List attendance with server-side teacher scope',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated attendance' } },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Bulk upsert group attendance',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/AttendanceBulkSaveInput',
          }),
        },
        responses: {
          '200': { description: 'Attendance session saved' },
          '403': errorResponse('Ownership or admin lock'),
          '422': errorResponse('Membership inactive on date'),
        },
      },
    },
    '/attendance/group/{groupId}/date/{date}': {
      get: {
        tags: ['Attendance'],
        summary: 'Get attendance session for group and date',
        security: [{ bearerAuth: [] }],
        parameters: [
          { ...idParameter, name: 'groupId' },
          {
            name: 'date',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': { description: 'Attendance session' },
          '403': errorResponse('Teacher may read only own group'),
        },
      },
    },
    '/attendance/{id}': {
      patch: {
        tags: ['Attendance'],
        summary: 'Admin correction',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/AttendanceUpdateInput',
          }),
        },
        responses: {
          '200': resourceResponse('Attendance'),
          '403': errorResponse('Admin role required'),
          '422': errorResponse('Attendance reversed'),
        },
      },
      delete: {
        tags: ['Attendance'],
        summary: 'Soft reverse attendance',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '204': { description: 'Attendance reversed' },
          '403': errorResponse('Admin role required'),
        },
      },
    },
    '/students/{id}/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'Get student attendance history',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: {
          '200': { description: 'Paginated attendance history' },
          '403': errorResponse('Teacher may read only own student'),
        },
      },
    },
    '/transactions': {
      get: {
        tags: ['Finance'],
        summary: 'List immutable ledger entries',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated ledger entries' } },
      },
      post: {
        tags: ['Finance'],
        summary: 'Create manual center transaction',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/ManualTransactionCreateInput',
          }),
        },
        responses: { '201': resourceResponse('LedgerEntry') },
      },
    },
    '/transactions/{id}/reverse': {
      post: {
        tags: ['Finance'],
        summary: 'Reverse ledger entry',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/ReversalInput' }),
        },
        responses: { '201': resourceResponse('LedgerEntry') },
      },
    },
    '/payments/student': {
      post: {
        tags: ['Finance'],
        summary: 'Record student payment',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/StudentPaymentCreateInput',
          }),
        },
        responses: { '201': resourceResponse('Payment') },
      },
    },
    '/payments/{id}/reverse': {
      post: {
        tags: ['Finance'],
        summary: 'Reverse student payment',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/ReversalInput' }),
        },
        responses: { '201': resourceResponse('LedgerEntry') },
      },
    },
    '/students/{id}/transactions': {
      get: {
        tags: ['Finance'],
        summary: 'List student ledger entries',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: { '200': { description: 'Paginated ledger entries' } },
      },
    },
    '/billing/daily/reconcile': {
      post: {
        tags: ['Billing'],
        summary: 'Reconcile DAILY billing',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/DailyBillingReconcileInput',
          }),
        },
        responses: { '200': resourceResponse('BillingRun') },
      },
    },
    '/billing/monthly/reconcile': {
      post: {
        tags: ['Billing'],
        summary: 'Reconcile MONTHLY billing',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/MonthlyBillingReconcileInput',
          }),
        },
        responses: { '200': resourceResponse('BillingRun') },
      },
    },
    '/billing/runs': {
      get: {
        tags: ['Billing'],
        summary: 'List billing runs',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated billing runs' } },
      },
    },
    '/teachers/{id}/kpi': {
      get: {
        tags: ['KPI'],
        summary: 'Get computed teacher payable',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        responses: { '200': resourceResponse('TeacherKpiSummary') },
      },
    },
    '/teachers/{id}/payout': {
      post: {
        tags: ['KPI'],
        summary: 'Create teacher payout',
        security: [{ bearerAuth: [] }],
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: '#/components/schemas/TeacherPayoutInput',
          }),
        },
        responses: { '201': resourceResponse('LedgerEntry') },
      },
    },
    '/teachers/{id}/payouts/{payoutId}/reverse': {
      post: {
        tags: ['KPI'],
        summary: 'Reverse teacher payout',
        security: [{ bearerAuth: [] }],
        parameters: [
          idParameter,
          {
            name: 'payoutId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: '#/components/schemas/ReversalInput' }),
        },
        responses: { '201': resourceResponse('LedgerEntry') },
      },
    },
    '/finance/summary': {
      get: {
        tags: ['Finance'],
        summary: 'Get ledger-derived finance summary',
        security: [{ bearerAuth: [] }],
        responses: { '200': resourceResponse('FinanceSummary') },
      },
    },
    '/finance/debtors': {
      get: {
        tags: ['Finance'],
        summary: 'List debtors by computed student balance',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated debtors' } },
      },
    },
  },
} as const;
