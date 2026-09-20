import type { AttendanceRow } from '@golden-study/contracts'

export function parseLessonPlan(raw: string): { topic: string; homeworkText: string } {
  if (!raw) return { topic: '', homeworkText: '' }
  const trimmed = raw.trim()
  const match = trimmed.match(/^Mavzu:\s*([^\n]+)(?:\n+(?:Vazifa:\s*)?([\s\S]*))?$/i)
  if (match) {
    return {
      topic: match[1]?.trim() ?? '',
      homeworkText: match[2]?.trim() ?? '',
    }
  }
  return { topic: '', homeworkText: trimmed }
}

export function formatLessonPlan(topic: string, homeworkText: string): string {
  const cleanTopic = topic.trim()
  const cleanHw = homeworkText.trim()
  if (cleanTopic && cleanHw) {
    return `Mavzu: ${cleanTopic}\nVazifa: ${cleanHw}`
  }
  if (cleanTopic) {
    return `Mavzu: ${cleanTopic}`
  }
  return cleanHw
}

export function calculateAttendanceAverage(
  ...scores: (number | null | undefined)[]
): number | null {
  const validScores = scores.filter(
    (s): s is number => typeof s === 'number' && !isNaN(s),
  )
  if (validScores.length === 0) {
    return null
  }
  const sum = validScores.reduce((acc, curr) => acc + curr, 0)
  return Math.round(sum / validScores.length)
}

export function parseScoreInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const num = parseInt(trimmed, 10)
  if (isNaN(num)) return null
  return Math.min(100, Math.max(0, num))
}

export function normalizeAttendanceRow(row: AttendanceRow): AttendanceRow {
  // Legacy all-zero unrated row: all 3 scores are literally 0, rating is 0/null, and homework was not done
  const isLegacyAllZero =
    !row.homeworkDone &&
    (row.rating === null || row.rating === 0 || row.rating === undefined) &&
    row.homeworkScore === 0 &&
    row.topicScore === 0 &&
    row.dictionaryScore === 0

  if (isLegacyAllZero) {
    return {
      ...row,
      homeworkScore: null,
      topicScore: null,
      dictionaryScore: null,
      rating: null,
    }
  }

  const hasSpecificScores =
    typeof row.homeworkScore === 'number' ||
    typeof row.topicScore === 'number' ||
    typeof row.dictionaryScore === 'number'

  if (hasSpecificScores) {
    return {
      ...row,
      homeworkScore: typeof row.homeworkScore === 'number' ? row.homeworkScore : null,
      topicScore: typeof row.topicScore === 'number' ? row.topicScore : null,
      dictionaryScore: typeof row.dictionaryScore === 'number' ? row.dictionaryScore : null,
      rating: typeof row.rating === 'number' ? row.rating : null,
    }
  }

  // Legacy rated row: historical single rating without 3-score breakdown
  if (typeof row.rating === 'number' && row.rating > 0) {
    return {
      ...row,
      homeworkScore: row.rating,
      topicScore: row.rating,
      dictionaryScore: row.rating,
      rating: row.rating,
    }
  }

  // Unrated row (null, undefined, or 0 rating with no scores)
  return {
    ...row,
    homeworkScore: null,
    topicScore: null,
    dictionaryScore: null,
    rating: null,
  }
}
