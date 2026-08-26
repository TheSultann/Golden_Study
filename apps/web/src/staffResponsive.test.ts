/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('mobile staff layout', () => {
  it('uses compact summary and card rows without horizontal scrolling', () => {
    expect(css).toContain('.staff-summary { grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(css).toContain('.staff-page .teachers-registry .table-scroll { overflow: visible; }')
    expect(css).toContain('.staff-page .teachers-registry td::before { content: attr(data-label);')
  })
})
