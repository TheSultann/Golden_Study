import type { CenterSettings } from '@golden-study/contracts'

export interface SettingsRepository {
  get(): Promise<CenterSettings>
  save(settings: CenterSettings): Promise<CenterSettings>
}
