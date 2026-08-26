import { paginationMetaSchema, roomApiSchema } from '@golden-study/contracts'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { apiRequest } from '../../shared/api/httpClient'

const roomListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(roomApiSchema),
  meta: paginationMetaSchema,
})

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await apiRequest('/rooms?limit=100', { method: 'GET' }, roomListApiResponseSchema)
      return res.data
    },
  })
}
