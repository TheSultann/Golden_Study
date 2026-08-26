/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('sidebar footer layout', () => {
  it('keeps the footer compact', () => {
    expect(css).toContain('.sidebar-footer { display: grid; gap: 5px; padding: 10px 12px;')
  })
})
