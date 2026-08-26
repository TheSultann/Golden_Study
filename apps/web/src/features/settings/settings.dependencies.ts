import { ApiSettingsRepository } from './apiSettings.repository'
import type { SettingsRepository } from './settings.repository'

export const settingsRepository: SettingsRepository = new ApiSettingsRepository()
