import type { Exam, TeacherExamGroup } from '@golden-study/contracts'
export interface TeacherExamsRepository { list(): Promise<Exam[]>; listGroups(): Promise<TeacherExamGroup[]>; save(exam: Exam): Promise<Exam>; delete(id: string): Promise<void> }
