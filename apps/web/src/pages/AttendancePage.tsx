import type { AttendanceRow, Group } from '@golden-study/contracts';
import { BookOpen, CalendarCheck, CheckCheck, ChevronLeft, ChevronRight, FileText, Save, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAttendance,
  useBroadcastAttendance,
  useMonthlyAttendance,
  useSaveAttendance,
} from '../features/attendance/useAttendance';
import { LessonBroadcastModal } from '../features/attendance/LessonBroadcastModal';
import {
  calculateAttendanceAverage,
  formatLessonPlan,
  normalizeAttendanceRow,
  parseLessonPlan,
  parseScoreInput,
} from '../features/attendance/attendancePlan';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { DateInput } from '../shared/ui/DateInput';
import { Select } from '../shared/ui/Select';
import { useUnsavedChanges } from '../shared/context/UnsavedChangesContext';

import { useGroups } from '../features/groups/useGroups';

const EMPTY_GROUPS: Group[] = [];

const statusLabels = {
  came: 'Keldi',
  excused: 'Sababli',
  absent: 'Sababsiz'
} as const;

export function AttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: groups = EMPTY_GROUPS } = useGroups();

  const todayIso = new Date().toLocaleDateString('en-CA');
  const todayMonth = todayIso.slice(0, 7);

  const urlGroup = searchParams.get('group');
  const urlDate = searchParams.get('date');
  const urlView = searchParams.get('view');
  const urlMonth = searchParams.get('month');

  const storedGroup = (() => {
    try {
      return localStorage.getItem('golden_study_selected_group_id');
    } catch {
      return null;
    }
  })();

  const storedDate = (() => {
    try {
      return localStorage.getItem('golden_study_selected_date');
    } catch {
      return null;
    }
  })();

  const groupId =
    (urlGroup && groups.some((g) => g.id === urlGroup) && urlGroup) ||
    (storedGroup && groups.some((g) => g.id === storedGroup) && storedGroup) ||
    groups[0]?.id ||
    'g1';

  const date =
    (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) && urlDate) ||
    (storedDate && /^\d{4}-\d{2}-\d{2}$/.test(storedDate) && storedDate) ||
    todayIso;

  const viewMode: 'daily' | 'monthly' =
    urlView === 'monthly'
      ? 'monthly'
      : urlView === 'daily'
      ? 'daily'
      : urlMonth && !urlDate
      ? 'monthly'
      : 'daily';
  const selectedMonth = (urlMonth && /^\d{4}-\d{2}$/.test(urlMonth) && urlMonth) || date.slice(0, 7) || todayMonth;
  const [onlyLessonDays, setOnlyLessonDays] = useState(true);

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [lessonTitle, setLessonTitle] = useState('');
  const [homeworkText, setHomeworkText] = useState('');
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showUnmarkedConfirm, setShowUnmarkedConfirm] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ groupId?: string; date?: string; view?: 'daily' | 'monthly' } | null>(null);

  useEffect(() => {
    if (groups.length === 0) return;
    const currentGroup = searchParams.get('group');
    const currentDate = searchParams.get('date');
    const hasValidGroup = currentGroup && groups.some((g) => g.id === currentGroup);
    const hasValidDate = currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate);

    try {
      localStorage.setItem('golden_study_selected_group_id', groupId);
      localStorage.setItem('golden_study_selected_date', date);
    } catch {}

    if (!hasValidGroup || !hasValidDate) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!hasValidGroup) next.set('group', groupId);
          if (!hasValidDate) next.set('date', date);
          return next;
        },
        { replace: true },
      );
    }
  }, [groups, searchParams, setSearchParams, groupId, date]);

  const monthlyQ = useMonthlyAttendance(groupId, selectedMonth);

  function handleMonthChange(nextMonth: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('month', nextMonth);
        return next;
      },
      { replace: true },
    );
  }

  function goToPrevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const nextMonthStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(nextMonthStr);
  }

  function goToNextMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m, 1));
    const nextMonthStr = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}`;
    handleMonthChange(nextMonthStr);
  }

  function handleViewChange(targetView: 'daily' | 'monthly', targetDate?: string) {
    if (isDirty && viewMode === 'daily') {
      setPendingNavigation({
        view: targetView,
        date: targetDate,
      });
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', targetView);
        if (targetView === 'daily' && targetDate) {
          next.set('date', targetDate);
        }
        return next;
      },
      { replace: true },
    );
  }

  const monthlyDays = useMemo(() => {
    if (!monthlyQ.data) return [];
    if (!onlyLessonDays) return monthlyQ.data.days;
    const lessonDays = monthlyQ.data.days.filter((d) => d.hasLesson);
    return lessonDays.length > 0 ? lessonDays : monthlyQ.data.days;
  }, [monthlyQ.data, onlyLessonDays]);

  const q = useAttendance(groupId, date);
  const save = useSaveAttendance();
  const broadcastMutation = useBroadcastAttendance();
  const selectedGroup = groups.find((g) => g.id === groupId);

  useEffect(() => {
    if (q.data) {
      setRows(q.data.rows.map(normalizeAttendanceRow));
      const parsed = parseLessonPlan(q.data.homeworkText || '');
      setLessonTitle(q.data.lessonTitle || q.data.topic || parsed.topic);
      setHomeworkText(parsed.topic ? parsed.homeworkText : (q.data.homeworkText || ''));
    }
  }, [q.data]);

  useEffect(() => {
    if (save.isSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [save.isSuccess]);

  const parsedPlan = parseLessonPlan(q.data?.homeworkText || '');
  const initialTopic = q.data ? (q.data.lessonTitle || q.data.topic || parsedPlan.topic) : '';
  const initialHw = q.data ? (parsedPlan.topic ? parsedPlan.homeworkText : (q.data.homeworkText || '')) : '';
  const isLessonPlanChanged = lessonTitle !== initialTopic || homeworkText !== initialHw;

  const changedCount = (q.data?.rows.reduce((count, original) => {
    const normalizedOriginal = normalizeAttendanceRow(original);
    const current = rows.find((row) => row.studentId === normalizedOriginal.studentId);
    return count + (JSON.stringify(current) === JSON.stringify(normalizedOriginal) ? 0 : 1);
  }, 0) ?? 0) + (isLessonPlanChanged ? 1 : 0);
  const isDirty = changedCount > 0;
  useUnsavedChanges(viewMode === 'daily' && isDirty);

  function discardAndProceed(pending: { groupId?: string; date?: string; view?: 'daily' | 'monthly' }) {
    setPendingNavigation(null);
    if (q.data) {
      setRows(q.data.rows.map(normalizeAttendanceRow));
      const parsed = parseLessonPlan(q.data.homeworkText || '');
      setLessonTitle(q.data.lessonTitle || q.data.topic || parsed.topic);
      setHomeworkText(parsed.topic ? parsed.homeworkText : (q.data.homeworkText || ''));
    }
    if (pending.groupId) {
      try {
        localStorage.setItem('golden_study_selected_group_id', pending.groupId);
      } catch {}
    }
    if (pending.date) {
      try {
        localStorage.setItem('golden_study_selected_date', pending.date);
      } catch {}
    }
    setSearchParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        if (pending.groupId) nextParams.set('group', pending.groupId);
        if (pending.date) nextParams.set('date', pending.date);
        if (pending.view) nextParams.set('view', pending.view);
        return nextParams;
      },
      { replace: true },
    );
  }

  function applyFilter(next: { groupId: string; date: string }) {
    try {
      localStorage.setItem('golden_study_selected_group_id', next.groupId);
      localStorage.setItem('golden_study_selected_date', next.date);
    } catch {}
    setSearchParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        nextParams.set('group', next.groupId);
        nextParams.set('date', next.date);
        return nextParams;
      },
      { replace: true },
    );
  }

  function requestFilterChange(next: { groupId: string; date: string }) {
    if (isDirty) {
      setPendingNavigation(next);
      return;
    }
    applyFilter(next);
  }

  function patch(id: string, value: Partial<AttendanceRow>) {
    setRows((v) => v.map((x) => x.studentId === id ? { ...x, ...value } : x));
  }

  function handleMarkAllCame() {
    setRows((current) => {
      const hasUnmarked = current.some((r) => (r.status as string) === 'unmarked');
      return current.map((r) => {
        if (hasUnmarked) {
          return (r.status as string) === 'unmarked' ? { ...r, status: 'came' } : r;
        }
        return { ...r, status: 'came' };
      });
    });
  }

  function updateScore(
    studentId: string,
    field: 'homeworkScore' | 'topicScore' | 'dictionaryScore',
    value: number | null,
  ) {
    setRows((current) =>
      current.map((row) => {
        if (row.studentId !== studentId) return row;
        const nextScores = {
          homeworkScore: field === 'homeworkScore' ? value : (row.homeworkScore ?? null),
          topicScore: field === 'topicScore' ? value : (row.topicScore ?? null),
          dictionaryScore: field === 'dictionaryScore' ? value : (row.dictionaryScore ?? null),
        };
        const nextRating = calculateAttendanceAverage(
          nextScores.homeworkScore,
          nextScores.topicScore,
          nextScores.dictionaryScore,
        );
        return {
          ...row,
          ...nextScores,
          rating: nextRating,
          homeworkDone: (nextScores.homeworkScore ?? 0) > 0,
        };
      }),
    );
  }

  async function performSave(rowsToSave: AttendanceRow[]) {
    if (!q.data) return;
    const formatted = formatLessonPlan(lessonTitle, homeworkText);
    await save.mutateAsync({
      ...q.data,
      topic: lessonTitle,
      lessonTitle,
      homeworkText: formatted,
      rows: rowsToSave,
    });
    setShowTelegramPrompt(true);
  }

  async function handleSave() {
    if (!q.data) return;
    const unmarkedRows = rows.filter((r) => (r.status as string) === 'unmarked');
    if (unmarkedRows.length > 0) {
      setShowUnmarkedConfirm(true);
      return;
    }
    await performSave(rows);
  }

  async function handleConfirmUnmarkedAsCame() {
    setShowUnmarkedConfirm(false);
    const resolvedRows = rows.map((r) =>
      (r.status as string) === 'unmarked' ? { ...r, status: 'came' as const } : r,
    );
    setRows(resolvedRows);
    await performSave(resolvedRows);
  }

  return (
    <section className="attendance-page">
      <div className="page-heading">
        <div>
          <h1>Davomat</h1>
          <p>Guruh bo‘yicha davomat, baho va uy vazifasi</p>
        </div>
      </div>
      <div className="attendance-toolbar">
        <div className="attendance-view-toggle" role="tablist" aria-label="Davomat ko‘rinishi">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'daily'}
            className={viewMode === 'daily' ? 'active' : ''}
            onClick={() => handleViewChange('daily')}
          >
            Kunlik jurnal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'monthly'}
            className={viewMode === 'monthly' ? 'active' : ''}
            onClick={() => handleViewChange('monthly')}
          >
            Oylik tabel
          </button>
        </div>

        <div className="attendance-filters">
          <label>Guruh
            <Select
              aria-label="Guruh"
              value={groupId}
              onChange={(nextId) => requestFilterChange({ groupId: nextId, date })}
              options={groups.map((group) => ({
                value: group.id,
                label: group.name,
              }))}
            />
          </label>

          {viewMode === 'monthly' ? (
            <div className="attendance-month-picker" aria-label="Oyni tanlash">
              <button
                type="button"
                className="month-nav-btn"
                onClick={goToPrevMonth}
                title="Oldingi oy"
                aria-label="Oldingi oy"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="month"
                aria-label="Davomat oyi"
                value={selectedMonth}
                onChange={(e) => e.target.value && handleMonthChange(e.target.value)}
              />
              <button
                type="button"
                className="month-nav-btn"
                onClick={goToNextMonth}
                title="Keyingi oy"
                aria-label="Keyingi oy"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ height: 38, padding: '0 14px', gap: 6 }}
                onClick={() => handleViewChange('daily', todayIso)}
                title="Bugungi kun davomatini olish"
              >
                <CalendarCheck size={15} />
                <span>Davomat olish</span>
              </button>
            </div>
          ) : (
            <label>Sana
              <DateInput aria-label="Sana" value={date} onChange={(nextDate) => nextDate && requestFilterChange({ groupId, date: nextDate })} />
            </label>
          )}
        </div>

        {viewMode === 'daily' && q.data ? (
          <div className="attendance-overview" aria-label="Davomat xulosasi">
            <span>Jami: {rows.length}</span>
            <span className="came">Keldi: {rows.filter((x) => x.status === 'came').length}</span>
            <span className="excused">Sababli: {rows.filter((x) => x.status === 'excused').length}</span>
            <span className="absent">Sababsiz: {rows.filter((x) => x.status === 'absent').length}</span>
            {rows.filter((x) => (x.status as string) === 'unmarked').length > 0 ? (
              <span className="unmarked" style={{ color: '#6b7280', fontWeight: 500 }}>
                Belgilanmagan: {rows.filter((x) => (x.status as string) === 'unmarked').length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {viewMode === 'monthly' ? (
        <div className="attendance-monthly-panel">
          {monthlyQ.isPending ? <div className="dashboard-state">Oylik davomat yuklanmoqda...</div> : null}
          {monthlyQ.isError ? <div className="dashboard-state dashboard-error">Oylik davomatni yuklab bo‘lmadi</div> : null}
          {monthlyQ.data ? (
            <>
              <div className="monthly-summary-strip">
                <div className="monthly-stats-badges">
                  <span className="monthly-stat-pill">
                    <strong>{monthlyQ.data.stats.totalStudents}</strong> ta o‘quvchi
                  </span>
                  <span className="monthly-stat-pill">
                    <strong>{monthlyQ.data.stats.totalLessons}</strong> ta dars
                  </span>
                  <span className="monthly-stat-pill">
                    O‘rtacha davomat: <strong>{monthlyQ.data.stats.averageAttendancePercentage}%</strong>
                  </span>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ height: 28, fontSize: 12, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6 }}
                    onClick={() => handleViewChange('daily', todayIso)}
                    title="Bugungi kun davomatini olish"
                  >
                    <CalendarCheck size={13} />
                    <span>Davomat olish</span>
                  </button>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)', cursor: 'pointer', marginLeft: 8 }}>
                    <input
                      type="checkbox"
                      checked={onlyLessonDays}
                      onChange={(e) => setOnlyLessonDays(e.target.checked)}
                      style={{ accentColor: 'var(--gold)' }}
                    />
                    Faqat dars kunlari
                  </label>
                </div>
                <div className="monthly-legend">
                  <span className="legend-item"><span className="legend-badge came">+</span> Keldi</span>
                  <span className="legend-item"><span className="legend-badge excused">S</span> Sababli</span>
                  <span className="legend-item"><span className="legend-badge absent">-</span> Sababsiz</span>
                  <span className="legend-item"><span className="legend-badge unmarked">·</span> Belgilanmagan</span>
                </div>
              </div>

              {monthlyQ.data.students.length === 0 ? (
                <div className="empty-state">Ushbu guruhda o‘quvchilar mavjud emas</div>
              ) : (
                <div className="monthly-table-scroll">
                  <table className="monthly-attendance-table" aria-label="Oylik davomat jadvali">
                    <thead>
                      <tr>
                        <th className="sticky-col col-num">№</th>
                        <th className="sticky-col col-name">O‘quvchi</th>
                        {monthlyDays.map((d) => (
                          <th
                            key={d.date}
                            className={`col-day ${d.hasLesson ? 'has-lesson' : ''}`}
                            title={d.lessonTitle ? `${d.date} (${d.weekday}): ${d.lessonTitle}\nDavomat olish uchun bosing` : `${d.date} (${d.weekday}) — Davomat olish uchun bosing`}
                            onClick={() => handleViewChange('daily', d.date)}
                          >
                            <span className="day-number">{d.dayNumber.toString().padStart(2, '0')}</span>
                            <span className="day-weekday">{d.weekday}</span>
                          </th>
                        ))}
                        <th className="col-stat stat-came" title="Keldi">Keldi</th>
                        <th className="col-stat stat-excused" title="Sababli">Sababli</th>
                        <th className="col-stat stat-absent" title="Sababsiz">Sababsiz</th>
                        <th className="col-stat stat-pct" title="Davomat foizi">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyQ.data.students.map((student, idx) => (
                        <tr key={student.studentId} role="presentation">
                          <td className="sticky-col col-num">{idx + 1}</td>
                          <td className="sticky-col col-name" title={`${student.studentName} (${student.studentCode})`}>
                            <strong>{student.studentName} ({student.studentCode})</strong>
                          </td>
                          {monthlyDays.map((d) => {
                            const att = student.days[d.date];
                            if (!d.hasLesson && !att) {
                              return (
                                <td key={d.date} className="col-day-cell">
                                  <span className="empty-dot">·</span>
                                </td>
                              );
                            }
                            const status = att?.status ?? 'unmarked';
                            return (
                              <td
                                key={d.date}
                                className="col-day-cell"
                                onClick={() => handleViewChange('daily', d.date)}
                                title={`${student.studentName} — ${d.date} (${statusLabels[status as keyof typeof statusLabels] || status})`}
                              >
                                {status === 'came' ? (
                                  <span className="badge-came">+</span>
                                ) : status === 'excused' ? (
                                  <span className="badge-excused">S</span>
                                ) : status === 'absent' ? (
                                  <span className="badge-absent">-</span>
                                ) : (
                                  <span className="badge-unmarked">·</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="col-stat stat-came" style={{ color: '#16a34a', fontWeight: 600 }}>{student.stats?.came ?? 0}</td>
                          <td className="col-stat stat-excused" style={{ color: '#ca8a04', fontWeight: 500 }}>{student.stats?.excused ?? 0}</td>
                          <td className="col-stat stat-absent" style={{ color: '#dc2626', fontWeight: 500 }}>{student.stats?.absent ?? 0}</td>
                          <td className="col-stat stat-pct">
                            <span className={`pct-badge ${(student.stats?.percentage ?? 0) >= 85 ? 'high' : (student.stats?.percentage ?? 0) >= 60 ? 'mid' : 'low'}`}>
                              {student.stats?.percentage ?? 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      {viewMode === 'daily' && q.isPending ? <div className="dashboard-state">Davomat yuklanmoqda...</div> : null}
      {viewMode === 'daily' && q.isError ? <div className="dashboard-state dashboard-error">Davomat yuklanmadi</div> : null}

      {viewMode === 'daily' && q.data ? (
        <div className="panel attendance-register">
          <div className="attendance-lesson-bar" aria-label="Dars rejasi">
            <div className="attendance-lesson-item">
              <label htmlFor="attendance-lesson-topic" className="attendance-lesson-label">
                <BookOpen size={14} className="lesson-bar-icon" />
                <span>Dars mavzusi:</span>
              </label>
              <input
                id="attendance-lesson-topic"
                type="text"
                className="attendance-lesson-input"
                placeholder="Mavzu nomi (masalan: Present Simple)..."
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
              />
            </div>
            <div className="attendance-lesson-item">
              <label htmlFor="attendance-lesson-homework" className="attendance-lesson-label">
                <FileText size={14} className="lesson-bar-icon" />
                <span>Uyga vazifa:</span>
              </label>
              <input
                id="attendance-lesson-homework"
                type="text"
                className="attendance-lesson-input"
                placeholder="Keyingi darsga vazifa (masalan: 12-15 mashqlar)..."
                value={homeworkText}
                onChange={(e) => setHomeworkText(e.target.value)}
              />
            </div>
          </div>

          <div className="table-scroll">
            <table aria-label="Davomat jurnali">
              <thead>
                <tr>
                  <th>O‘quvchi</th>
                  <th>Holat</th>
                  <th>Vazifa %</th>
                  <th>Dars %</th>
                  <th>Lug'at / Test %</th>
                  <th>Baho</th>
                  <th>Izoh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isCame = r.status === 'came';
                  const hwVal = typeof r.homeworkScore === 'number' ? r.homeworkScore : null;
                  const topicVal = typeof r.topicScore === 'number' ? r.topicScore : null;
                  const dictVal = typeof r.dictionaryScore === 'number' ? r.dictionaryScore : null;
                  const avgVal = r.rating !== null && r.rating !== undefined ? r.rating : calculateAttendanceAverage(hwVal, topicVal, dictVal);
                  const hasAnyScore = hwVal !== null || topicVal !== null || dictVal !== null;

                  return (
                    <tr key={r.studentId}>
                      <td className="attendance-card-head" data-label="O‘quvchi">
                        <strong>{r.studentName}</strong>
                        <small>{r.studentCode}</small>
                      </td>
                      <td className="attendance-card-status" data-label="Holat">
                        <div className="status-choice">
                          {Object.entries(statusLabels).map(([v, l]) => (
                            <button 
                              type="button" 
                              key={v} 
                              className={r.status === v ? v : ''} 
                              onClick={() => patch(r.studentId, { status: v as AttendanceRow['status'] })}
                              aria-label={`${r.studentName}: ${l}`}
                              aria-pressed={r.status === v}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="attendance-card-meta attendance-card-rating attendance-card-vazifa" data-label="Vazifa %">
                        <span className="attendance-mobile-label">Vazifa %</span>
                        <div className="attendance-rating-control">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            disabled={!isCame}
                            value={isCame && typeof hwVal === 'number' ? hwVal : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              updateScore(r.studentId, 'homeworkScore', parseScoreInput(e.target.value));
                            }}
                            placeholder="—"
                            aria-label={`${r.studentName} vazifa bahosi`}
                            title="Vazifa %"
                          />
                          <span className="attendance-rating-unit">%</span>
                        </div>
                      </td>
                      <td className="attendance-card-meta attendance-card-rating attendance-card-dars" data-label="Dars %">
                        <span className="attendance-mobile-label">Dars %</span>
                        <div className="attendance-rating-control">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            disabled={!isCame}
                            value={isCame && typeof topicVal === 'number' ? topicVal : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              updateScore(r.studentId, 'topicScore', parseScoreInput(e.target.value));
                            }}
                            placeholder="—"
                            aria-label={`${r.studentName} dars bahosi`}
                            title="Dars %"
                          />
                          <span className="attendance-rating-unit">%</span>
                        </div>
                      </td>
                      <td className="attendance-card-meta attendance-card-rating attendance-card-lugat" data-label="Lug'at / Test %">
                        <span className="attendance-mobile-label">Lug'at / Test %</span>
                        <div className="attendance-rating-control">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            disabled={!isCame}
                            value={isCame && typeof dictVal === 'number' ? dictVal : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              updateScore(r.studentId, 'dictionaryScore', parseScoreInput(e.target.value));
                            }}
                            placeholder="—"
                            aria-label={`${r.studentName} lug'at / test bahosi`}
                            title="Lug'at / Test %"
                          />
                          <span className="attendance-rating-unit">%</span>
                        </div>
                      </td>
                      <td className="attendance-card-meta attendance-card-baho" data-label="Baho">
                        <span className="attendance-mobile-label">Baho</span>
                        {isCame && hasAnyScore && avgVal !== null ? (
                          <span className={`attendance-avg-badge ${avgVal >= 85 ? 'high' : avgVal >= 60 ? 'mid' : 'low'}`}>
                            {avgVal}%
                          </span>
                        ) : (
                          <span className="attendance-avg-empty">—</span>
                        )}
                      </td>
                      <td className="attendance-card-comment" data-label="Izoh">
                        <span className="attendance-mobile-label">Izoh</span>
                        <input 
                          value={r.comment} 
                          aria-label={`${r.studentName} izoh`}
                          onChange={(e) => patch(r.studentId, { comment: e.target.value })} 
                          placeholder="Izoh yozish..." 
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="attendance-savebar" aria-live="polite">
            <button
              type="button"
              className="secondary-button attendance-mark-all-btn"
              onClick={handleMarkAllCame}
              title="Barcha o‘quvchilarni 'Keldi' deb belgilash"
            >
              <CheckCheck size={15} />
              <span>Barchasi keldi</span>
            </button>

            {showSuccess && <span className="save-success-badge">Muvaffaqiyatli saqlandi!</span>}
            {isDirty && !showSuccess && (
              <span className="unsaved-changes-badge">
                {changedCount} ta saqlanmagan o‘zgarish
              </span>
            )}
            {rows.filter((x) => (x.status as string) === 'unmarked').length > 0 && (
              <span className="unsaved-badge" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
                {rows.filter((x) => (x.status as string) === 'unmarked').length} ta o‘quvchi belgilanmagan
              </span>
            )}
            {save.isError ? <span className="save-error-badge" role="alert">Davomat saqlanmadi. Qayta urinib ko‘ring.</span> : null}

            <div className="attendance-savebar-spacer" />

            <button
              type="button"
              className="secondary-button attendance-broadcast-btn"
              onClick={() => setShowBroadcastModal(true)}
              title="Telegram guruh va botga dars xulosasini yuborish"
            >
              <Send size={15} />
              <span>Telegram'ga yuborish</span>
            </button>

            <button 
              className="primary-button" 
              type="button" 
              disabled={!q.data || !isDirty || save.isPending} 
              onClick={handleSave}
            >
              <Save size={16} />
              {save.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      ) : null}

      {pendingNavigation ? (
        <ConfirmDialog
          title="O‘zgarishlar saqlanmagan"
          description="Boshqa bo‘lim yoki sanaga o‘tsangiz, kiritilgan o‘zgarishlar yo‘qoladi."
          confirmLabel="O‘zgarishsiz davom etish"
          onCancel={() => setPendingNavigation(null)}
          onConfirm={() => discardAndProceed(pendingNavigation)}
        />
      ) : null}

      {showUnmarkedConfirm ? (
        <ConfirmDialog
          title="Belgilanmagan o‘quvchilar bor"
          description={`${rows.filter((x) => (x.status as string) === 'unmarked').length} ta o‘quvchining davomati belgilanmagan. Ularni 'Keldi' deb saqlashni xohlaysizmi?`}
          confirmLabel="Ha, 'Keldi' deb saqlash"
          cancelLabel="Bekor qilish"
          onCancel={() => setShowUnmarkedConfirm(false)}
          onConfirm={() => void handleConfirmUnmarkedAsCame()}
        />
      ) : null}

      {showTelegramPrompt && selectedGroup ? (
        <ConfirmDialog
          title="Davomat saqlandi!"
          description="Dars hisoboti Telegram guruhga ham yuborilsinmi?"
          confirmLabel="Telegramga yuborish"
          cancelLabel="Shart emas"
          variant="primary"
          onCancel={() => setShowTelegramPrompt(false)}
          onConfirm={() => {
            setShowTelegramPrompt(false);
            setShowBroadcastModal(true);
          }}
        />
      ) : null}

      {showBroadcastModal && selectedGroup ? (
        <LessonBroadcastModal
          isOpen={showBroadcastModal}
          onClose={() => setShowBroadcastModal(false)}
          groupId={groupId}
          groupName={selectedGroup.name}
          date={date}
          initialTopic={lessonTitle}
          initialHomework={homeworkText}
          telegramChatId={selectedGroup.telegramChatId}
          telegramChatTitle={selectedGroup.telegramChatTitle}
          isPending={broadcastMutation.isPending}
          onBroadcast={async (params) => {
            setLessonTitle(params.topic);
            setHomeworkText(params.homeworkText);
            const resolvedRows = rows.map((r) =>
              (r.status as string) === 'unmarked' ? { ...r, status: 'came' as const } : r,
            );
            setRows(resolvedRows);
            if (q.data) {
              const formatted = formatLessonPlan(params.topic, params.homeworkText);
              await save.mutateAsync({
                ...q.data,
                topic: params.topic,
                lessonTitle: params.topic,
                homeworkText: formatted,
                rows: resolvedRows,
              });
            }
            return await broadcastMutation.mutateAsync({
              groupId,
              date,
              topic: params.topic,
              homeworkText: params.homeworkText,
              sendToGroupChat: params.sendToGroupChat,
              sendToStudents: params.sendToStudents,
            });
          }}
        />
      ) : null}
    </section>
  );
}
