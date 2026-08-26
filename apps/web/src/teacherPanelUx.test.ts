/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readPage = (name: string) => readFileSync(resolve(process.cwd(), `src/pages/${name}.tsx`), 'utf8')

describe('teacher panel interaction safeguards', () => {
  it('protects unsaved attendance and disables redundant saving', () => {
    const page = readPage('TeacherAttendancePage')
    expect(page).toContain("import { ConfirmDialog }")
    expect(page).toContain('requestFilterChange')
    expect(page).toContain('disabled={!query.data || !isDirty || save.isPending}')
  })

  it('protects unsaved exam results and disables redundant saving', () => {
    const page = readPage('TeacherExamsPage')
    expect(page).toContain('requestExamChange')
    expect(page).toContain('disabled={save.isPending || !isDirty}')
    expect(page).toContain('<ConfirmDialog')
  })

  it('exposes the active schedule view to assistive technology', () => {
    const page = readPage('TeacherSchedulePage')
    expect(page).toContain("aria-pressed={view === 'cards'}")
    expect(page).toContain("aria-pressed={view === 'calendar'}")
  })
})
