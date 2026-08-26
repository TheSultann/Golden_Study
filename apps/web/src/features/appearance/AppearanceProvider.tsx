import { type ReactNode, useMemo, useState } from 'react'
import { readPalette, writePalette, type ColorPalette } from './appearance'
import { AppearanceContext, type AppearanceValue } from './appearanceContext'

export function AppearanceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [palette, setPaletteState] = useState<ColorPalette>(() => readPalette(userId))
  const value = useMemo<AppearanceValue>(() => ({
    palette,
    setPalette(nextPalette) {
      writePalette(userId, nextPalette)
      setPaletteState(nextPalette)
    },
  }), [palette, userId])

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}
