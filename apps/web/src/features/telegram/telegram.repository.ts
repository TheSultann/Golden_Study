import type { TelegramBotOverview, TelegramLink, TelegramLinkStatus, TelegramNotificationLog, TelegramTriggerType } from '@golden-study/contracts'

export interface TelegramBotRepository {
  getOverview(): Promise<TelegramBotOverview>
  setLinkStatus(id: string, status: TelegramLinkStatus): Promise<TelegramLink>
  enqueueNotification(linkId: string, triggerType: TelegramTriggerType): Promise<TelegramNotificationLog>
}
