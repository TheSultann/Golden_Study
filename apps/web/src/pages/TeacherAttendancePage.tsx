import type { AttendanceRow } from '@golden-study/contracts';
import { LockKeyhole, Save, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSaveTeacherAttendance, useTeacherAttendance, useTeacherAttendanceGroups } from '../features/teacher-attendance/useTeacherAttendance';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { DateInput } from '../shared/ui/DateInput';

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<{ groupId: string; date: string } | null>(null);
  
  // Yulduzchalar uchun hover holatini saqlash (kalit: studentId, qiymat: yulduzcha soni)
  const [hoveredRatings, setHoveredRatings] = useState<Record<string, number>>({});

  const query = useTeacherAttendance(groupId, date);
  const save = useSaveTeacherAttendance();

  useEffect(() => {
    if (groupsQuery.data && groupsQuery.data.length > 0) {
      if (groupId === 'g1' || !groupsQuery.data.some((g) => g.id === groupId)) {
        setGroupId(groupsQuery.data[0].id);
      }
    }
  }, [groupsQuery.data, groupId]);

  useEffect(() => {
    if (query.data) setRows(query.data.rows);
  }, [query.data]);

  useEffect(() => {
    if (save.isSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [save.isSuccess]);

  const isDirty = query.data ? JSON.stringify(rows) !== JSON.stringify(query.data.rows) : false;

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
          <select aria-label="Guruh" value={groupId} onChange={(event) => requestFilterChange({ groupId: event.target.value, date })}>
            {(groupsQuery.data ?? []).map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </label>
        <label>Sana
          <DateInput aria-label="Sana" value={date} onChange={(nextDate) => nextDate && requestFilterChange({ groupId, date: nextDate })} />
        </label>
      </div>

      {query.isPending || groupsQuery.isPending ? <div className="dashboard-state">Davomat yuklanmoqda...</div> : null}
      {query.isError || groupsQuery.isError ? <div className="dashboard-state dashboard-error">Davomat yuklanmadi</div> : null}

      {query.data ? (
        <div className="panel attendance-table">
          <div className="attendance-summary">
            <span>Jami: {rows.length}ta o‘quvchi</span>
            <span className="came">Keldi: {rows.filter((row) => row.status === 'came').length}</span>
            <span className="excused">Sababli: {rows.filter((row) => row.status === 'excused').length}</span>
            <span className="absent">Sababsiz: {rows.filter((row) => row.status === 'absent').length}</span>
          </div>
          <div className="table-scroll">
            <table aria-label="Davomat jurnali">
              <thead>
                <tr>
                  <th>O'quvchi</th>
                  <th>Holat</th>
                  <th>Reyting</th>
                  <th>Uy vazifasi</th>
                  <th>Izoh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.studentId} className={row.lockedByAdmin ? 'attendance-locked' : ''}>
                    <td data-label="O'quvchi">
                      <strong>{row.studentName}</strong>
                      <small>{row.studentCode}</small>
                      {row.lockedByAdmin ? (
                        <em>
                          <LockKeyhole size={11} style={{ marginRight: '3px' }} /> 
                          Admin yopgan (Bloklangan)
                        </em>
                      ) : null}
                    </td>
                    <td data-label="Holat">
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
                    <td data-label="Reyting">
                      <div className="rating">
                        {[1, 2, 3, 4, 5].map((rating) => {
                          const activeRating = !row.lockedByAdmin && hoveredRatings[row.studentId] !== undefined 
                            ? hoveredRatings[row.studentId] 
                            : row.rating;
                          return (
                            <button 
                              type="button" 
                              key={rating} 
                              disabled={row.lockedByAdmin} 
                              className={rating <= activeRating ? 'on' : ''} 
                              aria-label={`${row.studentName}: ${rating} yulduz`} 
                              onClick={() => patch(row.studentId, { rating })}
                              onMouseEnter={() => !row.lockedByAdmin && setHoveredRatings(prev => ({ ...prev, [row.studentId]: rating }))}
                              onMouseLeave={() => !row.lockedByAdmin && setHoveredRatings(prev => {
                                const copy = { ...prev };
                                delete copy[row.studentId];
                                return copy;
                              })}
                            >
                              <Star size={15} />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td data-label="Uy vazifasi">
                      <label className="custom-checkbox-container" style={{ cursor: row.lockedByAdmin ? 'not-allowed' : 'pointer' }}>
                        <input 
                          type="checkbox" 
                          disabled={row.lockedByAdmin} 
                          className="custom-checkbox-input"
                          aria-label={`${row.studentName} uy vazifasi`} 
                          checked={row.homeworkDone} 
                          onChange={(event) => patch(row.studentId, { homeworkDone: event.target.checked })} 
                        />
                        <span className="custom-checkbox-box" style={{ opacity: row.lockedByAdmin ? 0.6 : 1 }}></span>
                      </label>
                    </td>
                    <td data-label="Izoh">
                      <input 
                        aria-label={`${row.studentName} izoh`} 
                        disabled={row.lockedByAdmin} 
                        value={row.comment} 
                        onChange={(event) => patch(row.studentId, { comment: event.target.value })} 
                        placeholder={row.lockedByAdmin ? "Tahrirlash yopiq" : "Izoh yozish..."} 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="attendance-actions">
            {showSuccess && <span className="save-success-badge">Muvaffaqiyatli saqlandi!</span>}
            {isDirty && !showSuccess && <span className="unsaved-badge">Saqlanmagan o‘zgarishlar mavjud</span>}
            <button 
              className="primary-button" 
              type="button" 
              disabled={!query.data || !isDirty || save.isPending} 
              onClick={() => query.data && save.mutate({ ...query.data, rows })}
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
    </section>
  );
}
