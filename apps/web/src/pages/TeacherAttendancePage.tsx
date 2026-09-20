import type { AttendanceRow } from '@golden-study/contracts';
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

export function TeacherAttendancePage() {
  const [searchParams] = useSearchParams();
  const groupsQuery = useTeacherAttendanceGroups();
  const [groupId, setGroupId] = useState(searchParams.get('group') ?? 'g1');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [lessonTitle, setLessonTitle] = useState('');
  const [homeworkText, setHomeworkText] = useState('');
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<{ groupId: string; date: string } | null>(null);

  const query = useTeacherAttendance(groupId, date);
  const save = useSaveTeacherAttendance();
  const broadcastMutation = useBroadcastTeacherAttendance();
  const selectedGroup = groupsQuery.data?.find((g) => g.id === groupId);

  useEffect(() => {
    if (groupsQuery.data && groupsQuery.data.length > 0) {
      if (groupId === 'g1' || !groupsQuery.data.some((g) => g.id === groupId)) {
        setGroupId(groupsQuery.data[0].id);
      }
    }
  }, [groupsQuery.data, groupId]);

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
    setGroupId(next.groupId);
    setDate(next.date);
    setPendingFilter(null);
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

  async function handleSave() {
    if (!query.data) return;
    const formatted = formatLessonPlan(lessonTitle, homeworkText);
    await save.mutateAsync({
      ...query.data,
      topic: lessonTitle,
      lessonTitle,
      homeworkText: formatted,
      rows,
    });
    setShowTelegramPrompt(true);
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
            if (query.data) {
              const formatted = formatLessonPlan(params.topic, params.homeworkText);
              await save.mutateAsync({
                ...query.data,
                topic: params.topic,
                lessonTitle: params.topic,
                homeworkText: formatted,
                rows,
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
