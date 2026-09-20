/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const attendancePage = readFileSync(
  resolve(process.cwd(), 'src/pages/AttendancePage.tsx'),
  'utf8',
)
const teacherAttendancePage = readFileSync(
  resolve(process.cwd(), 'src/pages/TeacherAttendancePage.tsx'),
  'utf8',
)
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('Senior Pro Davomat UX improvements', () => {
  describe('1. 7 Clean Columns & 100% Table Layout (Zero Horizontal Scrollbar)', () => {
    it('establishes 7 clean columns in AttendancePage', () => {
      expect(attendancePage).toContain('<th>O‘quvchi</th>')
      expect(attendancePage).toContain('<th>Holat</th>')
      expect(attendancePage).toContain('<th>Vazifa %</th>')
      expect(attendancePage).toContain('<th>Dars %</th>')
      expect(attendancePage).toContain('<th>Lug\'at / Test %</th>')
      expect(attendancePage).toContain('<th>Baho</th>')
      expect(attendancePage).toContain('<th>Izoh</th>')
    })

    it('establishes 7 clean columns in TeacherAttendancePage', () => {
      expect(teacherAttendancePage).toContain('<th>O‘quvchi</th>')
      expect(teacherAttendancePage).toContain('<th>Holat</th>')
      expect(teacherAttendancePage).toContain('<th>Vazifa %</th>')
      expect(teacherAttendancePage).toContain('<th>Dars %</th>')
      expect(teacherAttendancePage).toContain('<th>Lug\'at / Test %</th>')
      expect(teacherAttendancePage).toContain('<th>Baho</th>')
      expect(teacherAttendancePage).toContain('<th>Izoh</th>')
    })

    it('defines column widths summing to 100% in index.css (17%, 22%, 9.5%, 9.5%, 11%, 8%, 23%) and zero horizontal scrollbar', () => {
      expect(css).toContain('.attendance-register th:nth-child(1) { width:17%; }')
      expect(css).toContain('.attendance-register th:nth-child(2) { width:22%; }')
      expect(css).toContain('.attendance-register th:nth-child(3) { width:9.5%; }')
      expect(css).toContain('.attendance-register th:nth-child(4) { width:9.5%; }')
      expect(css).toContain('.attendance-register th:nth-child(5) { width:11%; }')
      expect(css).toContain('.attendance-register th:nth-child(6) { width:8%;text-align:center; }')
      expect(css).toContain('.attendance-register th:nth-child(7) { width:23%; }')
      expect(css).toContain('.attendance-register .table-scroll { overflow-x:hidden; }')
    })

    it('maps all 3 sub-scores and calculates smart average badge in AttendancePage and TeacherAttendancePage', () => {
      expect(attendancePage).toContain('updateScore')
      expect(attendancePage).toContain('calculateAttendanceAverage')
      expect(teacherAttendancePage).toContain('updateScore')
      expect(teacherAttendancePage).toContain('calculateAttendanceAverage')
    })
  })

  describe('2. Clean Lesson Plan Bar (Dars rejasi)', () => {
    it('removes clunky Xulosa yuborish button from top bar in AttendancePage', () => {
      expect(attendancePage).toContain('className="attendance-lesson-bar"')
      expect(attendancePage).toContain('Dars mavzusi:')
      expect(attendancePage).toContain('Uyga vazifa:')
      expect(attendancePage).toContain('placeholder="Mavzu nomi')
      expect(attendancePage).toContain('placeholder="Keyingi darsga vazifa')
      expect(attendancePage).not.toContain('className="attendance-lesson-action"')
    })

    it('removes clunky Xulosa yuborish button from top bar in TeacherAttendancePage', () => {
      expect(teacherAttendancePage).toContain('className="attendance-lesson-bar"')
      expect(teacherAttendancePage).toContain('Dars mavzusi:')
      expect(teacherAttendancePage).toContain('Uyga vazifa:')
      expect(teacherAttendancePage).toContain('placeholder="Mavzu nomi')
      expect(teacherAttendancePage).toContain('placeholder="Keyingi darsga vazifa')
      expect(teacherAttendancePage).not.toContain('className="attendance-lesson-action"')
    })
  })

  describe('3. Telegram Broadcast Workflow (Post-Save Prompt & Direct Button)', () => {
    it('places Telegram broadcast button and post-save prompt in AttendancePage', () => {
      expect(attendancePage).toContain('className="attendance-savebar"')
      expect(attendancePage).toContain('Telegram\'ga yuborish')
      expect(attendancePage).toContain('setShowTelegramPrompt(true)')
      expect(attendancePage).toContain('setShowBroadcastModal(true)')
      expect(attendancePage).not.toContain('Telegram guruhga ham yuborish')
    })

    it('places Telegram broadcast button and post-save prompt in TeacherAttendancePage', () => {
      expect(teacherAttendancePage).toContain('className="attendance-actions"')
      expect(teacherAttendancePage).toContain('Telegram\'ga yuborish')
      expect(teacherAttendancePage).toContain('setShowTelegramPrompt(true)')
      expect(teacherAttendancePage).toContain('setShowBroadcastModal(true)')
      expect(teacherAttendancePage).not.toContain('Telegram guruhga ham yuborish')
    })

    it('includes Telegram broadcast styles in index.css', () => {
      expect(css).toContain('.attendance-broadcast-btn')
    })

    it('ensures consistent data-label attributes for mobile cards in both admin and teacher attendance', () => {
      expect(attendancePage).toContain('data-label="O‘quvchi"')
      expect(teacherAttendancePage).toContain('data-label="O‘quvchi"')
    })

    it('uses clean responsive mobile layout for savebar without rigid grid collisions', () => {
      expect(css).toContain('.attendance-savebar { position:sticky;bottom:8px;display:flex;flex-wrap:wrap;')
    })

    it('ensures clean 2x2 mobile grading layout without overlapping labels or inputs', () => {
      expect(css).toContain('"vazifa dars"')
      expect(css).toContain('"lugat baho"')
      expect(css).toContain('.attendance-card-vazifa')
      expect(css).toContain('.attendance-card-dars')
      expect(css).toContain('.attendance-card-lugat')
      expect(css).toContain('.attendance-card-baho')
      expect(attendancePage).toContain('attendance-card-vazifa')
      expect(attendancePage).toContain('attendance-card-dars')
      expect(attendancePage).toContain('attendance-card-lugat')
      expect(teacherAttendancePage).toContain('attendance-card-vazifa')
      expect(teacherAttendancePage).toContain('attendance-card-dars')
      expect(teacherAttendancePage).toContain('attendance-card-lugat')
      expect(teacherAttendancePage).not.toContain('panel attendance-register attendance-table')
    })

    it('enables numeric keyboard on mobile via inputMode="numeric" in both pages', () => {
      expect(attendancePage).toContain('inputMode="numeric"')
      expect(teacherAttendancePage).toContain('inputMode="numeric"')
    })

    it('hides percent unit when placeholder is shown to prevent "— %" overlap and centers placeholder', () => {
      expect(css).toContain('.attendance-rating-control input:placeholder-shown ~ .attendance-rating-unit { display:none; }')
      expect(css).toContain('.attendance-rating-control input:placeholder-shown { text-align:center;')
    })

    it('handles disabled state for score unit and comment input in attendance cards', () => {
      expect(css).toContain('.attendance-rating-control input:disabled ~ .attendance-rating-unit { opacity:.45; }')
      expect(css).toContain('.attendance-register .attendance-card-comment > input:disabled { background:var(--surface-soft);')
    })

    it('aligns teacher attendance filters and summary badges to mobile responsive standard', () => {
      expect(css).toContain('.teacher-attendance-page .attendance-filters { display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);')
      expect(css).toContain('.teacher-attendance-page .attendance-summary span')
      expect(css).toContain('.attendance-register td:nth-child(6) { grid-area:baho;border-bottom:1px solid var(--border);text-align:left;background:color-mix(in srgb,var(--surface-soft) 45%,var(--surface)); }')
    })
  })
})
