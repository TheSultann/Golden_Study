import { z } from 'zod'
export const studentSchema = z.object({ id:z.string(), code:z.string(), firstName:z.string(), lastName:z.string(), birthDate:z.string(), phone:z.string(), parentName:z.string(), parentPhone:z.string(), address:z.string(), status:z.enum(['active','frozen','graduate']), balance:z.number().int(), groups:z.array(z.string()) })
export const studentListResponseSchema=z.object({data:z.array(studentSchema)}); export const studentResponseSchema=z.object({data:studentSchema}); export type Student=z.infer<typeof studentSchema>
