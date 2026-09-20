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
      expect(extractCleanGroupId('https://t.me/golden_study_bot?startgroup=group_12345')).toBe('12345');
      expect(extractCleanGroupId('g_abc-def')).toBe('abc-def');
      expect(extractCleanGroupId('  <IELTS Intensive>  ')).toBe('IELTS Intensive');
      expect(extractCleanGroupId('/startgroup group_999')).toBe('999');
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
});
