import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

config({ path: '../../.env' })

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await hash('12345678', 12)
  const teacherObj = await prisma.teacher.findFirst()
  const user = await prisma.user.upsert({
    where: { login: 'teacher.teacher' },
    update: { passwordHash, isActive: true },
    create: {
      login: 'teacher.teacher',
      passwordHash,
      role: 'TEACHER',
      teacherId: teacherObj?.id ?? null,
      isActive: true,
    },
  })
  console.log(`UPDATED_USER: ${user.login}`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
