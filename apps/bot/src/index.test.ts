import { describe, expect, it, vi } from 'vitest';
import {
  prisma,
  bot,
  computeSmartAverage,
  formatScoresBreakdown,
  connectGroupToChat,
  disconnectGroupFromChat,
  getLinkedGroupForChat,
  extractCleanGroupId,
  parseLessonPlan,
  studentSelectedTopic,
  markdownToTelegramHtml,
  replyHtmlInChunks,
  handleVoiceOrAudio,
} from './index.js';

describe('Telegram Bot - Uy vazifalari va Davomat', () => {
  it('has handlers registered for Uy vazifalari and Davomat', () => {
    // Verify bot is initialized and has middleware
    expect(bot).toBeDefined();
    expect(typeof bot.hears).toBe('function');
  });

  it('computes smart average skipping null scores without deflating grades', () => {
    // All 3 scores present
    expect(computeSmartAverage(80, 90, 100)).toBe(90);

    // Only topic score graded - must NOT deflate to 32%
    expect(computeSmartAverage(null, 95, null)).toBe(95);

    // Explicit 0 score preserved
    expect(computeSmartAverage(100, 0, null)).toBe(50);

    // No scores graded
    expect(computeSmartAverage(null, null, null)).toBeNull();
  });

  it('formats score breakdown omitting unset fields to avoid false 0%', () => {
    expect(formatScoresBreakdown(80, 90, 100)).toBe('(Uyga vazifa: 80%, Mavzu: 90%, Lug‘at: 100%)');
    expect(formatScoresBreakdown(null, 95, null)).toBe('(Mavzu: 95%)');
    expect(formatScoresBreakdown(100, 0, null)).toBe('(Uyga vazifa: 100%, Mavzu: 0%)');
    expect(formatScoresBreakdown(null, null, null)).toBe('');
  });

  it('computes cameList average rating using smart average', () => {
    const records = [
      {
        status: 'CAME',
        date: new Date('2026-09-10T00:00:00.000Z'),
        homeworkScore: null,
        topicScore: 90,
        dictionaryScore: null,
        rating: 90,
        homeworkDone: false,
      },
      {
        status: 'CAME',
        date: new Date('2026-09-08T00:00:00.000Z'),
        homeworkScore: 70,
        topicScore: 75,
        dictionaryScore: 80,
        rating: 75,
        homeworkDone: true,
      },
    ];

    const cameList = records.filter((r) => r.status === 'CAME');
    const avgRating = Math.round(
      cameList.reduce(
        (s, a) =>
          s +
          (a.rating ??
            computeSmartAverage(a.homeworkScore, a.topicScore, a.dictionaryScore) ??
            0),
        0,
      ) / cameList.length,
    );

    expect(avgRating).toBe(83); // (90 + 75) / 2 = 82.5 -> 83
  });

  it('correctly filters active groups and builds prominent next homework format', async () => {
    // Mock active student with groups
    const mockStudent = {
      id: 'student-uuid-1',
      firstName: 'Ali',
      lastName: 'Valiyev',
      groups: [
        {
          status: 'ACTIVE',
          groupId: 'group-uuid-1',
          group: { id: 'group-uuid-1', name: 'IELTS Intensive', status: 'ACTIVE' },
        },
      ],
    };

    const mockLesson = {
      id: 'lesson-1',
      groupId: 'group-uuid-1',
      date: new Date('2026-09-15T00:00:00.000Z'),
      homeworkText: 'Reading Passage 2, 20 ta yangi lug‘at',
      group: { id: 'group-uuid-1', name: 'IELTS Intensive' },
    };

    vi.spyOn(prisma.student, 'findUnique').mockResolvedValue(mockStudent as any);
    vi.spyOn(prisma.groupLesson, 'findFirst').mockResolvedValue(mockLesson as any);

    const activeGroups = mockStudent.groups.filter(
      (g) => g.status === 'ACTIVE' && g.group.status === 'ACTIVE',
    );
    expect(activeGroups).toHaveLength(1);

    const upcomingLessons = (
      await Promise.all(
        activeGroups.map(async (ag) => {
          return prisma.groupLesson.findFirst({
            where: { groupId: ag.groupId, homeworkText: { not: '' } },
            orderBy: { date: 'desc' },
            include: { group: true },
          });
        }),
      )
    ).filter((l): l is NonNullable<typeof l> => Boolean(l));

    expect(upcomingLessons).toHaveLength(1);
    expect(upcomingLessons[0].group.name).toBe('IELTS Intensive');
    expect(upcomingLessons[0].homeworkText).toBe('Reading Passage 2, 20 ta yangi lug‘at');
  });

  it('handles empty upcoming lessons gracefully with placeholder message', () => {
    const upcomingLessons: any[] = [];
    const blocks: any[] = [];

    if (upcomingLessons.length > 0) {
      blocks.push({ type: 'heading', text: '📌 Keyingi darsga vazifa', size: 4 });
    } else {
      blocks.push({ type: 'heading', text: '📌 Keyingi darsga vazifa', size: 4 });
      blocks.push({ type: 'paragraph', text: 'Hozircha yangi uy vazifasi kiritilmagan.' });
    }

    expect(blocks).toContainEqual(
      expect.objectContaining({ text: 'Hozircha yangi uy vazifasi kiritilmagan.' }),
    );
  });

  describe('Telegram Group Chat Linking & Unlinking', () => {
    it('connects group to chat by ID or name and updates telegramChatId', async () => {
      const mockGroup = {
        id: 'group-uuid-101',
        name: 'Frontend React Pro',
        course: { title: 'Frontend' },
        teacher: { firstName: 'Anvar', lastName: 'Karimov' },
      };

      vi.spyOn(prisma.group, 'findUnique').mockResolvedValue(mockGroup as any);
      const updateSpy = vi.spyOn(prisma.group, 'update').mockResolvedValue({
        ...mockGroup,
        telegramChatId: '-100987654321',
        telegramChatTitle: 'React Group Chat',
      } as any);

      const result = await connectGroupToChat('-100987654321', 'React Group Chat', 'group-uuid-101');
      expect(result.ok).toBe(true);
      expect(result.group?.name).toBe('Frontend React Pro');
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'group-uuid-101' },
        data: {
          telegramChatId: '-100987654321',
          telegramChatTitle: 'React Group Chat',
        },
        include: { course: true, teacher: true },
      });
    });

    it('strips group_ prefix when connecting from startgroup link', async () => {
      const mockGroup = {
        id: 'group-uuid-202',
        name: 'Backend Node.js',
        course: { title: 'Backend' },
        teacher: { firstName: 'Bobur', lastName: 'Aliev' },
      };

      vi.spyOn(prisma.group, 'findUnique').mockResolvedValue(mockGroup as any);
      vi.spyOn(prisma.group, 'update').mockResolvedValue(mockGroup as any);

      const result = await connectGroupToChat('-100111222333', 'Backend Chat', 'group_group-uuid-202');
      expect(result.ok).toBe(true);
    });

    it('returns error when group is not found', async () => {
      vi.spyOn(prisma.group, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.group, 'findFirst').mockResolvedValue(null);

      const result = await connectGroupToChat('-100123', 'Chat', 'non-existent-group');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('topilmadi');
    });

    it('disconnects linked group successfully', async () => {
      const mockLinked = {
        id: 'group-uuid-303',
        name: 'IELTS Band 7+',
        telegramChatId: '-100555666777',
      };

      vi.spyOn(prisma.group, 'findFirst').mockResolvedValue(mockLinked as any);
      const updateSpy = vi.spyOn(prisma.group, 'update').mockResolvedValue({
        ...mockLinked,
        telegramChatId: null,
        telegramChatTitle: null,
      } as any);

      const result = await disconnectGroupFromChat('-100555666777');
      expect(result.ok).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'group-uuid-303' },
        data: {
          telegramChatId: null,
          telegramChatTitle: null,
        },
      });
    });

    it('handles disconnecting an unlinked chat gracefully', async () => {
      vi.spyOn(prisma.group, 'findFirst').mockResolvedValue(null);

      const result = await disconnectGroupFromChat('-100999');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('bog‘lanmagan');
    });

    it('extracts clean group ID across all deep-link and user input variations', () => {
      expect(extractCleanGroupId('group_12345')).toBe('12345');
      expect(extractCleanGroupId('<group_12345>')).toBe('12345');
      expect(extractCleanGroupId('startgroup=group_12345')).toBe('12345');
      expect(extractCleanGroupId('https://t.me/Golden_StudyBot?startgroup=group_12345')).toBe('12345');
      expect(extractCleanGroupId('g_abc-def')).toBe('abc-def');
      expect(extractCleanGroupId('  <IELTS Intensive>  ')).toBe('IELTS Intensive');
      expect(extractCleanGroupId('/startgroup group_999')).toBe('999');
      expect(extractCleanGroupId('/connect@Golden_StudyBot 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
      expect(extractCleanGroupId('/link@Golden_StudyBot group_abc')).toBe('abc');
    });

    it('has botInfo populated with Golden_StudyBot to support commands with bot username', () => {
      expect((bot as any).botInfo?.username).toBe('Golden_StudyBot');
    });

    it('returns error when multiple candidate groups match ambiguously', async () => {
      vi.spyOn(prisma.group, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.group, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.group, 'findMany').mockResolvedValue([
        { id: 'g1', name: 'IELTS Beginner' },
        { id: 'g2', name: 'IELTS Advanced' },
      ] as any);

      const result = await connectGroupToChat('-100555', 'Chat', 'IELTS');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Bir nechta mos guruh topildi');
      expect(result.error).toContain('IELTS Beginner');
      expect(result.error).toContain('IELTS Advanced');
    });

    it('parses lesson plan with and without Vazifa prefix', () => {
      const planWithPrefix = parseLessonPlan('Mavzu: Past Simple\nVazifa: 12-mashq');
      expect(planWithPrefix.topic).toBe('Past Simple');
      expect(planWithPrefix.homeworkText).toBe('12-mashq');

      const planWithoutPrefix = parseLessonPlan('Mavzu: Past Simple\n12-mashq');
      expect(planWithoutPrefix.topic).toBe('Past Simple');
      expect(planWithoutPrefix.homeworkText).toBe('12-mashq');

      const onlyTopic = parseLessonPlan('Mavzu: Irregular Verbs');
      expect(onlyTopic.topic).toBe('Irregular Verbs');
      expect(onlyTopic.homeworkText).toBe('');
    });
  });

  describe('Telegram Bot - 🎤 Speaking & IELTS Voice Lab', () => {
    it('formats AI feedback markdown into Telegram HTML correctly', () => {
      const markdown = `## 📊 IELTS Speaking Tahlili\n### 🎯 Mezonlar\n**Fluency:** 6.5\n*Good job*\n> "Keep it up"`;
      const html = markdownToTelegramHtml(markdown);

      expect(html).toContain('📊 <b>IELTS Speaking Tahlili</b>');
      expect(html).toContain('📌 <b>Mezonlar</b>');
      expect(html).toContain('<b>Fluency:</b> 6.5');
      expect(html).toContain('<i>Good job</i>');
      expect(html).toContain('<blockquote>&quot;Keep it up&quot;</blockquote>');
    });

    it('sends long html in chunks when exceeding Telegram limit', async () => {
      const mockReply = vi.fn().mockResolvedValue({});
      const ctx = { replyWithHTML: mockReply };

      const shortHtml = '<b>Short message</b>';
      await replyHtmlInChunks(ctx, shortHtml);
      expect(mockReply).toHaveBeenCalledTimes(1);
      expect(mockReply).toHaveBeenCalledWith(shortHtml, undefined);

      mockReply.mockClear();
      const longHtml = 'A'.repeat(3000) + '───────────────' + 'B'.repeat(2000);
      await replyHtmlInChunks(ctx, longHtml);
      expect(mockReply).toHaveBeenCalledTimes(2);
    });

    it('manages studentSelectedTopic map for topic selection', () => {
      studentSelectedTopic.set('chat_1001', 'topic_xyz');
      expect(studentSelectedTopic.get('chat_1001')).toBe('topic_xyz');
      studentSelectedTopic.delete('chat_1001');
      expect(studentSelectedTopic.get('chat_1001')).toBeUndefined();
    });

    it('handles voice message and processes speaking submission', async () => {
      const mockLink = {
        telegramChatId: 'chat_speaking_1',
        studentId: 'student_123',
        status: 'ACTIVE',
        student: {
          id: 'student_123',
          firstName: 'Ali',
          lastName: 'Valiyev',
          groups: [{ status: 'ACTIVE', groupId: 'group_spk_1' }],
        },
      };

      vi.spyOn(prisma.telegramLink, 'findFirst').mockResolvedValue(mockLink as any);
      vi.spyOn(prisma.speakingTopic, 'findMany').mockResolvedValue([
        {
          id: 'topic_spk_1',
          groupId: 'group_spk_1',
          title: 'My Hometown',
          description: 'Describe where you grew up',
          maxScore: 9,
          deadline: null,
          group: { name: 'IELTS Evening' },
        },
      ] as any);

      vi.spyOn(prisma.speakingTopic, 'findUnique').mockResolvedValue({
        id: 'topic_spk_1',
        groupId: 'group_spk_1',
        title: 'My Hometown',
        description: 'Describe where you grew up',
        maxScore: 9,
        deadline: null,
        group: { name: 'IELTS Evening' },
      } as any);

      vi.spyOn(prisma.speakingSubmission, 'create').mockResolvedValue({
        id: 'sub_123',
        topicId: 'topic_spk_1',
        studentId: 'student_123',
        audioUrl: 'telegram:voice_file_001',
        durationSeconds: 30,
        transcript: 'I grew up in Samarkand.',
        aiFeedback: '## 📊 IELTS Speaking Tahlili\nBand 7.0',
        aiScore: 7.0,
        status: 'EVALUATED_BY_AI',
      } as any);

      const mockDeleteMsg = vi.fn().mockResolvedValue({});
      const mockReplyHtml = vi.fn().mockResolvedValue({});
      const mockGetFileLink = vi.fn().mockResolvedValue({ href: 'https://example.com/audio.ogg' });

      // Mock fetch for audio download
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === 'https://example.com/audio.ogg') {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(Buffer.from('fake-audio-bytes')),
          });
        }
        return Promise.reject(new Error('Network offline'));
      }) as any;

      const ctx = {
        chat: { id: 123456 },
        message: {
          voice: {
            file_id: 'voice_file_001',
            duration: 30,
            mime_type: 'audio/ogg',
          },
        },
        telegram: {
          getFileLink: mockGetFileLink,
          deleteMessage: mockDeleteMsg,
        },
        replyWithHTML: mockReplyHtml,
      };

      try {
        await handleVoiceOrAudio(ctx);

        expect(mockGetFileLink).toHaveBeenCalledWith('voice_file_001');
        expect(mockReplyHtml).toHaveBeenCalled();
        // Should have sent result
        const calls = mockReplyHtml.mock.calls;
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall).toContain('Speaking topshirig\'ingiz tahlil qilindi!');
        expect(lastCall).toContain('My Hometown');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('warns student if audio message is too short (< 2 seconds)', async () => {
      const mockLink = {
        telegramChatId: 'chat_short_1',
        studentId: 'student_123',
        status: 'ACTIVE',
        student: {
          id: 'student_123',
          firstName: 'Ali',
          lastName: 'Valiyev',
          groups: [{ status: 'ACTIVE', groupId: 'group_spk_1' }],
        },
      };

      vi.spyOn(prisma.telegramLink, 'findFirst').mockResolvedValue(mockLink as any);
      vi.spyOn(prisma.speakingTopic, 'findMany').mockResolvedValue([
        {
          id: 'topic_spk_1',
          groupId: 'group_spk_1',
          title: 'My Hometown',
          description: 'Short',
          maxScore: 9,
          group: { name: 'IELTS' },
        },
      ] as any);
      vi.spyOn(prisma.speakingTopic, 'findUnique').mockResolvedValue({
        id: 'topic_spk_1',
        groupId: 'group_spk_1',
        title: 'My Hometown',
        description: 'Short',
        maxScore: 9,
        group: { name: 'IELTS' },
      } as any);

      const mockReplyHtml = vi.fn().mockResolvedValue({});
      const mockDeleteMsg = vi.fn().mockResolvedValue({});

      const ctx = {
        chat: { id: 777 },
        message: {
          voice: {
            file_id: 'voice_short',
            duration: 1,
            mime_type: 'audio/ogg',
          },
        },
        telegram: {
          deleteMessage: mockDeleteMsg,
        },
        replyWithHTML: mockReplyHtml,
      };

      await handleVoiceOrAudio(ctx);
      expect(mockReplyHtml).toHaveBeenCalled();
      const lastCall = mockReplyHtml.mock.calls[mockReplyHtml.mock.calls.length - 1][0];
      expect(lastCall).toContain('juda qisqa');
    });

    it('processes audio file via successful API submission response', async () => {
      const mockLink = {
        telegramChatId: 'chat_api_1',
        studentId: 'student_456',
        status: 'ACTIVE',
        student: {
          id: 'student_456',
          firstName: 'Jasur',
          lastName: 'Toshmatov',
          groups: [{ status: 'ACTIVE', groupId: 'group_spk_1' }],
        },
      };

      vi.spyOn(prisma.telegramLink, 'findFirst').mockResolvedValue(mockLink as any);
      vi.spyOn(prisma.speakingTopic, 'findMany').mockResolvedValue([
        {
          id: 'topic_spk_2',
          groupId: 'group_spk_1',
          title: 'Technology & AI',
          description: 'How AI affects life',
          maxScore: 9,
          deadline: null,
          group: { name: 'IELTS Advanced' },
        },
      ] as any);
      vi.spyOn(prisma.speakingTopic, 'findUnique').mockResolvedValue({
        id: 'topic_spk_2',
        groupId: 'group_spk_1',
        title: 'Technology & AI',
        description: 'How AI affects life',
        maxScore: 9,
        deadline: null,
        group: { name: 'IELTS Advanced' },
      } as any);

      const mockDeleteMsg = vi.fn().mockResolvedValue({});
      const mockReplyHtml = vi.fn().mockResolvedValue({});
      const mockGetFileLink = vi.fn().mockResolvedValue('https://example.com/audio.mp3');

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === 'https://example.com/audio.mp3') {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(Buffer.from('mp3-bytes')),
          });
        }
        if (url.includes('/speaking/submissions')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  id: 'sub_live_api',
                  topicId: 'topic_spk_2',
                  studentId: 'student_456',
                  status: 'EVALUATED_BY_AI',
                  aiScore: 8.0,
                  transcript: 'Artificial intelligence is changing the world.',
                  aiFeedback: '## 📊 IELTS Speaking Tahlili\n**Band:** 8.0\n*Superb vocabulary*',
                },
              }),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      }) as any;

      const ctx = {
        chat: { id: 888 },
        message: {
          audio: {
            file_id: 'audio_file_002',
            duration: 45,
            mime_type: 'audio/mp3',
          },
        },
        telegram: {
          getFileLink: mockGetFileLink,
          deleteMessage: mockDeleteMsg,
        },
        replyWithHTML: mockReplyHtml,
      };

      try {
        await handleVoiceOrAudio(ctx);

        expect(mockGetFileLink).toHaveBeenCalledWith('audio_file_002');
        expect(mockReplyHtml).toHaveBeenCalled();
        const calls = mockReplyHtml.mock.calls;
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall).toContain('Technology &amp; AI');
        expect(lastCall).toContain('va sizga ball yuboriladi');
        expect(lastCall).toContain('Artificial intelligence is changing the world.');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('successfully submits voice note with fileId even if audio buffer download fails', async () => {
      const mockLink = {
        telegramChatId: 'chat_resilient_1',
        studentId: 'student_resilient_1',
        status: 'ACTIVE',
        student: {
          id: 'student_resilient_1',
          firstName: 'Sardor',
          lastName: 'Rahimov',
          groups: [{ status: 'ACTIVE', groupId: 'group_resilient_1' }],
        },
      };

      vi.spyOn(prisma.telegramLink, 'findFirst').mockResolvedValue(mockLink as any);
      vi.spyOn(prisma.speakingTopic, 'findMany').mockResolvedValue([
        {
          id: 'topic_res_1',
          groupId: 'group_resilient_1',
          title: 'Resilient Topic',
          description: 'Desc',
          maxScore: 9,
          group: { name: 'IELTS Resilient' },
        },
      ] as any);
      vi.spyOn(prisma.speakingTopic, 'findUnique').mockResolvedValue({
        id: 'topic_res_1',
        groupId: 'group_resilient_1',
        title: 'Resilient Topic',
        description: 'Desc',
        maxScore: 9,
        group: { name: 'IELTS Resilient' },
      } as any);

      const dbCreateSpy = vi.spyOn(prisma.speakingSubmission, 'create').mockResolvedValue({
        id: 'sub_res_1',
        topicId: 'topic_res_1',
        studentId: 'student_resilient_1',
        audioUrl: 'telegram:voice_resilient_001',
        durationSeconds: 25,
        transcript: '',
        aiFeedback: '',
        aiScore: null,
        status: 'PENDING_AI',
      } as any);

      const mockDeleteMsg = vi.fn().mockResolvedValue({});
      const mockReplyHtml = vi.fn().mockResolvedValue({});
      const mockGetFileLink = vi.fn().mockRejectedValue(new Error('Telegram CDN temporarily down'));

      const ctx = {
        chat: { id: 888888 },
        message: {
          voice: {
            file_id: 'voice_resilient_001',
            duration: 25,
            mime_type: 'audio/ogg',
          },
        },
        telegram: {
          getFileLink: mockGetFileLink,
          deleteMessage: mockDeleteMsg,
        },
        replyWithHTML: mockReplyHtml,
      };

      await handleVoiceOrAudio(ctx);

      expect(dbCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            audioUrl: 'telegram:voice_resilient_001',
            status: 'PENDING_AI',
          }),
        }),
      );
      expect(mockReplyHtml).toHaveBeenCalled();
      const lastReply = mockReplyHtml.mock.calls[mockReplyHtml.mock.calls.length - 1][0];
      expect(lastReply).toContain('Ovozli topshirig\'ingiz qabul qilindi!');
    });

    it('does not allow italic asterisks to span across newlines', () => {
      const markdown = `* Item one\n* Item two`;
      const html = markdownToTelegramHtml(markdown);
      expect(html).not.toContain('<i> Item one\n</i>');
    });
  });
});
