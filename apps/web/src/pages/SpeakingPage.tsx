import type {
  GradeSpeakingSubmissionInput,
  SpeakingSubmission,
} from '@golden-study/contracts'
import {
  AlertCircle,
  Award,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  Mic,
  MicOff,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { getSession } from '../features/auth/auth.service'
import { useGroups, useGroupStudents } from '../features/groups/useGroups'
import {
  useGradeSpeakingSubmission,
  useGradeStudentSpeaking,
  useSpeakingSubmissions,
} from '../features/speaking/useSpeaking'
import { getSubmissionAudioUrl } from '../features/speaking/speaking.utils'
import { useTeacherExamGroups } from '../features/teacher-exams/useTeacherExams'
import { Select, type SelectOption } from '../shared/ui/Select'

export interface GradingTarget {
  submissionId?: string
  studentId: string
  studentName: string
  studentCode: string
  aiScore?: number | null
  teacherScore?: number | null
  teacherComment?: string | null
  transcript?: string
  durationSeconds?: number
  audioUrl?: string
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}.${month}.${year}`
  } catch {
    return iso
  }
}

export interface SpeakingLeaderboardEntry {
  studentId: string
  studentName: string
  studentCode: string
  rank: number | null
  gradedCount: number
  totalCount: number
  averageScore: number | null
  bestScore: number | null
  latestScore: number | null
  submissions: SpeakingSubmission[]
}

export function SpeakingPage() {
  const session = getSession()
  const isTeacher = session?.role === 'teacher'

  // Admin groups vs Teacher groups
  const adminGroupsQuery = useGroups()
  const teacherGroupsQuery = useTeacherExamGroups()
  const groups = useMemo(() => {
    if (isTeacher) {
      return (teacherGroupsQuery.data ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        active: true,
      }))
    }
    return (adminGroupsQuery.data ?? [])
      .filter((g) => g.active !== false)
      .map((g) => ({
        id: g.id,
        name: g.name,
        active: true,
      }))
  }, [isTeacher, adminGroupsQuery.data, teacherGroupsQuery.data])

  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const currentGroupId =
    (groups.some((g) => g.id === selectedGroupId) ? selectedGroupId : '') ||
    groups[0]?.id ||
    ''

  // Fetch group enrolled students and submissions for the current group
  const groupStudentsQuery = useGroupStudents(currentGroupId)
  const groupStudents = useMemo(
    () => groupStudentsQuery.data ?? [],
    [groupStudentsQuery.data],
  )

  const submissionsQuery = useSpeakingSubmissions(
    currentGroupId ? { groupId: currentGroupId } : undefined,
    { enabled: Boolean(currentGroupId) },
  )
  const submissions = useMemo(
    () => submissionsQuery.data ?? [],
    [submissionsQuery.data],
  )

  // Filter & Search states
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_AI' | 'EVALUATED_BY_AI' | 'GRADED_BY_TEACHER'>('ALL')
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null)
  const [gradingTarget, setGradingTarget] = useState<GradingTarget | null>(null)

  // Isolated Speaking Leaderboard calculation for this group
  const leaderboard = useMemo<SpeakingLeaderboardEntry[]>(() => {
    if (!currentGroupId) return []

    const studentMap = new Map<
      string,
      {
        studentName: string
        studentCode: string
        submissions: SpeakingSubmission[]
      }
    >()

    // 1. Enrolled students from group roster
    for (const st of groupStudents) {
      if (st.status === 'graduate') continue
      const fullName = `${st.firstName} ${st.lastName}`.trim()
      studentMap.set(st.id, {
        studentName: fullName,
        studentCode: st.code || st.id,
        submissions: [],
      })
    }

    // 2. Add or attach speaking submissions for this group
    for (const sub of submissions) {
      const existing = studentMap.get(sub.studentId)
      if (existing) {
        existing.submissions.push(sub)
      } else {
        studentMap.set(sub.studentId, {
          studentName: sub.studentName,
          studentCode: sub.studentCode,
          submissions: [sub],
        })
      }
    }

    // 3. Compute stats for each student
    const list: SpeakingLeaderboardEntry[] = []
    for (const [studentId, data] of studentMap.entries()) {
      const sortedSubs = [...data.submissions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

      const scoredSubs = sortedSubs.filter(
        (s) =>
          (s.teacherScore !== null && s.teacherScore !== undefined) ||
          (s.status === 'EVALUATED_BY_AI' && s.aiScore !== null && s.aiScore !== undefined),
      )

      const scores = scoredSubs.map((s) => s.teacherScore ?? s.aiScore!)

      const averageScore =
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null

      const bestScore =
        scores.length > 0 ? Math.round(Math.max(...scores) * 10) / 10 : null

      const latestScore = scores.length > 0 ? scores[0]! : null

      list.push({
        studentId,
        studentName: data.studentName,
        studentCode: data.studentCode,
        rank: null,
        gradedCount: scoredSubs.length,
        totalCount: data.submissions.length,
        averageScore,
        bestScore,
        latestScore,
        submissions: sortedSubs,
      })
    }

    // 4. Sort ranking:
    // Highest average score first; if tied, more graded submissions; unrated last
    list.sort((a, b) => {
      if (a.averageScore !== null && b.averageScore !== null) {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore
        if (b.gradedCount !== a.gradedCount) return b.gradedCount - a.gradedCount
        return b.totalCount - a.totalCount
      }
      if (a.averageScore !== null) return -1
      if (b.averageScore !== null) return 1
      if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount
      return a.studentName.localeCompare(b.studentName)
    })

    // 5. Assign true ranks based on average score (ties share rank, unrated have null rank)
    let currentRank = 1
    for (let i = 0; i < list.length; i++) {
      const entry = list[i]!
      if (entry.averageScore === null) {
        entry.rank = null
      } else {
        if (
          i > 0 &&
          list[i - 1]!.averageScore === entry.averageScore &&
          list[i - 1]!.gradedCount === entry.gradedCount
        ) {
          entry.rank = list[i - 1]!.rank
        } else {
          entry.rank = currentRank
        }
        currentRank++
      }
    }

    return list
  }, [currentGroupId, groupStudents, submissions])

  // Leaderboard filtered by search box
  const displayedLeaderboard = useMemo(() => {
    const rawQuery = search.trim()
    if (!rawQuery) return leaderboard

    const normalize = (str: string) =>
      str.toLowerCase().replace(/[\u2018\u2019\u02BB`]/g, "'")

    const query = normalize(rawQuery)
    const queryWithoutHash = query.startsWith('#') ? query.slice(1).trim() : query

    return leaderboard.filter((entry) => {
      const name = normalize(entry.studentName)
      const code = normalize(entry.studentCode)
      return (
        name.includes(query) ||
        code.includes(query) ||
        `#${code}`.includes(query) ||
        (queryWithoutHash ? code.includes(queryWithoutHash) : false)
      )
    })
  }, [leaderboard, search])

  // Unsubmitted students from group roster who have not submitted audio yet
  const unsubmittedEntries = useMemo(() => {
    return leaderboard.filter((e) => e.submissions.length === 0)
  }, [leaderboard])

  const filteredUnsubmittedEntries = useMemo(() => {
    const rawQuery = search.trim()
    if (!rawQuery) return unsubmittedEntries

    const normalize = (str: string) =>
      str.toLowerCase().replace(/[\u2018\u2019\u02BB`]/g, "'")

    const query = normalize(rawQuery)
    const queryWithoutHash = query.startsWith('#') ? query.slice(1).trim() : query

    return unsubmittedEntries.filter((entry) => {
      const name = normalize(entry.studentName)
      const code = normalize(entry.studentCode)
      return (
        name.includes(query) ||
        code.includes(query) ||
        `#${code}`.includes(query) ||
        (queryWithoutHash ? code.includes(queryWithoutHash) : false)
      )
    })
  }, [unsubmittedEntries, search])

  // Counts for status tabs
  const counts = useMemo(() => {
    return {
      ALL: submissions.length + unsubmittedEntries.length,
      PENDING_AI: submissions.filter((s) => s.status === 'PENDING_AI').length,
      EVALUATED_BY_AI: submissions.filter((s) => s.status === 'EVALUATED_BY_AI').length,
      GRADED_BY_TEACHER: submissions.filter((s) => s.status === 'GRADED_BY_TEACHER').length,
    }
  }, [submissions, unsubmittedEntries])

  const statusTabs = useMemo(
    () => [
      { id: 'ALL' as const, label: 'Barchasi', count: counts.ALL },
      { id: 'PENDING_AI' as const, label: 'Kutilmoqda', count: counts.PENDING_AI },
      { id: 'EVALUATED_BY_AI' as const, label: 'AI baholagan', count: counts.EVALUATED_BY_AI },
      { id: 'GRADED_BY_TEACHER' as const, label: 'Baholandi', count: counts.GRADED_BY_TEACHER },
    ],
    [counts],
  )

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchesStatus = statusFilter === 'ALL' || sub.status === statusFilter
      const rawQuery = search.trim()
      if (!rawQuery) return matchesStatus

      // Normalize Uzbek apostrophes: ‘, ’, ʻ, ` -> '
      const normalize = (str: string) =>
        str.toLowerCase().replace(/[\u2018\u2019\u02BB`]/g, "'")

      const query = normalize(rawQuery)
      const queryWithoutHash = query.startsWith('#') ? query.slice(1).trim() : query
      const studentNameLower = normalize(sub.studentName)
      const studentCodeLower = normalize(sub.studentCode)
      const fullCode = `#${studentCodeLower}`

      const matchesSearch =
        studentNameLower.includes(query) ||
        studentCodeLower.includes(query) ||
        fullCode.includes(query) ||
        (queryWithoutHash ? studentCodeLower.includes(queryWithoutHash) : false)

      return matchesStatus && matchesSearch
    })
  }, [submissions, statusFilter, search])

  const currentGroup = groups.find((g) => g.id === currentGroupId)
  const currentGroupName = currentGroup?.name || 'Guruh'

  const groupOptions = useMemo<SelectOption[]>(
    () => groups.map((g) => ({ value: g.id, label: g.name })),
    [groups],
  )

  const viewingStudent = useMemo(() => {
    if (!viewingStudentId) return null
    return leaderboard.find((entry) => entry.studentId === viewingStudentId) ?? null
  }, [leaderboard, viewingStudentId])

  return (
    <div className="speaking-page">
      {/* Page Header */}
      <div className="speaking-header">
        <div className="speaking-header-title">
          <span className="speaking-icon-badge" aria-hidden="true">
            <Mic size={22} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--text)' }}>
              Speaking & IELTS Voice Lab
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              O‘quvchilarning og‘zaki nutqini AI yordamida tahlil qilish, transkriptsiya va baholash
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar / Group Selector */}
      <div className="speaking-toolbar">
        <div className="speaking-group-filter">
          <label htmlFor="group-select" className="speaking-group-label">
            Guruh:
          </label>
          <Select
            id="group-select"
            aria-label="Guruh"
            value={currentGroupId}
            onChange={(val) => {
              setSelectedGroupId(val)
              setViewingStudentId(null)
            }}
            options={groupOptions}
            placeholder={
              adminGroupsQuery.isLoading || teacherGroupsQuery.isLoading
                ? 'Yuklanmoqda...'
                : 'Guruhni tanlang...'
            }
            width="220px"
            searchable={groups.length > 5}
          />
        </div>
      </div>

      {/* Main Grid: Left Speaking Leaderboard, Right Submissions Stream */}
      <div className="speaking-layout">
        {/* Left Column: Isolated Speaking Leaderboard for this group */}
        <section className="speaking-panel" aria-label="Speaking reytingi">
          <div className="speaking-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={16} style={{ color: 'var(--gold)' }} />
              <h2 className="speaking-panel-title">
                Speaking reytingi ({leaderboard.length})
              </h2>
            </div>
            <span className="speaking-score-pill" style={{ fontSize: '10px' }}>
              Max: 10
            </span>
          </div>

          {groupStudentsQuery.isLoading || submissionsQuery.isLoading ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
              Reyting yuklanmoqda...
            </div>
          ) : displayedLeaderboard.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
              {groups.length === 0
                ? 'Hozircha guruhlar mavjud emas.'
                : leaderboard.length === 0
                ? 'Bu guruhda o‘quvchilar yo‘q.'
                : 'Qidiruvga mos o‘quvchi topilmadi.'}
            </div>
          ) : (
            <div className="speaking-ranking-list">
              {displayedLeaderboard.map((entry) => (
                <button
                  key={entry.studentId}
                  type="button"
                  onClick={() => setViewingStudentId(entry.studentId)}
                  className="speaking-ranking-card"
                  aria-label={`${entry.studentName} speaking progressi`}
                >
                    <div className="speaking-ranking-left">
                      <span
                        className={`speaking-rank-badge ${
                          entry.rank === 1
                            ? 'rank-1'
                            : entry.rank === 2
                            ? 'rank-2'
                            : entry.rank === 3
                            ? 'rank-3'
                            : entry.rank !== null
                            ? 'rank-other'
                            : 'rank-unrated'
                        }`}
                      >
                        {entry.rank !== null ? entry.rank : '—'}
                      </span>
                      <div className="speaking-ranking-info">
                        <strong className="speaking-ranking-name">{entry.studentName}</strong>
                        <span className="speaking-ranking-code">#{entry.studentCode}</span>
                      </div>
                    </div>

                    <div className="speaking-ranking-right">
                      {entry.averageScore !== null ? (
                        <div className="speaking-ranking-score">
                          <span className="speaking-ranking-avg">
                            <Award size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                            {entry.averageScore}
                          </span>
                          <span className="speaking-ranking-subs">
                            {entry.gradedCount} ta baho
                          </span>
                        </div>
                      ) : (
                        <div className="speaking-ranking-score unrated">
                          <span className="speaking-ranking-unrated">Topshirilmagan</span>
                          <span className="speaking-ranking-subs">{entry.totalCount} ta audio</span>
                        </div>
                      )}
                      <TrendingUp size={14} className="speaking-ranking-arrow" />
                    </div>
                  </button>
                ))}
            </div>
          )}
        </section>

        {/* Right Column: Speaking Submissions Stream */}
        <section className="speaking-panel" aria-label="Topshiriqlar tahlili">
          <div>
            {/* Header with Group Info & Score Scale */}
            <div className="speaking-review-header">
              <div className="speaking-review-top">
                <div className="speaking-review-left">
                  <span className="speaking-tag speaking-tag-glowing">
                    <Sparkles size={13} className="speaking-tag-sparkle" aria-hidden="true" />
                    {currentGroupName}
                  </span>
                </div>

                <div className="speaking-review-right">
                  <span className="speaking-score-pill">
                    <Award size={13} style={{ color: 'var(--gold)' }} />
                    <span>Maksimal ball: <strong>10</strong></span>
                  </span>
                </div>
              </div>

              {/* Status filter tabs & search input */}
              <div className="speaking-review-bottom">
                <div
                  className="speaking-status-tabs"
                  role="tablist"
                  aria-label="Status bo‘yicha filtrlash"
                >
                  {statusTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-label={tab.label}
                      aria-selected={statusFilter === tab.id}
                      className={`speaking-tab-btn ${statusFilter === tab.id ? 'active' : ''}`}
                      onClick={() => setStatusFilter(tab.id)}
                    >
                      <span>{tab.label}</span>
                      <span className="speaking-tab-count">({tab.count})</span>
                    </button>
                  ))}
                </div>

                <div className="speaking-review-actions">
                  <div className="speaking-search">
                    <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="O‘quvchi ismi yoki kodi..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Qidirish"
                    />
                    {search && (
                      <button
                        type="button"
                        className="speaking-search-clear"
                        onClick={() => setSearch('')}
                        aria-label="Qidiruvni tozalash"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="speaking-review-count">
                    Jami: <strong>{statusFilter === 'ALL' ? filteredSubmissions.length + filteredUnsubmittedEntries.length : filteredSubmissions.length}</strong> ta topshiriq
                  </div>
                </div>
              </div>
            </div>

            {/* Submissions & Students List */}
            <div className="speaking-submissions-wrap">
              {submissionsQuery.isLoading || groupStudentsQuery.isLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
                  Yozuvlar yuklanmoqda...
                </div>
              ) : (filteredSubmissions.length === 0 && (statusFilter !== 'ALL' || filteredUnsubmittedEntries.length === 0)) ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: 'var(--muted)',
                    fontSize: '13px',
                    background: 'var(--surface-soft)',
                    borderRadius: '8px',
                    border: '1px dashed var(--border)',
                  }}
                >
                  {groups.length === 0
                    ? 'Topshiriqlarni ko‘rish uchun avval guruh tanlang yoki yarating.'
                    : submissions.length === 0 && unsubmittedEntries.length === 0
                    ? 'Bu guruhda o‘quvchilar yo‘q.'
                    : 'Filtrga mos topshiriq topilmadi.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredSubmissions.map((sub) => (
                    <SubmissionCard
                      key={sub.id}
                      submission={sub}
                      topicMaxScore={10}
                      onGrade={() =>
                        setGradingTarget({
                          submissionId: sub.id,
                          studentId: sub.studentId,
                          studentName: sub.studentName,
                          studentCode: sub.studentCode,
                          aiScore: sub.aiScore,
                          teacherScore: sub.teacherScore,
                          teacherComment: sub.teacherComment,
                          transcript: sub.transcript,
                          durationSeconds: sub.durationSeconds,
                          audioUrl: sub.audioUrl,
                        })
                      }
                      onViewProgress={() => setViewingStudentId(sub.studentId)}
                    />
                  ))}

                  {statusFilter === 'ALL' &&
                    filteredUnsubmittedEntries.map((entry) => (
                      <UnsubmittedStudentCard
                        key={`unsub-${entry.studentId}`}
                        entry={entry}
                        onGrade={() =>
                          setGradingTarget({
                            studentId: entry.studentId,
                            studentName: entry.studentName,
                            studentCode: entry.studentCode,
                          })
                        }
                        onViewProgress={() => setViewingStudentId(entry.studentId)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Modal: Student Speaking Progress */}
      {viewingStudent && (
        <SpeakingStudentProgressModal
          entry={viewingStudent}
          groupName={currentGroupName}
          onClose={() => setViewingStudentId(null)}
          onGrade={() => {
            const entry = viewingStudent
            const latestSub = entry.submissions[0]
            if (latestSub) {
              setGradingTarget({
                submissionId: latestSub.id,
                studentId: latestSub.studentId,
                studentName: latestSub.studentName,
                studentCode: latestSub.studentCode,
                aiScore: latestSub.aiScore,
                teacherScore: latestSub.teacherScore,
                teacherComment: latestSub.teacherComment,
                transcript: latestSub.transcript,
                durationSeconds: latestSub.durationSeconds,
                audioUrl: latestSub.audioUrl,
              })
            } else {
              setGradingTarget({
                studentId: entry.studentId,
                studentName: entry.studentName,
                studentCode: entry.studentCode,
              })
            }
            setViewingStudentId(null)
          }}
        />
      )}

      {/* Modal: Teacher Grading */}
      {gradingTarget && (
        <GradeSubmissionModal
          target={gradingTarget}
          groupId={currentGroupId}
          maxScore={10}
          onClose={() => setGradingTarget(null)}
        />
      )}
    </div>
  )
}

function SubmissionCard({
  submission,
  topicMaxScore = 10,
  onGrade,
  onViewProgress,
}: {
  submission: SpeakingSubmission
  topicMaxScore?: number
  onGrade: () => void
  onViewProgress: () => void
}) {
  const [showAiDetails, setShowAiDetails] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const toggleBtnRef = useRef<HTMLButtonElement>(null)

  const handleClose = () => {
    setShowAiDetails(false)
    if (cardRef.current) {
      cardRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }
    toggleBtnRef.current?.focus?.({ preventScroll: true })
  }

  const handleToggle = () => {
    if (showAiDetails) {
      handleClose()
    } else {
      setShowAiDetails(true)
    }
  }

  const hasTranscript = Boolean(submission.transcript?.trim())
  const hasAiFeedback = Boolean(submission.aiFeedback?.trim())
  const hasAccordionContent = hasTranscript || hasAiFeedback

  const accordionTitle = useMemo(() => {
    if (hasTranscript && hasAiFeedback) {
      return `Gemini AI Tahlili & Transkript ${
        submission.aiScore !== null && submission.aiScore !== undefined
          ? `(Band ${submission.aiScore})`
          : ''
      }`.trim()
    }
    if (hasTranscript) {
      return 'Nutq transkripti'
    }
    return `Gemini AI Tahlili ${
      submission.aiScore !== null && submission.aiScore !== undefined
        ? `(Band ${submission.aiScore})`
        : ''
    }`.trim()
  }, [hasTranscript, hasAiFeedback, submission.aiScore])

  const statusBadge = useMemo(() => {
    switch (submission.status) {
      case 'PENDING_AI':
        return (
          <span className="speaking-status-badge speaking-status-pending">
            <Clock size={12} /> Kutilmoqda
          </span>
        )
      case 'EVALUATED_BY_AI':
        return (
          <span className="speaking-status-badge speaking-status-ai">
            <Bot size={12} /> AI Baholagan
          </span>
        )
      case 'GRADED_BY_TEACHER':
        return (
          <span className="speaking-status-badge speaking-status-graded">
            <CheckCircle2 size={12} /> Baholandi
          </span>
        )
    }
  }, [submission.status])

  return (
    <article ref={cardRef} className="speaking-submission-card" tabIndex={-1}>
      {/* Student info and Status Header */}
      <div className="speaking-sub-header">
        <div className="speaking-student-info">
          <strong className="speaking-student-name">{submission.studentName}</strong>
          <span className="speaking-student-code">#{submission.studentCode}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {statusBadge}
          <button
            type="button"
            className="secondary-button"
            onClick={onViewProgress}
            style={{ height: '30px', padding: '0 9px', fontSize: '11px', gap: '4px' }}
            aria-label={`${submission.studentName} progressini ko‘rish`}
          >
            <TrendingUp size={13} style={{ color: 'var(--gold)' }} />
            <span>Progress</span>
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onGrade}
            style={{ height: '30px', padding: '0 10px', fontSize: '12px', gap: '5px' }}
          >
            <GraduationCap size={14} />
            <span>
              {submission.teacherScore !== null && submission.teacherScore !== undefined
                ? 'Ballni yangilash'
                : 'Baholash'}
            </span>
          </button>
        </div>
      </div>

      {/* HTML5 Audio Player or In-person Banner */}
      {submission.audioUrl === 'in-person' ? (
        <div
          className="speaking-audio-box"
          style={{
            background: 'var(--surface-soft)',
            border: '1px dashed var(--border)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ color: 'var(--gold)', display: 'grid', placeItems: 'center' }}>
            <Award size={18} />
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>
            🗣️ Jonli / Oflayn og‘zaki topshirilgan (audiosiz baholangan)
          </span>
        </div>
      ) : (
        <div className="speaking-audio-box">
          <span style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
            <Volume2 size={18} />
          </span>
          <audio
            controls
            src={getSubmissionAudioUrl(submission)}
            preload="metadata"
            onError={(e) => {
              const freshUrl = getSubmissionAudioUrl(submission)
              if (freshUrl && e.currentTarget.src !== freshUrl) {
                e.currentTarget.src = freshUrl
                e.currentTarget.load()
              }
            }}
          >
            <p>Brauzeringiz audio formatini qo‘llab-quvvatlamaydi.</p>
          </audio>
          {submission.durationSeconds > 0 ? (
            <span className="speaking-duration-badge">
              {Math.floor(submission.durationSeconds / 60)}:
              {String(submission.durationSeconds % 60).padStart(2, '0')}
            </span>
          ) : null}
        </div>
      )}

      {/* Pending Banner if waiting for teacher / AI */}
      {submission.status === 'PENDING_AI' && (
        <div className="speaking-pending-banner">
          <Clock size={14} />
          <span>Ovozli xabar qabul qilindi. O‘qituvchi audio yozuvni tinglab baholashi mumkin.</span>
        </div>
      )}

      {/* Teacher Evaluation Result if graded */}
      {submission.teacherScore !== null && submission.teacherScore !== undefined && (
        <div className="speaking-teacher-box">
          <div className="speaking-teacher-title">
            <UserCheck size={16} />
            <span>O‘qituvchi bahosi: {submission.teacherScore} / {topicMaxScore}</span>
          </div>
          {submission.teacherComment ? (
            <p className="speaking-teacher-comment">
              Izoh: {submission.teacherComment}
            </p>
          ) : null}
        </div>
      )}

      {/* AI Assessment / Transcript Accordion */}
      {hasAccordionContent && (
        <div className={`speaking-ai-accordion ${showAiDetails ? 'expanded' : 'collapsed'}`}>
          <button
            type="button"
            ref={toggleBtnRef}
            onClick={handleToggle}
            className="speaking-ai-toggle"
            aria-expanded={showAiDetails}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} style={{ color: 'var(--gold)' }} />
              <span>{accordionTitle}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
              {showAiDetails ? (
                <>
                  <span>Yopish</span>
                  <ChevronUp size={14} />
                </>
              ) : (
                <>
                  <span>Transkriptni ko‘rish</span>
                  <ChevronDown size={14} />
                </>
              )}
            </span>
          </button>

          {showAiDetails && (
            <div className="speaking-ai-content">
              {/* Transcript */}
              {hasTranscript ? (
                <div style={{ marginBottom: hasAiFeedback ? '12px' : 0 }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}
                  >
                    Nutq transkripti:
                  </span>
                  <div className="speaking-transcript-box">
                    "{submission.transcript}"
                  </div>
                </div>
              ) : null}

              {/* Feedback Breakdown */}
              {hasAiFeedback ? (
                <div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}
                  >
                    AI Baholash va Tavsiyalar:
                  </span>
                  <div
                    style={{
                      marginTop: '6px',
                      whiteSpace: 'pre-wrap',
                      fontSize: '12px',
                      color: 'var(--text)',
                      lineHeight: '1.6',
                    }}
                  >
                    {submission.aiFeedback}
                  </div>
                </div>
              ) : null}

              {/* Bottom collapse button to return card to compact size and place */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '12px',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--border)',
                }}
              >
                <button
                  type="button"
                  className="speaking-collapse-link"
                  onClick={handleClose}
                >
                  <ChevronUp size={13} />
                  <span>Transkriptni yopish</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function SpeakingStudentProgressModal({
  entry,
  groupName,
  onClose,
  onGrade,
}: {
  entry: SpeakingLeaderboardEntry
  groupName: string
  onClose: () => void
  onGrade?: () => void
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="speaking-progress-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="speaking-student-progress-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="speaking-tag">{groupName}</span>
              <span className="speaking-student-code">#{entry.studentCode}</span>
            </div>
            <h3 id="speaking-student-progress-title" style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
              {entry.studentName} — Speaking progressi
            </h3>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </header>

        <div className="speaking-modal-body">
          {/* Key Metrics Grid */}
          <div className="speaking-progress-stats">
            <div className="speaking-stat-card">
              <span className="speaking-stat-label">
                <Award size={13} style={{ color: 'var(--gold)' }} />
                O‘rtacha ball
              </span>
              <span className="speaking-stat-val">
                {entry.averageScore !== null ? `${entry.averageScore} / 10` : '—'}
              </span>
            </div>

            <div className="speaking-stat-card">
              <span className="speaking-stat-label">
                <Award size={13} style={{ color: 'var(--gold)' }} />
                Eng yuqori
              </span>
              <span className="speaking-stat-val">
                {entry.bestScore !== null ? `${entry.bestScore} / 10` : '—'}
              </span>
            </div>

            <div className="speaking-stat-card">
              <span className="speaking-stat-label">
                <Mic size={13} style={{ color: 'var(--gold)' }} />
                Yozuvlar
              </span>
              <span className="speaking-stat-val">
                {entry.totalCount} ta audio
              </span>
            </div>

            <div className="speaking-stat-card">
              <span className="speaking-stat-label">
                <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
                Baholandi
              </span>
              <span className="speaking-stat-val">
                {entry.gradedCount} ta
              </span>
            </div>
          </div>

          {/* Section: Ballar dinamikasi */}
          {entry.submissions.length > 0 && (
            <div className="speaking-progress-section">
              <div className="speaking-progress-section-title">
                <TrendingUp size={14} style={{ color: 'var(--gold)' }} />
                <span>Ballar dinamikasi ({entry.submissions.length})</span>
              </div>
              <div className="speaking-progress-timeline">
                {[...entry.submissions]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((sub, idx, arr) => {
                    const score =
                      sub.teacherScore ?? (sub.status === 'EVALUATED_BY_AI' ? sub.aiScore : null)
                    const hasScore = score !== null && score !== undefined
                    const percent =
                      hasScore ? Math.min(100, Math.max(8, (score / 10) * 100)) : 0
                    const isLatest = idx === 0
                    return (
                      <div key={sub.id} className="speaking-timeline-item">
                        <span className="speaking-timeline-date">{formatDate(sub.createdAt)}</span>
                        <div className="speaking-progress-bar-bg">
                          {hasScore ? (
                            <div
                              className="speaking-progress-bar-fill"
                              style={{ width: `${percent}%` }}
                            />
                          ) : (
                            <div
                              style={{
                                height: '100%',
                                width: '100%',
                                background: 'rgba(234, 179, 8, 0.2)',
                                borderRadius: '4px',
                              }}
                            />
                          )}
                        </div>
                        <span className="speaking-timeline-score">
                          {sub.teacherScore !== null && sub.teacherScore !== undefined
                            ? `${sub.teacherScore} / 10`
                            : sub.aiScore !== null && sub.aiScore !== undefined
                            ? `Band ${sub.aiScore}`
                            : 'Kutilmoqda'}
                          {isLatest && arr.length > 1 ? (
                            <span style={{ fontSize: '10px', color: 'var(--gold-dark)', marginLeft: '4px', fontWeight: 500 }}>
                              (so‘nggi)
                            </span>
                          ) : null}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        <footer className="speaking-modal-footer" style={{ justifyContent: onGrade ? 'space-between' : 'flex-end' }}>
          {onGrade && (
            <button
              type="button"
              className="primary-button"
              onClick={onGrade}
              style={{ fontSize: '12px', gap: '5px' }}
            >
              <GraduationCap size={14} />
              <span>Baholash</span>
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            style={{ fontSize: '12px' }}
          >
            Yopish
          </button>
        </footer>
      </section>
    </div>
  )
}

function UnsubmittedStudentCard({
  entry,
  onGrade,
  onViewProgress,
}: {
  entry: SpeakingLeaderboardEntry
  onGrade: () => void
  onViewProgress: () => void
}) {
  return (
    <article className="speaking-submission-card speaking-unsubmitted-card" tabIndex={-1}>
      <div className="speaking-sub-header">
        <div className="speaking-student-info">
          <strong className="speaking-student-name">{entry.studentName}</strong>
          <span className="speaking-student-code">#{entry.studentCode}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="speaking-status-badge speaking-status-unsubmitted">
            <AlertCircle size={12} /> Topshirmagan
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={onViewProgress}
            style={{ height: '30px', padding: '0 9px', fontSize: '11px', gap: '4px' }}
            aria-label={`${entry.studentName} progressini ko‘rish`}
          >
            <TrendingUp size={13} style={{ color: 'var(--gold)' }} />
            <span>Progress</span>
          </button>
          <button
            type="button"
            className="secondary-button speaking-grade-btn-highlight"
            onClick={onGrade}
            style={{ height: '30px', padding: '0 11px', fontSize: '12px', gap: '5px' }}
          >
            <GraduationCap size={14} style={{ color: 'var(--gold)' }} />
            <span>Baholash</span>
          </button>
        </div>
      </div>

      <div className="speaking-unsubmitted-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#d97706', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <MicOff size={18} />
          </span>
          <div style={{ fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.45 }}>
            <strong style={{ color: '#b45309' }}>Audio topshirilmagan.</strong>{' '}
            <span style={{ color: 'var(--muted)' }}>
              O‘quvchi sinfda og‘zaki javob bergan bo‘lsa, «Baholash» tugmasi orqali to‘g‘ridan-to‘g‘ri baholashingiz mumkin.
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

function GradeSubmissionModal({
  target,
  groupId,
  maxScore = 10,
  onClose,
}: {
  target: GradingTarget
  groupId: string
  maxScore?: number
  onClose: () => void
}) {
  const gradeSubmissionMutation = useGradeSpeakingSubmission()
  const gradeStudentMutation = useGradeStudentSpeaking()
  const isPending = gradeSubmissionMutation.isPending || gradeStudentMutation.isPending

  const effectiveMax = maxScore || 10
  const defaultScore =
    target.teacherScore !== null && target.teacherScore !== undefined
      ? String(target.teacherScore)
      : target.aiScore !== null && target.aiScore !== undefined
      ? String(Math.min(effectiveMax, target.aiScore))
      : '8'

  const [score, setScore] = useState<string>(defaultScore)
  const [comment, setComment] = useState(target.teacherComment ?? '')
  const [error, setError] = useState<string | null>(null)
  const [showModalTranscript, setShowModalTranscript] = useState(true)

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleGrade(e: FormEvent) {
    e.preventDefault()
    const numericScore = parseFloat(score)
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > effectiveMax) {
      setError(`Ball 0 va ${effectiveMax} oralig‘ida bo‘lishi lozim`)
      return
    }

    try {
      if (target.submissionId) {
        const input: GradeSpeakingSubmissionInput = {
          teacherScore: numericScore,
          teacherComment: comment.trim(),
        }
        await gradeSubmissionMutation.mutateAsync({ id: target.submissionId, input })
      } else {
        await gradeStudentMutation.mutateAsync({
          studentId: target.studentId,
          groupId,
          teacherScore: numericScore,
          teacherComment: comment.trim(),
        })
      }
      onClose()
    } catch (err: unknown) {
      if (err && typeof err === 'object') {
        const apiErr = err as { message?: string; details?: any }
        if (Array.isArray(apiErr.details) && apiErr.details.length > 0) {
          const detailMessages = apiErr.details
            .map((d: any) => `${d.path?.join('.') ? `${d.path.join('.')}: ` : ''}${d.message}`)
            .join('; ')
          setError(detailMessages)
          return
        }
        if (apiErr.message) {
          setError(apiErr.message)
          return
        }
      }
      setError('Baholashni saqlashda xatolik yuz berdi')
    }
  }

  const hasAudio = target.audioUrl && target.audioUrl !== 'in-person'

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <section
        className="speaking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grade-submission-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h3 id="grade-submission-modal-title">O‘quvchi nutqini baholash</h3>
            <p>{target.studentName} (#{target.studentCode})</p>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </header>

        {error && (
          <div
            style={{
              margin: '16px 20px 0',
              padding: '9px 12px',
              color: '#dc2626',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleGrade} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="speaking-modal-body">
            {/* Audio Player in Modal or In-Person note */}
            {hasAudio ? (
              <div className="speaking-audio-box" style={{ margin: 0 }}>
                <span style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
                  <Volume2 size={18} />
                </span>
                <audio
                  controls
                  src={getSubmissionAudioUrl(target as unknown as SpeakingSubmission)}
                  preload="metadata"
                >
                  <p>Brauzeringiz audio formatini qo‘llab-quvvatlamaydi.</p>
                </audio>
                {(target.durationSeconds ?? 0) > 0 ? (
                  <span className="speaking-duration-badge">
                    {Math.floor((target.durationSeconds ?? 0) / 60)}:
                    {String((target.durationSeconds ?? 0) % 60).padStart(2, '0')}
                  </span>
                ) : null}
              </div>
            ) : (
              <div
                className="speaking-audio-box"
                style={{
                  margin: 0,
                  background: 'var(--surface-soft)',
                  border: '1px dashed var(--border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ color: 'var(--gold)', display: 'grid', placeItems: 'center' }}>
                  <Award size={18} />
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  🗣️ Jonli / Oflayn topshirish — audio yozuvsiz to‘g‘ridan-to‘g‘ri baholash.
                </span>
              </div>
            )}

            {target.aiScore && (
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--gold-dark)',
                  background: 'rgba(212, 160, 23, 0.1)',
                  border: '1px solid rgba(212, 160, 23, 0.25)',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={15} style={{ color: 'var(--gold)' }} />
                <span>
                  💡 AI tavsiya qilgan ball: <strong>Band {target.aiScore}</strong>
                </span>
              </div>
            )}

            {/* Student transcript preview if available */}
            {target.transcript && (
              <div style={{ display: 'grid', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Nutq transkripti:
                  </span>
                  <button
                    type="button"
                    aria-label={showModalTranscript ? 'Transkriptni yopish' : 'Transkriptni ko‘rish'}
                    onClick={() => setShowModalTranscript((prev) => !prev)}
                    className="speaking-modal-toggle-btn"
                  >
                    <span>{showModalTranscript ? 'Yopish' : 'Transkriptni ko‘rish'}</span>
                    {showModalTranscript ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {showModalTranscript && (
                  <div className="speaking-transcript-box" style={{ margin: 0, maxHeight: '90px', overflowY: 'auto' }}>
                    "{target.transcript}"
                  </div>
                )}
              </div>
            )}

            <div className="speaking-field">
              <label htmlFor="grade-teacher-score">
                O‘qituvchi bali (Max: 10) *
              </label>
              <input
                id="grade-teacher-score"
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                required
              />
            </div>

            <div className="speaking-field">
              <label htmlFor="grade-teacher-comment">
                O‘qituvchi izohi / Fikr-mulohazasi
              </label>
              <textarea
                id="grade-teacher-comment"
                rows={3}
                placeholder="O‘quvchiga yo‘l-yo‘riq va tavsiyalaringizni yozing..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>

          <footer className="speaking-modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={isPending}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isPending}
            >
              {isPending ? 'Saqlanmoqda...' : 'Bahoni tasdiqlash'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
