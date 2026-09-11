import { z } from 'zod'

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict()

export const booleanQuerySchema = z.enum(['true', 'false']).transform((value) => value === 'true')
export const uuidParamSchema = z.object({ id: z.string().uuid() }).strict()
export const lessonDurationMinutesSchema = z.union([
  z.literal(60),
  z.literal(90),
  z.literal(120),
  z.literal(150),
  z.literal(180),
])

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

export const courseCreateInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  durationMonths: z.number().int().min(1).max(36),
  pricePerMonthUzs: z.number().int().nonnegative(),
}).strict()

export const courseListQuerySchema = paginationQuerySchema.extend({
  isActive: booleanQuerySchema.optional(),
  sortBy: z.enum(['createdAt', 'title', 'pricePerMonthUzs']).default('createdAt'),
})

export const courseUpdateInputSchema = courseCreateInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
)

export const courseStatusUpdateInputSchema = z.object({
  isActive: z.boolean(),
}).strict()

export const courseApiSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  durationMonths: z.number().int(),
  pricePerMonthUzs: z.number().int(),
  isActive: z.boolean(),
  groupsCount: z.number().int().nonnegative(),
  studentsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const roomCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
}).strict()

export const roomListQuerySchema = paginationQuerySchema.extend({
  isActive: booleanQuerySchema.optional(),
  sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
})

export const roomUpdateInputSchema = roomCreateInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
)

export const roomApiSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const teacherBaseInputSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+998\d{9}$/),
  login: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
})

const teacherSalarySchema = z.discriminatedUnion('salaryType', [
  z.object({
    salaryType: z.literal('FIXED'),
    fixedSalaryUzs: z.number().int().nonnegative(),
  }),
  z.object({
    salaryType: z.literal('PER_STUDENT'),
    perStudentRateUzs: z.number().int().nonnegative(),
  }),
  z.object({
    salaryType: z.literal('PERCENT'),
    kpiRateBasisPoints: z.number().int().min(0).max(10_000),
  }),
])

export const teacherCreateInputSchema = z
  .intersection(teacherBaseInputSchema, teacherSalarySchema)

export const teacherUpdateInputSchema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().regex(/^\+998\d{9}$/).optional(),
  login: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  password: z.string().min(8).max(128).optional(),
  salaryType: z.enum(['FIXED', 'PER_STUDENT', 'PERCENT']).optional(),
  fixedSalaryUzs: z.number().int().nonnegative().optional(),
  perStudentRateUzs: z.number().int().nonnegative().optional(),
  kpiRateBasisPoints: z.number().int().min(0).max(10_000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).superRefine((value, context) => {
  const requiredField = value.salaryType === 'FIXED'
    ? 'fixedSalaryUzs'
    : value.salaryType === 'PER_STUDENT'
      ? 'perStudentRateUzs'
      : value.salaryType === 'PERCENT'
        ? 'kpiRateBasisPoints'
        : null
  if (requiredField && value[requiredField] === undefined) {
    context.addIssue({
      code: 'custom',
      path: [requiredField],
      message: `${requiredField} is required for ${value.salaryType}`,
    })
  }
})

export const teacherListQuerySchema = paginationQuerySchema.extend({
  isActive: booleanQuerySchema.optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'lastName']).default('createdAt'),
})

export const teacherApiSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  salaryType: z.enum(['FIXED', 'PER_STUDENT', 'PERCENT']),
  fixedSalaryUzs: z.number().int().nullable(),
  perStudentRateUzs: z.number().int().nullable(),
  kpiRateBasisPoints: z.number().int().nullable(),
  login: z.string().nullable(),
  isActive: z.boolean(),
  groupsCount: z.number().int().nonnegative(),
  groups: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const weekdaySchema = z.enum([
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
])
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const groupCreateInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  courseId: z.string().uuid(),
  teacherId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  weekdays: z.array(weekdaySchema).min(1).max(7).refine(
    (days) => new Set(days).size === days.length,
    'Weekdays must be unique',
  ),
  lessonStartMinutes: z.number().int().min(0).max(1439),
  lessonDurationMinutes: lessonDurationMinutesSchema.default(90),
  startDate: dateOnlySchema,
}).strict().refine(
  (value) => value.lessonStartMinutes + value.lessonDurationMinutes <= 1440,
  { path: ['lessonDurationMinutes'], message: 'Lesson must end before midnight' },
)

export const groupUpdateInputSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  courseId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  roomId: z.string().uuid().nullable().optional(),
  weekdays: z.array(weekdaySchema).min(1).max(7).refine(
    (days) => new Set(days).size === days.length,
    'Weekdays must be unique',
  ).optional(),
  lessonStartMinutes: z.number().int().min(0).max(1439).optional(),
  lessonDurationMinutes: lessonDurationMinutesSchema.optional(),
  startDate: dateOnlySchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
})

