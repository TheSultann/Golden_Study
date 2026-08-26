import type { Announcement } from '@golden-study/contracts'

export interface AnnouncementRepository {
  list(): Promise<Announcement[]>
  send(announcement: Announcement): Promise<Announcement>
}
