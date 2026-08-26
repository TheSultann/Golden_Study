import { ApiAnnouncementRepository } from './apiAnnouncement.repository'
import type { AnnouncementRepository } from './announcement.repository'

export const announcementRepository: AnnouncementRepository = new ApiAnnouncementRepository()
