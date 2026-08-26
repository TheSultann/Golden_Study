import { announcementListResponseSchema, announcementResponseSchema, type Announcement } from '@golden-study/contracts'

import { apiRequest } from '../../shared/api/httpClient'
import type { AnnouncementRepository } from './announcement.repository'

export class ApiAnnouncementRepository implements AnnouncementRepository {
  async list() {
    const response = await apiRequest('/announcements', { method: 'GET' }, announcementListResponseSchema)
    return response.data
  }

  async send(announcement: Announcement) {
    const response = await apiRequest(
      '/announcements',
      { method: 'POST', body: JSON.stringify(announcement) },
      announcementResponseSchema,
    )
    return response.data
  }
}
