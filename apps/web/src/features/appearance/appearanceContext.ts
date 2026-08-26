import { createContext, useContext } from 'react'
import type { ColorPalette } from './appearance'

export type AppearanceValue = {
  palette: ColorPalette
  setPalette: (palette: ColorPalette) => void
}

export const AppearanceContext = createContext<AppearanceValue | null>(null)

export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider')
  return value
}
