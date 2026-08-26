import type { Student } from '@golden-study/contracts';
import { 
  MoreHorizontal, 
  Plus, 
  Search, 
  X, 
  Download, 
  Copy, 
  Check, 
  Edit, 
  Lock, 
  Unlock,
  Trash2,
  Snowflake
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { type FormEvent, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StudentProfileDrawer } from '../features/student-profile/StudentProfileDrawer';
import { useSaveStudent, useSetStudentStatus, useStudents, useDeleteStudent } from '../features/students/useStudents';
import { useGroups } from '../features/groups/useGroups';
import { CopyCodeButton } from '../shared/ui/CopyCodeButton';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { Pagination } from '../shared/ui/Pagination';
import { formatApiError } from '../shared/api/errorTranslation';
import { PhoneInput, normalizePhoneWithPrefix } from '../shared/ui/PhoneInput';
import { DateInput, displayToIsoDate } from '../shared/ui/DateInput';


import { joinFullName, splitFullName } from '../shared/utils/fullName';

const empty: Student[] = [];
const money = new Intl.NumberFormat('uz-UZ');
const labels = {
  active: 'Faol',
  frozen: 'Muzlatilgan',
  graduate: 'Bitirgan'
} as const;

// O'quvchi qo'shish / tahrirlash formasi
function Form({
  student,
  close,
  save,
  pending,
}: {
  student?: Student;
  close: () => void;
  save: (v: Student) => Promise<void>;
  pending?: boolean;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const groupsQuery = useGroups();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const d = new FormData(e.currentTarget);
    const { firstName, lastName } = splitFullName(String(d.get('fullName')));
    const phone = normalizePhoneWithPrefix(d.get('phone'));
    const parentPhone = normalizePhoneWithPrefix(d.get('parentPhone'));

    if (phone.replaceAll(/\D/g, '').length !== 12) {
      setFormError('O‘quvchi telefon raqami 9 ta raqamdan iborat bo‘lishi kerak.');
      return;
    }
    if (parentPhone.replaceAll(/\D/g, '').length !== 12) {
      setFormError('Ota-ona telefon raqami 9 ta raqamdan iborat bo‘lishi kerak.');
      return;
    }

    try {
      await save({
        id: student?.id ?? `new-${Date.now()}`,
        code: student?.code ?? `ST${Math.floor(100 + Math.random() * 900)}`,
        firstName,
        lastName,
        birthDate: displayToIsoDate(String(d.get('birthDate'))),
        phone,
        parentName: String(d.get('parentName')),
        parentPhone,
        address: String(d.get('address')),
        status: student?.status ?? 'active',
        balance: student?.balance ?? 0,
        groups: d.get('group') ? [String(d.get('group'))] : []
      });
    } catch (err: unknown) {
      setFormError(formatApiError(err, 'Saqlashda xatolik yuz berdi'));
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="teacher-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>{student ? 'O‘quvchini tahrirlash' : 'O‘quvchi qo‘shish'}</h2>
            <p>O‘quvchi va ota-ona ma’lumotlari</p>
          </div>
          <button type="button" onClick={close} aria-label="Yopish"><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          {formError ? (
            <div className="form-error-banner" role="alert" style={{ margin: '0 0 12px 0', padding: '8px 12px', background: 'rgb(239 68 68 / 10%)', border: '1px solid rgb(239 68 68 / 20%)', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
              {formError}
            </div>
          ) : null}
          <div className="form-grid">
            <label className="form-wide">Ism familiya
              <input name="fullName" required pattern=".*\s+.*" title="Ism va familiyani kiriting" defaultValue={student ? joinFullName(student.firstName, student.lastName) : ''} placeholder="Masalan: Sardor Abdullayev" />
            </label>
            <label>Tug‘ilgan sana
              <DateInput name="birthDate" defaultValue={student?.birthDate} required aria-label="Tug‘ilgan sana" />
            </label>
            <label>Telefon
              <PhoneInput name="phone" defaultValue={student?.phone} required />
            </label>
            <label className="parent-field-label">Ota-ona F.I.Sh.
              <input name="parentName" required defaultValue={student?.parentName} placeholder="Masalan: Abdullayev Anvar" />
            </label>
            <label className="parent-field-label">Ota-ona telefoni
              <PhoneInput name="parentPhone" defaultValue={student?.parentPhone} required />
            </label>
            <label className="form-wide">Manzil
              <input name="address" required defaultValue={student?.address} placeholder="Toshkent sh., Yunusobod tumani" />
            </label>
            <label className="form-wide">Guruh
              <select name="group" defaultValue={student?.groups[0] ?? ''} disabled={groupsQuery.isPending}>
                <option value="">Guruhsiz</option>
                {groupsQuery.isPending ? (
                  <option disabled>Guruhlar yuklanmoqda...</option>
                ) : (
                  (groupsQuery.data ?? []).filter((g) => g.active || (student?.groups || []).includes(g.name)).map((g) => (
                    <option key={g.id} value={g.name} disabled={!g.active}>
                      {g.name} {!g.active ? ' (Yakunlangan)' : ''}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
          <footer>
            <button type="button" className="secondary-button" onClick={close} disabled={pending}>Bekor</button>
            <button className="primary-button" disabled={pending}>
              {pending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </footer>
        </form>
      </section>
    </div>

  );
}

// Telegram botga ulash uchun o'quvchi ID modali
function TelegramTokenModal({ student, close }: { student: Student; close: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(student.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop">
      <section className="teacher-modal telegram-token-modal" role="dialog" aria-modal="true" aria-labelledby="telegram-connect-title">
        <header>
          <div>
            <h2 id="telegram-connect-title">Telegramga ulash</h2>
            <p>{student.firstName} {student.lastName} uchun o‘quvchi ID</p>
          </div>
          <button type="button" onClick={close} aria-label="Yopish"><X size={18} /></button>
        </header>
        <div style={{ padding: '8px 0' }}>
          <p className="token-instructions">
            ID’ni ota-onaga yuboring. U botga ID’ni kiritgach, ulanish so‘rovi CRM orqali tasdiqlanadi.
          </p>
          <div className="token-display-box">
            <span className="token-code">{student.code}</span>
            <button type="button" className="token-copy-btn" onClick={copyToClipboard} aria-label={`${student.code} nusxalash`}>
              {copied ? <Check size={18} style={{ color: '#15803d' }} /> : <Copy size={18} />}
            </button>
          </div>
          {copied && <p style={{ fontSize: '11px', color: '#15803d', fontWeight: '500', textAlign: 'center', margin: 0 }}>Nusxalandi!</p>}
        </div>
        <footer style={{ marginTop: '12px' }}>
          <button type="button" className="primary-button" style={{ width: '100%' }} onClick={close}>Yopish</button>
        </footer>
      </section>
    </div>
  );
}

// O'quvchilar ro'yxati bosh sahifasi
export function StudentsPage() {
  const navigate = useNavigate();
  const q = useStudents();
  const saveM = useSaveStudent();
  const statusM = useSetStudentStatus();
  const deleteM = useDeleteStudent();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Student['status'] | 'all'>('active');
  const [editing, setEditing] = useState<Student | 'new' | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null);
  const [telegramStudent, setTelegramStudent] = useState<Student | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [pendingFreeze, setPendingFreeze] = useState<Student | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);
  const [notice, setNotice] = useState<string | null>(null);


  const dropdownRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);

  function closeActionsMenu(restoreFocus = false) {
    setActiveDropdown(null);
    setDropdownCoords(null);
    if (restoreFocus) requestAnimationFrame(() => activeTriggerRef.current?.focus());
  }

  // Tashqi kliklarni kuzatish va menyularni yopish
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Agar klik dropdown menyudan yoki uning triggeridan tashqarida bo'lsa, uni yopish
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const trigger = (event.target as HTMLElement).closest('.actions-dropdown-trigger');
        if (!trigger) {
          closeActionsMenu();
        }
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExport(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && activeDropdown) closeActionsMenu(true);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDropdown]);

  const rawData = q.data;
  const data: Student[] = Array.isArray(rawData) ? rawData : Array.isArray((rawData as any)?.data) ? (rawData as any).data : empty;

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  const handleTabChange = (newTab: typeof tab) => {
    setTab(newTab);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const filtered = useMemo(() => {
    return data.filter(s => {
      const matchSearch = `${s.code} ${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase());
      const matchTab = tab === 'all' || s.status === tab;
      return matchSearch && matchTab;
    });
  }, [data, search, tab]);

  const paginatedStudents = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const counts = useMemo(() => ({
    active: data.filter((student) => student.status === 'active').length,
    frozen: data.filter((student) => student.status === 'frozen').length,
    graduate: data.filter((student) => student.status === 'graduate').length,
    all: data.length
  }), [data]);

  async function save(v: Student) {
    await saveM.mutateAsync(v);
    setEditing(null);
  }

  function handleExport(type: 'pdf' | 'csv') {
    setShowExport(false);
    setNotice(`O‘quvchilar ro‘yxati ${type.toUpperCase()} formatida tayyorlandi (mock).`);
  }

  const handleDropdownToggle = (e: React.MouseEvent<HTMLButtonElement>, studentId: string) => {
    e.stopPropagation();
    if (activeDropdown === studentId) {
      setActiveDropdown(null);
      setDropdownCoords(null);
    } else {
      activeTriggerRef.current = e.currentTarget;
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 180;
      const menuHeight = 148;
      const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
      const top = window.innerHeight - rect.bottom >= menuHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - menuHeight - 6);
      setDropdownCoords({
        top,
        left
      });
      setActiveDropdown(studentId);
    }
  };

  return (
    <section className="students-page">
      <div className="page-heading">
        <div>
          <h1>O‘quvchilar</h1>
          <p>O‘quvchilar, guruhlar va balans holati</p>
        </div>
        <div className="student-heading-actions">
          {/* Eksport Dropdown */}
          <div className="export-dropdown" ref={exportRef}>
            <button 
              type="button" 
              className="secondary-button student-header-button" 
              aria-label="O‘quvchilar ro‘yxatini eksport qilish"
              style={{ height: '38px' }}
              onClick={() => setShowExport(!showExport)}
            >
              <Download size={16} /> <span className="student-header-button-label">Eksport</span>
            </button>
            {showExport && (
              <div className="export-dropdown-menu">
                <button type="button" className="export-dropdown-item" onClick={() => handleExport('csv')}>
                  CSV yuklash
                </button>
                <button type="button" className="export-dropdown-item" onClick={() => handleExport('pdf')}>
                  PDF yuklash
                </button>
              </div>
            )}
          </div>

          <button type="button" className="primary-button student-header-button student-add-button" style={{ height: '38px' }} onClick={() => setEditing('new')}>
            <Plus size={16} /> <span className="student-header-button-label">O‘quvchi qo‘shish</span>
          </button>
        </div>
      </div>

      <div className="student-controls">
        <div className="student-tabs">
          {(['active', 'frozen', 'graduate', 'all'] as const).map(x => (
            <button 
              key={x} 
              className={tab === x ? 'active' : ''} 
              onClick={() => handleTabChange(x)}
            >
              <span>{x === 'all' ? 'Barchasi' : labels[x]}</span>
              <span className="student-tab-count">{counts[x]}</span>
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input 
            role="searchbox"
            aria-label="O‘quvchi qidirish" 
            value={search} 
            onChange={e => handleSearchChange(e.target.value)} 
            placeholder="ID, ism yoki familiya"
          />
          {search ? (
            <button type="button" className="search-clear" aria-label="Qidiruvni tozalash" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          ) : null}
        </label>
      </div>

      {q.isPending ? <div className="dashboard-state">O‘quvchilar yuklanmoqda...</div> : null}
      {q.isError ? <div className="dashboard-state dashboard-error" role="alert">O‘quvchilar yuklanmadi</div> : null}
      {statusM.isError && !pendingFreeze ? (
        <div className="dashboard-state dashboard-error" role="alert">
          {formatApiError(statusM.error, 'O‘quvchi holatini o‘zgartirib bo‘lmadi')}
        </div>
      ) : null}
      {notice ? <div className="inline-notice" role="status">{notice}</div> : null}

      {!q.isPending && !q.isError && filtered.length === 0 ? (
        <div className="panel student-empty" role="status">
          <Search size={20} />
          <strong>O‘quvchi topilmadi</strong>
          <span>Qidiruv yoki tanlangan holatni o‘zgartiring.</span>
        </div>
      ) : null}

      {filtered.length > 0 ? <div className="panel students-table">
        <div className="table-scroll">
          <table aria-label="O‘quvchilar ro‘yxati">
            <thead>
              <tr>
                <th>O‘quvchi / ID</th>
                <th>Telefon</th>
                <th>Ota-ona</th>
                <th>Guruh</th>
                <th>Balans</th>
                <th>Holat</th>
                <th style={{ width: '40px', textAlign: 'center' }} />
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map(s => (
                <tr
                  key={s.id}
                  className={`student-row ${s.status === 'frozen' ? 'student-row-frozen' : ''}`}
                  tabIndex={0}
                  aria-label={`${s.firstName} ${s.lastName} kartasini ochish`}
                  onClick={() => setProfileStudentId(s.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setProfileStudentId(s.id);
                    }
                  }}
                >
                  <td>
                    <span className="student-cell-label">O‘quvchi</span>
                    <div className="student-cell-value student-card-identity">
                      <strong className="student-card-name" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                        {s.firstName} {s.lastName}
                      </strong>
                      <div style={{ marginTop: '2px' }}>
                        <CopyCodeButton code={s.code} />
                      </div>
                    </div>
                  </td>
                  <td data-label="Telefon">
                    <span className="student-cell-label">Telefon</span>
                    <div className="student-cell-value">{s.phone}</div>
                  </td>
                  <td data-label="Ota-ona">
                    <span className="student-cell-label">Ota-ona</span>
                    <div className="student-cell-value">
                      <span className="student-parent-name">{s.parentName}</span>
                      <small>{s.parentPhone}</small>
                    </div>
                  </td>
                  <td data-label="Guruhlar">
                    <span className="student-cell-label">Guruhlar</span>
                    <div className="student-cell-value">
                      {s.groups.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {s.groups.map((g, idx) => (
                          <span 
                            key={idx} 
                            style={{ 
                              display: 'inline-block',
                              padding: '2px 6px',
                              backgroundColor: 'var(--surface-soft)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              fontSize: '9px',
                              color: 'var(--muted)',
                              marginTop: 0
                            }}
                          >
                            {g}
                          </span>
                        ))}
                        </div>
                      ) : '—'}
                    </div>
                  </td>
                  <td data-label="Balans" className={s.balance < 0 ? 'debt' : 'credit'}>
                    <span className="student-cell-label">Balans</span>
                    <div className="student-cell-value">{money.format(s.balance)} so‘m</div>
                  </td>
                  <td data-label="Holat">
                    <span className="student-cell-label">Holat</span>
                    <div className="student-cell-value">
                      <span className={`student-status student-status--${s.status}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {s.status === 'frozen' && <Snowflake size={11} className="ice-spin" style={{ animation: 'spin 10s linear infinite' }} />}
                        {labels[s.status]}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      type="button" 
                      className="actions-dropdown-trigger"
                      aria-label={`${s.code} amallari`} 
                      onClick={(e) => handleDropdownToggle(e, s.id)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div> : null}

      {profileStudentId ? (
        <StudentProfileDrawer
          studentId={profileStudentId}
          onClose={() => setProfileStudentId(null)}
          onEdit={(studentId) => {
            const student = data.find((item) => item.id === studentId);
            if (student) setEditing(student);
            setProfileStudentId(null);
          }}
        />
      ) : null}

      {editing ? (
        <Form 
          student={editing === 'new' ? undefined : editing} 
          close={() => setEditing(null)} 
          save={save} 
          pending={saveM.isPending}
        />
      ) : null}

      {telegramStudent ? (
        <TelegramTokenModal 
          student={telegramStudent} 
          close={() => setTelegramStudent(null)} 
        />
      ) : null}

      {pendingFreeze ? (
        <ConfirmDialog
          title="O‘quvchini muzlatish"
          description={`${pendingFreeze.firstName} ${pendingFreeze.lastName} uchun davomat va billing to‘xtatiladi.`}
          confirmLabel="Muzlatish"
          pending={statusM.isPending}
          variant="primary"
          errorMessage={statusM.error ? formatApiError(statusM.error, 'O‘quvchini muzlatib bo‘lmadi.') : null}
          onCancel={() => {
            setPendingFreeze(null);
            statusM.reset();
          }}
          onConfirm={() => statusM.mutate(
            { id: pendingFreeze.id, status: 'frozen' },
            { onSuccess: () => setPendingFreeze(null) }
          )}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="O‘quvchini o‘chirish"
          description={`“${pendingDelete.firstName} ${pendingDelete.lastName}” o‘quvchisi o‘chiriladi va arxivga o‘tkaziladi.`}
          confirmLabel="O‘chirish"
          pending={deleteM.isPending}
          variant="danger"
          errorMessage={deleteM.error ? formatApiError(deleteM.error, 'O‘quvchini o‘chirib bo‘lmadi.') : null}
          onCancel={() => {
            setPendingDelete(null);
            deleteM.reset();
          }}
          onConfirm={() => deleteM.mutate(
            pendingDelete.id,
            { onSuccess: () => setPendingDelete(null) }
          )}
        />
      ) : null}


      {/* Portal orqali body darajasida dropdownni chiqarish */}
      {activeDropdown && dropdownCoords && createPortal(
        <div 
          className="actions-dropdown-menu student-actions-menu" 
          ref={dropdownRef}
          role="menu"
          aria-label={`${data.find((student) => student.id === activeDropdown)?.code ?? ''} amallari`}
          style={{ 
            position: 'fixed',
            top: `${dropdownCoords.top}px`, 
            left: `${dropdownCoords.left}px`,
            margin: 0
          }}
        >
          {(() => {
            const student = filtered.find(x => x.id === activeDropdown);
            if (!student) return null;
            return (
              <>
                <button 
                  type="button" 
                  className="actions-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    navigate(`/finance?studentId=${student.id}`);
                    setActiveDropdown(null);
                    setDropdownCoords(null);
                  }}
                >
                  <Plus size={13} /> To‘lov qabul qilish
                </button>
                <button 
                  type="button" 
                  className="actions-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setEditing(student);
                    setActiveDropdown(null);
                    setDropdownCoords(null);
                  }}
                >
                  <Edit size={13} /> Tahrirlash
                </button>
                
                <button 
                  type="button" 
                  className="actions-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setTelegramStudent(student);
                    setActiveDropdown(null);
                    setDropdownCoords(null);
                  }}
                >
                  <Copy size={13} /> Telegram uchun ID
                </button>

                {student.status === 'active' ? (
                  <button 
                    type="button" 
                    className="actions-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setPendingFreeze(student);
                      closeActionsMenu();
                    }}
                  >
                    <Lock size={13} /> Muzlatish
                  </button>
                ) : (
                  <button 
                    type="button" 
                    className="actions-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      statusM.mutate({ id: student.id, status: 'active' });
                      setActiveDropdown(null);
                      setDropdownCoords(null);
                    }}
                  >
                    <Unlock size={13} /> Faollashtirish
                  </button>
                )}

                <button 
                  type="button" 
                  className="actions-dropdown-item danger"
                  role="menuitem"
                  onClick={() => {
                    setPendingDelete(student);
                    closeActionsMenu();
                  }}
                >
                  <Trash2 size={13} /> O‘chirish
                </button>

              </>
            );
          })()}
        </div>,
        document.querySelector('.app-shell') ?? document.body
      )}
    </section>
  );
}