export const groupStatusUpdateInputSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']),
}).strict()

export const groupListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  courseId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  sortBy: z.enum(['createdAt', 'name', 'startDate']).default('createdAt'),
})

export const groupApiSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  teacherId: z.string().uuid(),
  teacherName: z.string(),
  roomId: z.string().uuid().nullable(),
  roomName: z.string().nullable(),
  weekdays: z.array(weekdaySchema),
  lessonStartMinutes: z.number().int(),
  lessonDurationMinutes: lessonDurationMinutesSchema,
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']),
  studentsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const studentCreateInputSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  birthDate: dateOnlySchema.nullable().optional(),
  phone: z.string().trim().regex(/^\+998\d{9}$/).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  parentName: z.string().trim().max(160).nullable().optional(),
  parentPhone: z.string().trim().regex(/^\+998\d{9}$/).nullable().optional(),
}).strict()

export const studentUpdateInputSchema = studentCreateInputSchema.partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const studentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['ACTIVE', 'FROZEN', 'GRADUATE', 'ARCHIVED']).optional(),
  groupId: z.string().uuid().optional(),
  sortBy: z.enum(['createdAt', 'studentCode', 'firstName', 'lastName'])
    .default('createdAt'),
})

export const studentApiSchema = z.object({
  id: z.string().uuid(),
  studentCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: dateOnlySchema.nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  parentName: z.string().nullable(),
  parentPhone: z.string().nullable(),
  status: z.enum(['ACTIVE', 'FROZEN', 'GRADUATE', 'ARCHIVED']),
  activeGroups: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const membershipCreateInputSchema = z.object({
  studentId: z.string().uuid(),
}).strict()

export const membershipApiSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  studentId: z.string().uuid(),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().nullable(),
  status: z.enum(['ACTIVE', 'GRADUATE', 'REMOVED']),
})

export const leadApiStatusSchema = z.enum([
  'NEW', 'CONTACTED', 'CALLBACK', 'TRIAL', 'CONVERTED', 'ARCHIVED',
])
export const leadCreateInputSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().regex(/^\+998\d{9}$/),
  interestedCourseId: z.string().uuid().nullable().optional(),
  teacherId: z.string().uuid().nullable().optional(),
  comment: z.string().trim().max(2000).default(''),
}).strict()
export const leadUpdateInputSchema = leadCreateInputSchema.partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
export const leadStatusUpdateInputSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CALLBACK', 'TRIAL']),
}).strict()
export const leadConvertInputSchema = z.object({
  groupId: z.string().uuid().optional(),
}).strict()
export const leadListQuerySchema = paginationQuerySchema.extend({
  status: leadApiStatusSchema.optional(),
  interestedCourseId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  sortBy: z.enum(['createdAt', 'fullName', 'status']).default('createdAt'),
})
export const leadApiSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  phone: z.string(),
  interestedCourseId: z.string().uuid().nullable(),
  interestedCourseTitle: z.string().nullable(),
  teacherId: z.string().uuid().nullable(),
  teacherName: z.string().nullable(),
  status: leadApiStatusSchema,
  comment: z.string(),
  convertedStudentId: z.string().uuid().nullable().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const attendanceApiStatusSchema = z.enum(['CAME', 'EXCUSED', 'ABSENT'])
const attendanceItemBaseSchema = z.object({
  studentId: z.string().uuid(),
  status: attendanceApiStatusSchema,
  rating: z.number().int().min(0).max(100).nullable(),
  homeworkDone: z.boolean(),
  comment: z.string().trim().max(1000).default(''),
}).strict()
const requireCameRating = (
  value: { status: 'CAME' | 'EXCUSED' | 'ABSENT'; rating: number | null },
  context: z.RefinementCtx,
) => {
  if (value.status === 'CAME' && value.rating === null) {
    context.addIssue({
      code: 'custom',
      path: ['rating'],
      message: 'Rating is required for CAME',
    })
  }
}
const attendanceItemInputSchema = attendanceItemBaseSchema
  .superRefine(requireCameRating)
export const attendanceBulkSaveInputSchema = z.object({
  groupId: z.string().uuid(),
  date: dateOnlySchema,
  items: z.array(attendanceItemInputSchema).min(1).max(200),
}).strict().refine(
  (value) =>
    new Set(value.items.map((item) => item.studentId)).size ===
    value.items.length,
  { path: ['items'], message: 'Student IDs must be unique' },
)
export const attendanceUpdateInputSchema = attendanceItemBaseSchema
  .omit({ studentId: true })
  .superRefine(requireCameRating)
