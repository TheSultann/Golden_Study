import { z } from 'zod'

export const authRoleSchema = z.enum(['SUPER_ADMIN', 'ADMIN', 'TEACHER'])

export const loginRequestSchema = z.object({
  login: z.string().trim().toLowerCase().min(3).max(64),
  password: z.string().min(8).max(128),
})

export const authUserSchema = z.object({
  id: z.string().uuid(),
  login: z.string(),
  role: authRoleSchema,
  teacherId: z.string().uuid().nullable(),
})

export const authTokenDataSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
})

export const refreshTokenDataSchema = z.object({
  accessToken: z.string().min(1),
  expiresInSeconds: z.number().int().positive(),
})

export const authResponseSchema = z.object({
  success: z.literal(true),
  data: authTokenDataSchema,
})

export const refreshResponseSchema = z.object({
  success: z.literal(true),
  data: refreshTokenDataSchema,
})

export const sessionSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
})

export const sessionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(sessionSchema),
})

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(128),
})

export type AuthRole = z.infer<typeof authRoleSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type AuthTokenData = z.infer<typeof authTokenDataSchema>
export type RefreshTokenData = z.infer<typeof refreshTokenDataSchema>
export type AuthSession = z.infer<typeof sessionSchema>
