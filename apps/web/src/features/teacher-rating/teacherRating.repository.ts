import type { TeacherRatingRow } from '@golden-study/contracts'
export interface TeacherRatingRepository { list(): Promise<TeacherRatingRow[]> }
