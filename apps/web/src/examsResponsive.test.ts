/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const page = readFileSync(resolve(process.cwd(), 'src/pages/ExamsPage.tsx'), 'utf8')

describe('exam result cards on mobile', () => {
  it('puts the student first and labels every result value', () => {
    expect(css).toContain('grid-template-areas:"student rank" "score percent" "comment comment"')
    expect(page).toContain('data-label="O‘quvchi"')
    expect(page).toContain('data-label="O‘rin"')
    expect(page).toContain('data-label="Ball"')
    expect(page).toContain('data-label="Natija"')
    expect(page).toContain('data-label="Izoh"')
  })

  it('places results on the left and archive on the right on desktop', () => {
    expect(css).toContain('.exams-layout { grid-template-columns: minmax(0, 1fr) 320px;')
    expect(css).toContain('.exams-main { grid-column: 1; grid-row: 1;')
    expect(css).toContain('.exams-list { grid-column: 2; grid-row: 1;')
  })
})
