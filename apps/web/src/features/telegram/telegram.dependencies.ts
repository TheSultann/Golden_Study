import { ApiTelegramBotRepository } from './apiTelegram.repository'
import type { TelegramBotRepository } from './telegram.repository'

export const telegramBotRepository: TelegramBotRepository = new ApiTelegramBotRepository()
