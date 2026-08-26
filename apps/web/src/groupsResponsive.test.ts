/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('group modal responsive layout', () => {
  it('uses compact two-column mobile layout with internal scrolling', () => {
    expect(css).toContain('.group-modal { display: flex; max-height: calc(100dvh - 20px);')
    expect(css).toContain('.group-modal .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(css).toContain('.group-modal form { min-height: 0; overflow-y: auto;')
    expect(css).toContain('.group-modal form footer { position: sticky;')
  })

  it('uses the same compact mobile layout for the teacher form', () => {
    expect(css).toContain('.teacher-form-modal { width: min(100%, 560px);')
    expect(css).toContain('.teacher-form-modal > header { padding: 10px 16px 8px;')
    expect(css).toContain('.teacher-form-modal { display: flex; max-height: calc(100dvh - 20px);')
    expect(css).toContain('.teacher-form-modal .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(css).toContain('.teacher-form-modal form { min-height: 0; overflow-y: auto;')
    expect(css).toContain('.teacher-form-modal form footer { position: sticky;')
  })

  it('uses the compact desktop and mobile layout for the staff form', () => {
    expect(css).toContain('.staff-form-modal { width: min(100%, 560px);')
    expect(css).toContain('.staff-form-modal > header { padding: 10px 16px 8px;')
    expect(css).toContain('.staff-form-modal { display: flex; max-height: calc(100dvh - 20px);')
    expect(css).toContain('.staff-form-modal .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(css).toContain('.staff-form-modal form footer { position: sticky;')
  })
})
