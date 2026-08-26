import type { Student } from '@golden-study/contracts'
export interface StudentRepository {
  list(): Promise<Student[]>;
  save(student: Student): Promise<Student>;
  setStatus(id: string, status: Student['status']): Promise<Student>;
  delete(id: string): Promise<void>;
}

