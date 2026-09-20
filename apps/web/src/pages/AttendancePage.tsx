import type { AttendanceRow } from '@golden-study/contracts';
import { BookOpen, FileText, Save, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAttendance, useBroadcastAttendance, useSaveAttendance } from '../features/attendance/useAttendance';
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

import { useGroups } from '../features/groups/useGroups';

const statusLabels = {
  came: 'Keldi',
  excused: 'Sababli',
  absent: 'Sababsiz'
} as const;

export function AttendancePage() {
  const { data: groups = [] } = useGroups();
  const [groupId, setGroupId] = useState('g1');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [lessonTitle, setLessonTitle] = useState('');
  const [homeworkText, setHomeworkText] = useState('');
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<{ groupId: string; date: string } | null>(null);

  useEffect(() => {
    if (groups.length > 0 && (groupId === 'g1' || !groups.some((g) => g.id === groupId))) {
      setGroupId(groups[0].id);
    }
  }, [groups, groupId]);

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

  function patch(id: string, value: Partial<AttendanceRow>) {
    setRows((v) => v.map((x) => x.studentId === id ? { ...x, ...value } : x));
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

  async function handleSave() {
    if (!q.data) return;
    const formatted = formatLessonPlan(lessonTitle, homeworkText);
    await save.mutateAsync({
      ...q.data,
      topic: lessonTitle,
      lessonTitle,
      homeworkText: formatted,
      rows,
    });
    setShowTelegramPrompt(true);
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

          <label>Sana
            <DateInput aria-label="Sana" value={date} onChange={(nextDate) => nextDate && requestFilterChange({ groupId, date: nextDate })} />
          </label>
        </div>
        {q.data ? (
          <div className="attendance-overview" aria-label="Davomat xulosasi">
            <span>Jami: {rows.length}</span>
            <span className="came">Keldi: {rows.filter((x) => x.status === 'came').length}</span>
            <span className="excused">Sababli: {rows.filter((x) => x.status === 'excused').length}</span>
            <span className="absent">Sababsiz: {rows.filter((x) => x.status === 'absent').length}</span>
          </div>
        ) : null}
      </div>

      {q.isPending ? <div className="dashboard-state">Davomat yuklanmoqda...</div> : null}
      {q.isError ? <div className="dashboard-state dashboard-error">Davomat yuklanmadi</div> : null}

      {q.data ? (
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
            {showSuccess && <span className="save-success-badge">Muvaffaqiyatli saqlandi!</span>}
            {isDirty && !showSuccess && <span className="unsaved-badge">{changedCount} ta saqlanmagan o‘zgarish</span>}
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
              disabled={!q.data || !isDirty || save.isPending} 
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
            if (q.data) {
              const formatted = formatLessonPlan(params.topic, params.homeworkText);
              await save.mutateAsync({
                ...q.data,
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
