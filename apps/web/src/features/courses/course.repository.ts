import type { Course } from '@golden-study/contracts'
export interface CourseRepository { list(): Promise<Course[]>; create(course: Course): Promise<Course>; update(course: Course): Promise<Course>; setActive(id: string, active: boolean): Promise<void> }
