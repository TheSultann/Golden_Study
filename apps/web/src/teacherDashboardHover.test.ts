/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'src/pages/TeacherDashboardPage.tsx'), 'utf8')
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('teacher dashboard lesson hover', () => {
  it('fills the complete lesson row width', () => {
    expect(page).toContain('className="dashboard-page teacher-dashboard-page"')
    expect(css).toContain('.teacher-dashboard-page .lesson-list { padding-inline: 0; }')
    expect(css).toContain('.teacher-dashboard-page .lesson { padding-inline: 14px; border-radius: 0; }')
  })
})
