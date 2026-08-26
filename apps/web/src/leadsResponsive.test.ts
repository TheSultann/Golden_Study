/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('mobile leads board', () => {
  it('stacks compact columns without horizontal scrolling', () => {
    expect(css).toContain('.lead-board { grid-template-columns: minmax(0, 1fr); overflow-x: visible; }')
    expect(css).toContain('.lead-column { min-height: 0; }')
  })
})
