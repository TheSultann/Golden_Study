export type ColorPalette = 'golden' | 'ocean'

export function getPaletteStorageKey(userId: string) {
  return `golden-study-palette-${userId}`
}

export function readPalette(userId: string): ColorPalette {
  return window.localStorage.getItem(getPaletteStorageKey(userId)) === 'ocean' ? 'ocean' : 'golden'
}

export function writePalette(userId: string, palette: ColorPalette) {
  window.localStorage.setItem(getPaletteStorageKey(userId), palette)
}
