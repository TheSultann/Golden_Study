import { beforeEach, describe, expect, it } from 'vitest'
import { getPaletteStorageKey, readPalette, writePalette } from './features/appearance/appearance'

describe('appearance storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('uses Golden when a saved value is missing or invalid', () => {
    expect(readPalette('admin-1')).toBe('golden')
    window.localStorage.setItem(getPaletteStorageKey('admin-1'), 'unknown')
    expect(readPalette('admin-1')).toBe('golden')
  })

  it('stores Ocean separately for each user', () => {
    writePalette('admin-1', 'ocean')

    expect(readPalette('admin-1')).toBe('ocean')
    expect(readPalette('teacher-1')).toBe('golden')
    expect(getPaletteStorageKey('admin-1')).toBe('golden-study-palette-admin-1')
  })
})
