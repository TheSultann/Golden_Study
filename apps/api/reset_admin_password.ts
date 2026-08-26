import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

config({ path: '../../.env' })

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await hash('12345678', 12)
  const user = await prisma.user.upsert({
    where: { login: 'admin' },
    update: { passwordHash, isActive: true, role: 'SUPER_ADMIN' },
    create: {
      login: 'admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })
  console.log(`UPDATED_ADMIN_USER: ${user.login}`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
