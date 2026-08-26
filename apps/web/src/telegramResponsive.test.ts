/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const page = readFileSync(resolve(process.cwd(), 'src/pages/TelegramBotPage.tsx'), 'utf8')

describe('telegram mobile layout', () => {
  it('renders compact telegram mobile workflow', () => {
    expect(css).toContain('.telegram-summary { grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(css).toContain('.telegram-links .table-scroll,\n  .telegram-log .table-scroll { overflow: visible; }')
    expect(css).toContain('.telegram-links td::before,\n  .telegram-log td::before { content: attr(data-label);')
    expect(css).toContain('.telegram-actions { grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(page).toContain('className="telegram-approve-button"')
    expect(page).toContain('className="telegram-reject-button"')
    expect(css).toContain('.telegram-actions .telegram-approve-button {')
    expect(css).toContain('.telegram-actions .telegram-reject-button {')
  })
})
