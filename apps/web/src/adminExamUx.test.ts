/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'src/pages/ExamsPage.tsx'), 'utf8')

describe('admin exam draft protection', () => {
  it('keeps the active draft during search and confirms archive changes', () => {
    expect(page).toContain("import { ConfirmDialog }")
    expect(page).toContain('requestExamChange')
    expect(page).toContain('const selected = exams.find')
    expect(page).toContain('<ConfirmDialog')
  })
})
