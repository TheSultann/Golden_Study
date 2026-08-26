/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('mobile finance layout', () => {
  it('uses a compact summary and card rows without horizontal scrolling', () => {
    expect(css).toContain('.finance-summary { grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(css).toContain('.finance-table .table-scroll { overflow: visible; }')
    expect(css).toContain('.finance-table td::before { content: attr(data-label);')
  })
})
