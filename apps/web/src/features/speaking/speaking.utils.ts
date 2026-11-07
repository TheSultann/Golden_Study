import type { SpeakingSubmission } from '@golden-study/contracts'

import { getAccessToken } from '../../shared/api/httpClient'

export function getSubmissionAudioUrl(submission: SpeakingSubmission): string {
  const isDirectNonTelegram =
    submission.audioUrl &&
    (submission.audioUrl.startsWith('http://') ||
      submission.audioUrl.startsWith('https://') ||
      submission.audioUrl.startsWith('data:')) &&
    !submission.audioUrl.includes('api.telegram.org')

  if (isDirectNonTelegram) {
    return submission.audioUrl
  }

  const rawBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'
  const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '')
  const token = getAccessToken()
  const base = `${cleanBaseUrl}/speaking/submissions/${submission.id}/audio`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
