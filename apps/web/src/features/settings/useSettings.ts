import type { CenterSettings } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsRepository } from './settings.dependencies'

const settingsKey = ['settings'] as const

export const useSettings = () => useQuery({ queryKey: settingsKey, queryFn: () => settingsRepository.get() })

export function useSaveSettings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (settings: CenterSettings) => settingsRepository.save(settings),
    onSuccess: async () => client.invalidateQueries({ queryKey: settingsKey }),
  })
}
