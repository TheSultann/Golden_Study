import { centerSettingsResponseSchema, type CenterSettings } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { SettingsRepository } from './settings.repository'

export class ApiSettingsRepository implements SettingsRepository {
  async get() {
    const result = await apiRequest(
      '/settings',
      { method: 'GET' },
      centerSettingsResponseSchema,
    )
    return result.data
  }

  async save(settings: CenterSettings) {
    const result = await apiRequest(
      '/settings',
      { method: 'PATCH', body: JSON.stringify(settings) },
      centerSettingsResponseSchema,
    )
    return result.data
  }
}
