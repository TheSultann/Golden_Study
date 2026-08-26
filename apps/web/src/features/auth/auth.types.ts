export type UserRole = 'admin' | 'teacher'

export interface AuthUser {
  id: string
  login: string
  name: string
  role: UserRole
}
