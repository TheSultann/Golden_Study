import type { PaginationMeta, Student, StudentStats } from '@golden-study/contracts'

export interface StudentRepository {
  list(): Promise<Student[]>;
  listPaginated?(params: {
    page: number;
    limit: number;
    status?: 'active' | 'frozen' | 'graduate' | 'all';
    search?: string;
  }): Promise<{ data: Student[]; meta: PaginationMeta }>;
  getStats?(): Promise<StudentStats>;
  save(student: Student): Promise<Student>;
  setStatus(id: string, status: Student['status']): Promise<Student>;
  delete(id: string): Promise<void>;
}

