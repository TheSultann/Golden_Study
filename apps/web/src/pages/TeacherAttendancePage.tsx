import type { AttendanceRow, TeacherAttendanceGroup } from '@golden-study/contracts';
import { BookOpen, FileText, LockKeyhole, Save, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useBroadcastTeacherAttendance,
  useSaveTeacherAttendance,
  useTeacherAttendance,
  useTeacherAttendanceGroups,
} from '../features/teacher-attendance/useTeacherAttendance';
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

const statuses = {
  came: 'Keldi',
  excused: 'Sababli',
  absent: 'Sababsiz'
} as const;

const EMPTY_GROUPS: TeacherAttendanceGroup[] = [];

export function TeacherAttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const groupsQuery = useTeacherAttendanceGroups();
  const groups = groupsQuery.data ?? EMPTY_GROUPS;

  const urlGroup = searchParams.get('group');
  const urlDate = searchParams.get('date');

  const storedGroup = (() => {
    try {
      return localStorage.getItem('golden_study_teacher_group_id');
    } catch {
      return null;
    }
  })();

  const storedDate = (() => {
    try {
      return localStorage.getItem('golden_study_teacher_date');
    } catch {
      return null;
    }
  })();

  const todayIso = new Date().toLocaleDateString('en-CA');

  const groupId =
    (urlGroup && groups.some((g) => g.id === urlGroup) && urlGroup) ||
    (storedGroup && groups.some((g) => g.id === storedGroup) && storedGroup) ||
    groups[0]?.id ||
    'g1';

  const date =
    (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) && urlDate) ||
    (storedDate && /^\d{4}-\d{2}-\d{2}$/.test(storedDate) && storedDate) ||
    todayIso;

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [lessonTitle, setLessonTitle] = useState('');
  const [homeworkText, setHomeworkText] = useState('');
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showUnmarkedConfirm, setShowUnmarkedConfirm] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<{ groupId: string; date: string } | null>(null);

  const query = useTeacherAttendance(groupId, date);
  const save = useSaveTeacherAttendance();
  const broadcastMutation = useBroadcastTeacherAttendance();
  const selectedGroup = groups.find((g) => g.id === groupId);

  useEffect(() => {
    if (groups.length === 0) return;
    const currentGroup = searchParams.get('group');
    const currentDate = searchParams.get('date');
    const hasValidGroup = currentGroup && groups.some((g) => g.id === currentGroup);
    const hasValidDate = currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate);

    try {
      localStorage.setItem('golden_study_teacher_group_id', groupId);
      localStorage.setItem('golden_study_teacher_date', date);
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

  useEffect(() => {
    if (query.data) {
      setRows(query.data.rows.map(normalizeAttendanceRow));
      const parsed = parseLessonPlan(query.data.homeworkText || '');
      setLessonTitle(query.data.lessonTitle || query.data.topic || parsed.topic);
      setHomeworkText(parsed.topic ? parsed.homeworkText : (query.data.homeworkText || ''));
    }
  }, [query.data]);

  useEffect(() => {
    if (save.isSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [save.isSuccess]);

  const parsedPlan = parseLessonPlan(query.data?.homeworkText || '');
  const initialTopic = query.data ? (query.data.lessonTitle || query.data.topic || parsedPlan.topic) : '';
  const initialHw = query.data ? (parsedPlan.topic ? parsedPlan.homeworkText : (query.data.homeworkText || '')) : '';
  const isLessonPlanChanged = lessonTitle !== initialTopic || homeworkText !== initialHw;
  const isDirty = query.data
    ? (JSON.stringify(rows) !== JSON.stringify(query.data.rows.map(normalizeAttendanceRow)) || isLessonPlanChanged)
    : false;

  function applyFilter(next: { groupId: string; date: string }) {
    setPendingFilter(null);
    try {
      localStorage.setItem('golden_study_teacher_group_id', next.groupId);
      localStorage.setItem('golden_study_teacher_date', next.date);
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
      setPendingFilter(next);
      return;
    }
    applyFilter(next);
  }

  function patch(studentId: string, value: Partial<AttendanceRow>) {
    setRows((current) => 
      current.map((row) => 
        row.studentId === studentId && !row.lockedByAdmin ? { ...row, ...value } : row
      )
    );
  }

  function handleMarkAllCame() {
    setRows((current) => {
      const hasUnmarked = current.some((r) => (r.status as string) === 'unmarked');
      return current.map((r) => {
        if (r.lockedByAdmin) return r;
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
        if (row.studentId !== studentId || row.lockedByAdmin) return row;
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
    if (!query.data) return;
    const formatted = formatLessonPlan(lessonTitle, homeworkText);
    await save.mutateAsync({
      ...query.data,
      topic: lessonTitle,
      lessonTitle,
      homeworkText: formatted,
      rows: rowsToSave,
    });
    setShowTelegramPrompt(true);
  }

  async function handleSave() {
    if (!query.data) return;
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
    <section className="attendance-page teacher-attendance-page">
      <div className="page-heading">
        <div>
          <h1>Davomat</h1>
          <p>Faqat sizga biriktirilgan guruhlar</p>
        </div>
      </div>
      <div className="attendance-filters">
        <label>Guruh
          <Select
            aria-label="Guruh"
            value={groupId}
            onChange={(nextId) => requestFilterChange({ groupId: nextId, date })}
            options={(groupsQuery.data ?? []).map((group) => ({
              value: group.id,
              label: group.name,
            }))}
          />
        </label>
        <label>Sana
          <DateInput aria-label="Sana" value={date} onChange={(nextDate) => nextDate && requestFilterChange({ groupId, date: nextDate })} />
        </label>
      </div>

      {query.isPending || groupsQuery.isPending ? <div className="dashboard-state">Davomat yuklanmoqda...</div> : null}
      {query.isError || groupsQuery.isError ? <div className="dashboard-state dashboard-error">Davomat yuklanmadi</div> : null}

      {query.data ? (
        <div className="panel attendance-register">
          <div className="attendance-summary">
            <span>Jami: {rows.length}ta o‘quvchi</span>
            <span className="came">Keldi: {rows.filter((row) => row.status === 'came').length}</span>
            <span className="excused">Sababli: {rows.filter((row) => row.status === 'excused').length}</span>
            <span className="absent">Sababsiz: {rows.filter((row) => row.status === 'absent').length}</span>
            {rows.filter((row) => (row.status as string) === 'unmarked').length > 0 ? (
              <span className="unmarked" style={{ color: '#6b7280', fontWeight: 500 }}>
                Belgilanmagan: {rows.filter((row) => (row.status as string) === 'unmarked').length}
              </span>
            ) : null}
            <button
              type="button"
              className="secondary-button"
              onClick={handleMarkAllCame}
              style={{ height: 26, fontSize: 11, padding: '0 8px', marginLeft: 4 }}
              title="Barcha o‘quvchilarni 'Keldi' deb belgilash"
            >
              Barchasi keldi
            </button>
          </div>

          <div className="attendance-lesson-bar" aria-label="Dars rejasi">
            <div className="attendance-lesson-item">
              <label htmlFor="teacher-attendance-lesson-topic" className="attendance-lesson-label">
                <BookOpen size={14} className="lesson-bar-icon" />
                <span>Dars mavzusi:</span>
              </label>
              <input
                id="teacher-attendance-lesson-topic"
                type="text"
                className="attendance-lesson-input"
                placeholder="Mavzu nomi (masalan: Present Simple)..."
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
              />
            </div>
            <div className="attendance-lesson-item">
              <label htmlFor="teacher-attendance-lesson-homework" className="attendance-lesson-label">
                <FileText size={14} className="lesson-bar-icon" />
                <span>Uyga vazifa:</span>
              </label>
              <input
                id="teacher-attendance-lesson-homework"
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
                {rows.map((row) => {
                  const isCame = row.status === 'came';
                  const hwVal = typeof row.homeworkScore === 'number' ? row.homeworkScore : null;
                  const topicVal = typeof row.topicScore === 'number' ? row.topicScore : null;
                  const dictVal = typeof row.dictionaryScore === 'number' ? row.dictionaryScore : null;
                  const avgVal = row.rating !== null && row.rating !== undefined ? row.rating : calculateAttendanceAverage(hwVal, topicVal, dictVal);
                  const hasAnyScore = hwVal !== null || topicVal !== null || dictVal !== null;

                  return (
                    <tr key={row.studentId} className={row.lockedByAdmin ? 'attendance-locked' : ''}>
                      <td className="attendance-card-head" data-label="O‘quvchi">
                        <strong>{row.studentName}</strong>
                        <small>{row.studentCode}</small>
                        {row.lockedByAdmin ? (
                          <em>
                            <LockKeyhole size={11} style={{ marginRight: '3px' }} /> 
                            Admin yopgan (Bloklangan)
                          </em>
                        ) : null}
                      </td>
                      <td className="attendance-card-status" data-label="Holat">
                        <div className="status-choice">
                          {Object.entries(statuses).map(([value, label]) => (
                            <button 
                              aria-label={`${row.studentName}: ${label}`} 
                              type="button" 
                              key={value} 
                              disabled={row.lockedByAdmin} 
                              className={row.status === value ? value : ''} 
                              onClick={() => patch(row.studentId, { status: value as AttendanceRow['status'] })}
                            >
                              {label}
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
                            disabled={row.lockedByAdmin || !isCame}
                            value={isCame && typeof hwVal === 'number' ? hwVal : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              updateScore(row.studentId, 'homeworkScore', parseScoreInput(e.target.value));
                            }}
                            placeholder="—"
                            aria-label={`${row.studentName} vazifa bahosi`}
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
                            disabled={row.lockedByAdmin || !isCame}
                            value={isCame && typeof topicVal === 'number' ? topicVal : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              updateScore(row.studentId, 'topicScore', parseScoreInput(e.target.value));
                            }}
                            placeholder="—"
                            aria-label={`${row.studentName} dars bahosi`}
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
                            disabled={row.lockedByAdmin || !isCame}
                            value={isCame && typeof dictVal === 'number' ? dictVal : ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              updateScore(row.studentId, 'dictionaryScore', parseScoreInput(e.target.value));
                            }}
                            placeholder="—"
                            aria-label={`${row.studentName} lug'at / test bahosi`}
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
                          value={row.comment} 
                          disabled={row.lockedByAdmin}
                          aria-label={`${row.studentName} izoh`}
                          onChange={(e) => patch(row.studentId, { comment: e.target.value })} 
                          placeholder="Izoh yozish..." 
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="attendance-actions">
            {showSuccess && <span className="save-success-badge">Muvaffaqiyatli saqlandi!</span>}
            {isDirty && !showSuccess && <span className="unsaved-badge">Saqlanmagan o‘zgarishlar mavjud</span>}
            {rows.filter((x) => (x.status as string) === 'unmarked').length > 0 && (
              <span className="unsaved-badge" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
                {rows.filter((x) => (x.status as string) === 'unmarked').length} ta o‘quvchi belgilanmagan
              </span>
            )}
            {save.isError ? <span className="save-error-badge" role="alert">Davomat saqlanmadi. Qayta urinib ko‘ring.</span> : null}

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
              disabled={!query.data || !isDirty || save.isPending} 
              onClick={handleSave}
            >
              <Save size={16} />
              {save.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      ) : null}

      {pendingFilter ? (
        <ConfirmDialog
          title="O‘zgarishlar saqlanmagan"
          description="Guruh yoki sanani almashtirsangiz, kiritilgan o‘zgarishlar yo‘qoladi."
          confirmLabel="O‘zgarishsiz davom etish"
          onCancel={() => setPendingFilter(null)}
          onConfirm={() => applyFilter(pendingFilter)}
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
            if (query.data) {
              const formatted = formatLessonPlan(params.topic, params.homeworkText);
              await save.mutateAsync({
                ...query.data,
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
