import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { parse } from 'dotenv'
import fs from 'fs'
import path from 'path'

try {
  const envConfig = parse(fs.readFileSync(path.resolve(__dirname, '../../../../.env')))
  if (envConfig.SEED_ADMIN_PASSWORD) {
    process.env.SEED_ADMIN_PASSWORD = envConfig.SEED_ADMIN_PASSWORD
  }
  if (envConfig.SEED_TEACHER_PASSWORD) {
    process.env.SEED_TEACHER_PASSWORD = envConfig.SEED_TEACHER_PASSWORD
  }
} catch {
  // Ignore env loading errors
}

afterEach(cleanup)


