/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('application scrollbars', () => {
  it('uses compact themed scrollbars without arrow buttons', () => {
    expect(css).toContain('scrollbar-width: thin')
    expect(css).toContain('::-webkit-scrollbar { width: 6px; height: 6px; }')
    expect(css).toContain('::-webkit-scrollbar-button { display: none; width: 0; height: 0; }')
  })
})
