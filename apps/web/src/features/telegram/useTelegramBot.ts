import type { TelegramLinkStatus, TelegramTriggerType } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { telegramBotRepository } from './telegram.dependencies'

const telegramKey = ['telegram-bot'] as const

export const useTelegramBotOverview = () => useQuery({ queryKey: telegramKey, queryFn: () => telegramBotRepository.getOverview() })

export function useSetTelegramLinkStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TelegramLinkStatus }) => telegramBotRepository.setLinkStatus(id, status),
    onSuccess: async () => client.invalidateQueries({ queryKey: telegramKey }),
  })
}

export function useEnqueueTelegramNotification() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ linkId, triggerType }: { linkId: string; triggerType: TelegramTriggerType }) => telegramBotRepository.enqueueNotification(linkId, triggerType),
    onSuccess: async () => client.invalidateQueries({ queryKey: telegramKey }),
  })
}
