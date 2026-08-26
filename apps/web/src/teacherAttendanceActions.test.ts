/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'src/pages/TeacherAttendancePage.tsx'), 'utf8')
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('teacher attendance save action', () => {
  it('uses a compact table footer instead of a floating nested card', () => {
    expect(page).toContain('className="attendance-page teacher-attendance-page"')
    expect(css).toContain('.teacher-attendance-page .attendance-actions {')
    expect(css).toContain('margin: 0;')
    expect(css).toContain('box-shadow: none;')
    expect(css).toContain('border-radius: 0;')
  })
})
