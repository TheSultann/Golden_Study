import { describe, expect, it } from 'vitest';

import {
  buildGroupLessonBroadcastMessage,
  buildNotificationMessage,
  escapeHtml,
} from './telegram-messages.js';

describe('telegram-messages', () => {
  describe('escapeHtml', () => {
    it('escapes special characters & < > "', () => {
      expect(escapeHtml('Tom & Jerry <test> "quotes"')).toBe(
        'Tom &amp; Jerry &lt;test&gt; &quot;quotes&quot;',
      );
    });

    it('safely handles null, undefined and numbers', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(0)).toBe('0');
    });
  });

  describe('buildNotificationMessage for lesson_broadcast', () => {
    it('formats message with complete student score breakdown', () => {
      const message = buildNotificationMessage('lesson_broadcast', {
        studentName: 'Studentov Student',
        groupName: 'Grammer Guruh English',
        date: '20.09.2026',
        topic: 'salom',
        homeworkText: 'salom',
        nextLesson: '21.09.2026, 09:00 (22-xona)',
        status: 'CAME',
        rating: 67,
        homeworkScore: 50,
        topicScore: 60,
        dictionaryScore: 90,
        comment: 'Juda yaxshi natija!',
      });

      expect(message).toContain('📚 <b>Dars xulosasi: Grammer Guruh English</b>');
      expect(message).toContain('📅 Sana: <b>20.09.2026</b>');
      expect(message).toContain('Bugungi mavzu:</b> salom');
      expect(message).toContain('Keyingi darsga vazifa:</b> salom');
      expect(message).toContain('Keyingi dars:</b> 21.09.2026, 09:00 (22-xona)');
      expect(message).toContain('👤 <b>O‘quvchi:</b> Studentov Student');
      expect(message).toContain('📊 <b>Davomat:</b> ✅ Keldi');
      expect(message).toContain('⭐️ <b>Umumiy baho:</b> <b>67%</b>');
      expect(message).toContain('Uy vazifasi: <b>50%</b>');
      expect(message).toContain('Darsdagi faollik: <b>60%</b>');
      expect(message).toContain('Lug‘at / Test: <b>90%</b>');
      expect(message).toContain('💬 <b>O‘qituvchi izohi:</b> <i>Juda yaxshi natija!</i>');
    });

    it('handles rating of 0% without hiding score or breakdown', () => {
      const message = buildNotificationMessage('lesson_broadcast', {
        studentName: 'Aliyev Vali',
        groupName: 'Math Group',
        date: '20.09.2026',
        status: 'ABSENT',
        rating: 0,
        homeworkScore: 0,
      });

      expect(message).toContain('📊 <b>Davomat:</b> ❌ Sababsiz');
      expect(message).toContain('⭐️ <b>Umumiy baho:</b> <b>0%</b>');
      expect(message).toContain('Uy vazifasi: <b>0%</b>');
    });

    it('handles unrated lesson gracefully', () => {
      const message = buildNotificationMessage('lesson_broadcast', {
        studentName: 'Studentov Student',
        groupName: 'Grammer Guruh English',
        date: '20.09.2026',
        topic: 'salom',
        homeworkText: 'salom',
      });

      expect(message).toContain('📊 <b>Davomat:</b> <i>(Hozircha baholanmagan)</i>');
      expect(message).not.toContain('Umumiy baho');
    });

    it('escapes special characters in topic, homework, comment and student name', () => {
      const message = buildNotificationMessage('lesson_broadcast', {
        studentName: 'Jasur <Coder> & Bro',
        groupName: 'Group <A&B>',
        topic: 'Tags & <Logic>',
        homeworkText: 'Read <p> & "q"',
        status: 'CAME',
        comment: 'Nice <3 & keep going!',
      });

      expect(message).toContain('Jasur &lt;Coder&gt; &amp; Bro');
      expect(message).toContain('Group &lt;A&amp;B&gt;');
      expect(message).toContain('Tags &amp; &lt;Logic&gt;');
      expect(message).toContain('Read &lt;p&gt; &amp; &quot;q&quot;');
      expect(message).toContain('Nice &lt;3 &amp; keep going!');
    });
  });

  describe('buildGroupLessonBroadcastMessage', () => {
    it('contains only public lesson details without individual student data', () => {
      const message = buildGroupLessonBroadcastMessage({
        groupName: 'Grammer Guruh English',
        date: '20.09.2026',
        topic: 'salom',
        homeworkText: 'salom',
        nextLesson: '21.09.2026, 09:00 (22-xona)',
      });

      expect(message).toContain('📚 <b>Dars xulosasi: Grammer Guruh English</b>');
      expect(message).toContain('📅 Sana: <b>20.09.2026</b>');
      expect(message).toContain('📘 <b>Bugungi mavzu:</b> salom');
      expect(message).toContain('📝 <b>Keyingi darsga vazifa:</b> salom');
      expect(message).toContain('⏰ <b>Keyingi dars:</b> 21.09.2026, 09:00 (22-xona)');
      expect(message).not.toContain('O‘quvchi');
      expect(message).not.toContain('Davomat');
      expect(message).not.toContain('Baho');
    });
  });
});
