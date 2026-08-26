import {
  leadApiSchema,
  paginationMetaSchema,
  type Lead,
  type LeadStatus,
} from '@golden-study/contracts'
import { z } from 'zod'

import { apiRequest, apiRequestVoid } from '../../shared/api/httpClient'
import type { LeadRepository } from './lead.repository'


const leadListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(leadApiSchema),
  meta: paginationMetaSchema.optional(),
})

const leadApiResponseSchema = z.object({
  success: z.literal(true),
  data: leadApiSchema,
})

function mapApiToUiStatus(status: string): LeadStatus {
  switch (status) {
    case 'NEW':
      return 'new'
    case 'CONTACTED':
      return 'contacted'
    case 'CALLBACK':
      return 'callback'
    case 'TRIAL':
      return 'trial'
    case 'CONVERTED':
      return 'converted'
    default:
      return 'new'
  }
}

function mapUiToApiStatus(status: LeadStatus): 'NEW' | 'CONTACTED' | 'CALLBACK' | 'TRIAL' {
  switch (status) {
    case 'new':
      return 'NEW'
    case 'contacted':
      return 'CONTACTED'
    case 'callback':
      return 'CALLBACK'
    case 'trial':
      return 'TRIAL'
    default:
      return 'NEW'
  }
}

function toUiLead(api: z.infer<typeof leadApiSchema>): Lead {
  return {
    id: api.id,
    fullName: api.fullName,
    phone: api.phone,
    course: api.interestedCourseTitle || (api.interestedCourseId ? `Kurs (#${api.interestedCourseId.slice(0, 6)})` : ''),
    teacher: api.teacherName || (api.teacherId ? `O‘qituvchi (#${api.teacherId.slice(0, 6)})` : ''),
    status: mapApiToUiStatus(api.status),
    comment: api.comment || '',
    createdAt: api.createdAt,
  }
}


export class ApiLeadRepository implements LeadRepository {
  async list(): Promise<Lead[]> {
    const response = await apiRequest(
      '/leads?limit=100',
      { method: 'GET' },
      leadListApiResponseSchema,
    )
    return response.data.filter((item) => item.status !== 'ARCHIVED').map(toUiLead)
  }


  async save(lead: Lead): Promise<Lead> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lead.id)
    const isNew = !isUuid || lead.id.startsWith('lead-') || lead.id.startsWith('new-')

    const digits = lead.phone.replace(/\D/g, '')
    const formattedPhone =
      digits.length === 9
        ? `+998${digits}`
        : digits.length === 12 && digits.startsWith('998')
          ? `+${digits}`
          : lead.phone.trim() || '+998900000000'

    const isCourseUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lead.course || '')
    const isTeacherUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lead.teacher || '')

    const payload = {
      fullName: lead.fullName.trim() || 'Lid',
      phone: formattedPhone,
      comment: (lead.comment || '').trim(),
      interestedCourseId: isCourseUuid ? lead.course : null,
      teacherId: isTeacherUuid ? lead.teacher : null,
    }



    if (isNew) {
      const response = await apiRequest(
        '/leads',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        leadApiResponseSchema,
      )
      return toUiLead(response.data)
    }

    const response = await apiRequest(
      `/leads/${lead.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      leadApiResponseSchema,
    )
    return toUiLead(response.data)
  }

  async move(id: string, status: LeadStatus): Promise<Lead> {
    if (status === 'converted') {
      const response = await apiRequest(
        `/leads/${id}/convert`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
        z.object({
          success: z.literal(true),
          data: z.object({
            lead: leadApiSchema,
            student: z.unknown(),
          }),
        }),
      )
      return toUiLead(response.data.lead)
    }

    const response = await apiRequest(
      `/leads/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: mapUiToApiStatus(status) }),
      },
      leadApiResponseSchema,
    )
    return toUiLead(response.data)
  }

  async archive(id: string): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (!isUuid) return
    await apiRequestVoid(`/leads/${id}`, { method: 'DELETE' })
  }
}


