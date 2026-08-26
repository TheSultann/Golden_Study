/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('reports responsive layout', () => {
  it('uses contextual summary and mobile cards', () => {
    expect(css).toContain('.reports-summary {')
    expect(css).toContain('.reports-page .finance-table td::before { content: attr(data-label);')
    expect(css).toContain('.reports-summary { grid-template-columns: repeat(2, minmax(0, 1fr));')
  })
})
