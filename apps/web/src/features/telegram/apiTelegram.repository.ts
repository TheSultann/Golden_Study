import { telegramBotOverviewResponseSchema, telegramLinkResponseSchema, telegramNotificationLogResponseSchema, type TelegramLinkStatus, type TelegramTriggerType } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { TelegramBotRepository } from './telegram.repository'

export class ApiTelegramBotRepository implements TelegramBotRepository {
  async getOverview() {
    const result = await apiRequest('/telegram-bot', { method: 'GET' }, telegramBotOverviewResponseSchema)
    return result.data
  }

  async setLinkStatus(id: string, status: TelegramLinkStatus) {
    const result = await apiRequest(
      `/telegram-bot/links/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      telegramLinkResponseSchema,
    )
    return result.data
  }

  async enqueueNotification(linkId: string, triggerType: TelegramTriggerType) {
    const result = await apiRequest(
      '/telegram-bot/notifications',
      { method: 'POST', body: JSON.stringify({ linkId, triggerType }) },
      telegramNotificationLogResponseSchema,
    )
    return result.data
  }
}
