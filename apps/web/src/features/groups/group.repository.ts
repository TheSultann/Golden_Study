import type { Group, Student } from '@golden-study/contracts'
export interface GroupRepository {
  list(): Promise<Group[]>;
  save(group: Group): Promise<Group>;
  setActive(id: string, active: boolean): Promise<Group>;
  unlinkTelegram(id: string): Promise<Group>;
  listStudents(groupId: string): Promise<Student[]>;
  addStudent(groupId: string, studentId: string): Promise<void>;
  removeStudent(groupId: string, studentId: string): Promise<void>;
}