export const attendanceListQuerySchema = paginationQuerySchema.extend({
  groupId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: attendanceApiStatusSchema.optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
  sortBy: z.enum(['date', 'createdAt']).default('date'),
}).refine(
  (value) =>
    !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
  { path: ['dateTo'], message: 'dateTo must not be before dateFrom' },
)
export const attendanceSessionParamsSchema = z.object({
  groupId: z.string().uuid(),
  date: dateOnlySchema,
}).strict()
export const attendanceApiSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  groupName: z.string(),
  studentId: z.string().uuid(),
  studentCode: z.string(),
  studentName: z.string(),
  date: dateOnlySchema,
  status: attendanceApiStatusSchema,
  rating: z.number().int().min(0).max(100).nullable(),
  homeworkDone: z.boolean(),
  comment: z.string(),
  lockedByAdmin: z.boolean(),
  isReversed: z.boolean(),
  operationKey: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const ledgerDirectionSchema = z.enum(['CREDIT', 'DEBIT'])
export const ledgerAccountTypeSchema = z.enum(['STUDENT', 'TEACHER', 'CENTER'])
export const ledgerCategorySchema = z.enum([
  'STUDENT_PAYMENT',
  'DAILY_LESSON_CHARGE',
  'MONTHLY_TUITION_CHARGE',
  'KPI_PERCENT_ACCRUAL',
  'KPI_PER_STUDENT_ACCRUAL',
  'KPI_FIXED_ACCRUAL',
  'TEACHER_PAYOUT',
  'STAFF_PAYOUT',
  'MANUAL_INCOME',
  'MANUAL_EXPENSE',
  'ADJUSTMENT',
  'REVERSAL',
])
export const paymentMethodSchema = z.enum([
  'CASH', 'CLICK', 'PAYME', 'UZUM', 'TERMINAL', 'BANK',
])
export const studentPaymentCreateInputSchema = z.object({
  studentId: z.string().uuid(),
  groupId: z.string().uuid().nullable().optional(),
  amountUzs: z.number().int().positive(),
  method: paymentMethodSchema,
  comment: z.string().trim().max(1000).default(''),
  idempotencyKey: z.string().trim().min(3).max(120).optional(),
}).strict()
export const manualTransactionCreateInputSchema = z.object({
  direction: ledgerDirectionSchema,
  amountUzs: z.number().int().positive(),
  categoryLabel: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(2).max(160),
  comment: z.string().trim().max(1000).default(''),
  idempotencyKey: z.string().trim().min(3).max(120).optional(),
}).strict()
export const reversalInputSchema = z.object({
  comment: z.string().trim().min(2).max(1000),
}).strict()
export const transactionListQuerySchema = paginationQuerySchema.extend({
  accountType: ledgerAccountTypeSchema.optional(),
  studentId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  direction: ledgerDirectionSchema.optional(),
  category: ledgerCategorySchema.optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
  sortBy: z.enum(['createdAt', 'amountUzs']).default('createdAt'),
}).refine(
  (value) =>
    !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
  { path: ['dateTo'], message: 'dateTo must not be before dateFrom' },
)
export const ledgerEntryApiSchema = z.object({
  id: z.string().uuid(),
  accountType: ledgerAccountTypeSchema,
  studentId: z.string().uuid().nullable(),
  teacherId: z.string().uuid().nullable(),
  direction: ledgerDirectionSchema,
  category: ledgerCategorySchema,
  amountUzs: z.number().int().positive(),
  operationKey: z.string(),
  sourceType: z.enum([
    'ATTENDANCE', 'MONTHLY_BILLING', 'PAYMENT', 'KPI', 'PAYOUT', 'MANUAL',
    'REVERSAL',
  ]),
  sourceId: z.string().nullable(),
  reversalOfId: z.string().uuid().nullable(),
  comment: z.string(),
  createdAt: z.string().datetime(),
})
export const paymentApiSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  groupId: z.string().uuid().nullable(),
  amountUzs: z.number().int().positive(),
  method: paymentMethodSchema,
  comment: z.string(),
  ledgerEntry: ledgerEntryApiSchema,
  createdAt: z.string().datetime(),
})
export const billingReconcileInputSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
}).strict()
export const dailyBillingReconcileInputSchema = z.object({
  date: dateOnlySchema,
}).strict()
export const billingRunListQuerySchema = paginationQuerySchema.extend({
  mode: z.enum(['DAILY', 'MONTHLY']).optional(),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']).optional(),
  sortBy: z.enum(['startedAt', 'periodKey']).default('startedAt'),
})
export const billingRunApiSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(['DAILY', 'MONTHLY']),
  periodKey: z.string(),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']),
  processed: z.number().int().nonnegative(),
  createdCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  errorSummary: z.string().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
})
export const teacherPayoutInputSchema = z.object({
  amountUzs: z.number().int().positive(),
  comment: z.string().trim().min(2).max(1000),
  idempotencyKey: z.string().trim().min(3).max(120).optional(),
}).strict()
export const teacherKpiSummaryApiSchema = z.object({
  teacherId: z.string().uuid(),
  creditsUzs: z.number().int().nonnegative(),
  debitsUzs: z.number().int().nonnegative(),
  payableUzs: z.number().int(),
})
export const financeSummaryApiSchema = z.object({
  incomeUzs: z.number().int().nonnegative(),
  expenseUzs: z.number().int().nonnegative(),
  netCashflowUzs: z.number().int(),
  studentDebtUzs: z.number().int().nonnegative(),
  teacherPayableUzs: z.number().int().nonnegative(),
})
export const debtorListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  sortBy: z.enum(['debtUzs', 'studentName']).default('debtUzs'),
})
export const debtorApiSchema = z.object({
  studentId: z.string().uuid(),
  studentCode: z.string(),
  studentName: z.string(),
  balanceUzs: z.number().int().negative(),
  debtUzs: z.number().int().positive(),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>
export type PaginationMeta = z.infer<typeof paginationMetaSchema>
export type CourseCreateInput = z.infer<typeof courseCreateInputSchema>
export type CourseUpdateInput = z.infer<typeof courseUpdateInputSchema>
export type CourseStatusUpdateInput = z.infer<typeof courseStatusUpdateInputSchema>
export type CourseListQuery = z.infer<typeof courseListQuerySchema>
export type CourseApi = z.infer<typeof courseApiSchema>
export type RoomCreateInput = z.infer<typeof roomCreateInputSchema>
export type RoomUpdateInput = z.infer<typeof roomUpdateInputSchema>
export type RoomListQuery = z.infer<typeof roomListQuerySchema>
export type RoomApi = z.infer<typeof roomApiSchema>
export type TeacherCreateInput = z.infer<typeof teacherCreateInputSchema>
export type TeacherUpdateInput = z.infer<typeof teacherUpdateInputSchema>
export type TeacherListQuery = z.infer<typeof teacherListQuerySchema>
export type TeacherApi = z.infer<typeof teacherApiSchema>
export type GroupCreateInput = z.infer<typeof groupCreateInputSchema>
export type GroupUpdateInput = z.infer<typeof groupUpdateInputSchema>
export type GroupStatusUpdateInput = z.infer<typeof groupStatusUpdateInputSchema>
export type GroupListQuery = z.infer<typeof groupListQuerySchema>
export type GroupApi = z.infer<typeof groupApiSchema>
export type StudentCreateInput = z.infer<typeof studentCreateInputSchema>
export type StudentUpdateInput = z.infer<typeof studentUpdateInputSchema>
export type StudentListQuery = z.infer<typeof studentListQuerySchema>
export type StudentApi = z.infer<typeof studentApiSchema>
export type MembershipApi = z.infer<typeof membershipApiSchema>
export type LeadCreateInput = z.infer<typeof leadCreateInputSchema>
export type LeadUpdateInput = z.infer<typeof leadUpdateInputSchema>
export type LeadListQuery = z.infer<typeof leadListQuerySchema>
export type LeadApi = z.infer<typeof leadApiSchema>
export type AttendanceBulkSaveInput = z.infer<typeof attendanceBulkSaveInputSchema>
export type AttendanceUpdateInput = z.infer<typeof attendanceUpdateInputSchema>
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>
export type AttendanceApi = z.infer<typeof attendanceApiSchema>
export type StudentPaymentCreateInput = z.infer<typeof studentPaymentCreateInputSchema>
export type ManualTransactionCreateInput = z.infer<typeof manualTransactionCreateInputSchema>
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>
export type LedgerEntryApi = z.infer<typeof ledgerEntryApiSchema>
export type PaymentApi = z.infer<typeof paymentApiSchema>
export type BillingRunApi = z.infer<typeof billingRunApiSchema>
export type BillingRunListQuery = z.infer<typeof billingRunListQuerySchema>
export type TeacherPayoutInput = z.infer<typeof teacherPayoutInputSchema>
export type TeacherKpiSummaryApi = z.infer<typeof teacherKpiSummaryApiSchema>
export type FinanceSummaryApi = z.infer<typeof financeSummaryApiSchema>
export type DebtorListQuery = z.infer<typeof debtorListQuerySchema>
export type DebtorApi = z.infer<typeof debtorApiSchema>
