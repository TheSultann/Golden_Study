/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\r\n/g, '\n')

describe('mobile schedule calendar', () => {
  it('uses one full-width column without horizontal scrolling', () => {
    expect(css).toContain('@media (max-width: 760px) {\n  .schedule-calendar { grid-template-columns: minmax(0, 1fr); overflow-x: visible; }')
    expect(css).toContain('.schedule-day { min-width: 0; }')
  })
})
