import { z } from 'zod'

export const staffRoleSchema = z.enum([
  'superadmin',
  'admin',
  'teacher',
])
export const staffStatusSchema = z.enum(['active', 'blocked', 'archived'])

export const staffMemberSchema = z.object({
  id: z.string(),
  fullName: z.string().min(1),
  login: z.string().min(1),
  phone: z.string().nullable(),
  role: staffRoleSchema,
  position: z.string().nullable().optional(),
  passportPinfl: z.string().nullable().optional(),
  hiredAt: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  salaryUzs: z.number().nullable().optional(),
  status: staffStatusSchema,
  linkedTeacherId: z.string().nullable(),
  linkedTeacherName: z.string().nullable().optional(),
  lastLoginAt: z.string().nullable(),
  lastSalaryPaidAt: z.string().nullable().optional(),
  createdAt: z.string(),
  password: z.string().min(6).optional(),
})

export const staffCreateInputSchema = staffMemberSchema
  .pick({
    fullName: true,
    login: true,
    phone: true,
    role: true,
  })
  .extend({
    password: z.string().min(8),
    position: z.string().optional(),
    passportPinfl: z.string().optional(),
    hiredAt: z.string().optional(),
    salaryUzs: z.number().optional(),
  })

export const staffPayoutInputSchema = z.object({
  amount: z.number().positive(),
  comment: z.string().optional(),
})

export const staffListResponseSchema = z.object({ data: z.array(staffMemberSchema) })
export const staffResponseSchema = z.object({ data: staffMemberSchema })

export type StaffRole = z.infer<typeof staffRoleSchema>
export type StaffStatus = z.infer<typeof staffStatusSchema>
export type StaffMember = z.infer<typeof staffMemberSchema>
export type StaffCreateInput = z.infer<typeof staffCreateInputSchema>
export type StaffPayoutInput = z.infer<typeof staffPayoutInputSchema>
