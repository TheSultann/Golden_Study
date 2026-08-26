import type { AttendanceRow } from '@golden-study/contracts';
import { Save, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAttendance, useSaveAttendance } from '../features/attendance/useAttendance';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { DateInput } from '../shared/ui/DateInput';

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<{ groupId: string; date: string } | null>(null);

  useEffect(() => {
    if (groups.length > 0 && (groupId === 'g1' || !groups.some((g) => g.id === groupId))) {
      setGroupId(groups[0].id);
    }
  }, [groups, groupId]);

  // Yulduzchalar uchun hover holatini saqlash (kalit: studentId, qiymat: yulduzcha soni)
  const [hoveredRatings, setHoveredRatings] = useState<Record<string, number>>({});

  const q = useAttendance(groupId, date);
  const save = useSaveAttendance();

  useEffect(() => {
    if (q.data) setRows(q.data.rows);
  }, [q.data]);

  useEffect(() => {
    if (save.isSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [save.isSuccess]);

  const changedCount = q.data?.rows.reduce((count, original) => {
    const current = rows.find((row) => row.studentId === original.studentId);
    return count + (JSON.stringify(current) === JSON.stringify(original) ? 0 : 1);
  }, 0) ?? 0;
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
          <select aria-label="Guruh" value={groupId} onChange={(e) => requestFilterChange({ groupId: e.target.value, date })}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <label>Sana
          <DateInput aria-label="Sana" value={date} onChange={(nextDate) => nextDate && requestFilterChange({ groupId, date: nextDate })} />
        </label>
      </div>
      {q.data ? <div className="attendance-overview" aria-label="Davomat xulosasi">
        <span>Jami: {rows.length}</span>
        <span className="came">Keldi: {rows.filter((x) => x.status === 'came').length}</span>
        <span className="excused">Sababli: {rows.filter((x) => x.status === 'excused').length}</span>
        <span className="absent">Sababsiz: {rows.filter((x) => x.status === 'absent').length}</span>
      </div> : null}
      </div>

      {q.isPending ? <div className="dashboard-state">Davomat yuklanmoqda...</div> : null}
      {q.isError ? <div className="dashboard-state dashboard-error">Davomat yuklanmadi</div> : null}

      {q.data ? (
        <div className="panel attendance-register">
          <div className="table-scroll">
            <table aria-label="Davomat jurnali">
              <thead>
                <tr>
                  <th>O‘quvchi</th>
                  <th>Holat</th>
                  <th>Reyting</th>
                  <th>Uy vazifasi</th>
                  <th>Izoh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td className="attendance-card-head">
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
                    <td className="attendance-card-meta attendance-card-rating" data-label="Reyting">
                      <span className="attendance-mobile-label">Reyting</span>
                      <div className="rating">
                        {[1, 2, 3, 4, 5].map((n) => {
                          const activeRating = hoveredRatings[r.studentId] !== undefined 
                            ? hoveredRatings[r.studentId] 
                            : r.rating;
                          return (
                            <button 
                              type="button" 
                              key={n} 
                              className={n <= activeRating ? 'on' : ''} 
                              onClick={() => patch(r.studentId, { rating: n })}
                              onMouseEnter={() => setHoveredRatings(prev => ({ ...prev, [r.studentId]: n }))}
                              onMouseLeave={() => setHoveredRatings(prev => {
                                const copy = { ...prev };
                                delete copy[r.studentId];
                                return copy;
                              })}
                              aria-label={`${r.studentName}: ${n} yulduz`}
                              aria-pressed={n <= r.rating}
                            >
                              <Star size={15} />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="attendance-card-meta attendance-card-homework" data-label="Uy vazifasi">
                      <span className="attendance-mobile-label">Uy vazifasi</span>
                      <label className="custom-checkbox-container">
                        <input 
                          type="checkbox" 
                          className="custom-checkbox-input"
                          aria-label={`${r.studentName} uy vazifasi`} 
                          checked={r.homeworkDone} 
                          onChange={(e) => patch(r.studentId, { homeworkDone: e.target.checked })} 
                        />
                        <span className="custom-checkbox-box"></span>
                      </label>
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
                ))}
              </tbody>
            </table>
          </div>
          {isDirty || showSuccess || save.isError || save.isPending ? <div className="attendance-savebar" aria-live="polite">
            {showSuccess && <span className="save-success-badge">Muvaffaqiyatli saqlandi!</span>}
            {isDirty && !showSuccess && <span className="unsaved-badge">{changedCount} ta saqlanmagan o‘zgarish</span>}
            {save.isError ? <span className="save-error-badge" role="alert">Davomat saqlanmadi. Qayta urinib ko‘ring.</span> : null}
            <button 
              className="primary-button" 
              type="button" 
              disabled={!q.data || !isDirty || save.isPending} 
              onClick={() => q.data && save.mutate({ ...q.data, rows })}
            >
              <Save size={16} />
              {save.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div> : null}
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
    </section>
  );
}
