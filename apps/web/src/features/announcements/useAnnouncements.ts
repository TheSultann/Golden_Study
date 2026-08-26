import type { Announcement } from '@golden-study/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { announcementRepository } from './announcement.dependencies'

const key = ['announcements'] as const

export const useAnnouncements = () => useQuery({ queryKey: key, queryFn: () => announcementRepository.list() })

export function useSendAnnouncement() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (announcement: Announcement) => announcementRepository.send(announcement),
    onSuccess: async () => client.invalidateQueries({ queryKey: key }),
  })
}
