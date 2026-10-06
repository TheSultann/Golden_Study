import type { DashboardData } from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';

export class DashboardService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getDashboardData(): Promise<DashboardData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [
      monthlyIncomeRes,
      prevMonthlyIncomeRes,
      activeStudentsCount,
      prevActiveStudentsCount,
      activeGroupsCount,
      prevActiveGroupsCount,
      studentLedgerRows,
      prevStudentLedgerRows,
      recentPaymentRows,
      upcomingGroupRows,
      recentAttendanceRows,
    ] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: {
          direction: 'CREDIT',
          category: { in: ['STUDENT_PAYMENT', 'MANUAL_INCOME'] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { amountUzs: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          direction: 'CREDIT',
          category: { in: ['STUDENT_PAYMENT', 'MANUAL_INCOME'] },
          createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
        },
        _sum: { amountUzs: true },
      }),
      this.prisma.student.count({ where: { status: 'ACTIVE' } }),
      this.prisma.student.count({
        where: { status: 'ACTIVE', createdAt: { lt: startOfMonth } },
      }),
      this.prisma.group.count({ where: { status: 'ACTIVE' } }),
      this.prisma.group.count({
        where: { status: 'ACTIVE', createdAt: { lt: startOfMonth } },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['studentId', 'direction'],
        where: { accountType: 'STUDENT', studentId: { not: null } },
        _sum: { amountUzs: true },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['studentId', 'direction'],
        where: {
          accountType: 'STUDENT',
          studentId: { not: null },
          createdAt: { lt: startOfMonth },
        },
        _sum: { amountUzs: true },
      }),
      this.prisma.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          student: true,
          group: { include: { course: true } },
        },
      }),
      this.prisma.group.findMany({
        where: { status: 'ACTIVE' },
        take: 5,
        include: {
          course: true,
          room: true,
        },
      }),
      this.prisma.attendance.findMany({
        where: {
          date: { gte: thirtyDaysAgo },
          isReversed: false,
        },
        select: {
          date: true,
          status: true,
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    const monthlyIncomeUzs = monthlyIncomeRes._sum?.amountUzs ?? 0;
    const prevIncomeUzs = prevMonthlyIncomeRes._sum?.amountUzs ?? 0;

    let incomeChange = '+0%';
    let incomeTone: 'green' | 'blue' | 'gold' | 'violet' = 'green';
    if (prevIncomeUzs === 0) {
      incomeChange = monthlyIncomeUzs > 0 ? '+100%' : '0%';
    } else {
      const pct = Math.round(
        ((monthlyIncomeUzs - prevIncomeUzs) / prevIncomeUzs) * 100,
      );
      incomeChange = `${pct >= 0 ? '+' : ''}${pct}%`;
      if (pct < 0) incomeTone = 'gold';
    }

    let studentChange = '+0%';
    if (prevActiveStudentsCount === 0) {
      studentChange = activeStudentsCount > 0 ? '+100%' : '0%';
    } else {
      const pct = Math.round(
        ((activeStudentsCount - prevActiveStudentsCount) /
          prevActiveStudentsCount) *
          100,
      );
      studentChange = `${pct >= 0 ? '+' : ''}${pct}%`;
    }

    const studentBalances = new Map<string, number>();
    for (const row of studentLedgerRows) {
      if (!row.studentId) continue;
      const current = studentBalances.get(row.studentId) ?? 0;
      const amount = row._sum?.amountUzs ?? 0;
      const delta = row.direction === 'CREDIT' ? amount : -amount;
      studentBalances.set(row.studentId, current + delta);
    }
    let debtorsCount = 0;
    for (const balance of studentBalances.values()) {
      if (balance < 0) debtorsCount++;
    }

    const prevStudentBalances = new Map<string, number>();
    for (const row of prevStudentLedgerRows) {
      if (!row.studentId) continue;
      const current = prevStudentBalances.get(row.studentId) ?? 0;
      const amount = row._sum?.amountUzs ?? 0;
      const delta = row.direction === 'CREDIT' ? amount : -amount;
      prevStudentBalances.set(row.studentId, current + delta);
    }
    let prevDebtorsCount = 0;
    for (const balance of prevStudentBalances.values()) {
      if (balance < 0) prevDebtorsCount++;
    }

    const debtorsDiff = debtorsCount - prevDebtorsCount;
    const debtorsChange =
      debtorsDiff === 0 ? '0' : `${debtorsDiff > 0 ? '+' : ''}${debtorsDiff}`;

    const groupsDiff = activeGroupsCount - prevActiveGroupsCount;
    const groupsChange =
      groupsDiff === 0 ? '0' : `${groupsDiff > 0 ? '+' : ''}${groupsDiff}`;

    const stats: DashboardData['stats'] = [
      {
        label: 'Oylik tushum',
        value: `${monthlyIncomeUzs.toLocaleString('fr-FR').replace(/\s/g, ' ')} UZS`,
        change: incomeChange,
        tone: incomeTone,
      },
      {
        label: "Faol o'quvchilar",
        value: `${activeStudentsCount}`,
        change: studentChange,
        tone: 'blue',
      },
      {
        label: 'Qarzdorlar',
        value: `${debtorsCount}`,
        change: debtorsChange,
        tone: 'gold',
      },
      {
        label: 'Guruhlar',
        value: `${activeGroupsCount}`,
        change: groupsChange,
        tone: 'violet',
      },
    ];

    const uzMonths = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

    const formatUzDate = (dateIso: string) => {
      const parts = dateIso.split('-');
      const mIdx = parts[1] ? Number.parseInt(parts[1], 10) - 1 : 0;
      const dNum = parts[2] ? Number.parseInt(parts[2], 10) : 1;
      return `${dNum} ${uzMonths[mIdx] || (parts[1] ?? '')}`;
    };

    const dateStats = new Map<string, { total: number; came: number }>();
    for (const row of recentAttendanceRows) {
      const dateKey = row.date.toISOString().slice(0, 10);
      const current = dateStats.get(dateKey) ?? { total: 0, came: 0 };
      current.total += 1;
      if (row.status === 'CAME') current.came += 1;
      dateStats.set(dateKey, current);
    }

    const attendanceTrend: DashboardData['attendanceTrend'] = [...dateStats.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, st]) => ({
        date: dateKey,
        label: formatUzDate(dateKey),
        rate: st.total > 0 ? Math.round((st.came / st.total) * 100) : 0,
        total: st.total,
        came: st.came,
      }));

    if (attendanceTrend.length === 0) {
      const intervals = [28, 21, 14, 7, 0];
      for (const daysAgo of intervals) {
        const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        const dateKey = d.toISOString().slice(0, 10);
        attendanceTrend.push({
          date: dateKey,
          label: formatUzDate(dateKey),
          rate: 0,
          total: 0,
          came: 0,
        });
      }
    }

    const upcomingLessons: DashboardData['upcomingLessons'] = upcomingGroupRows.map((g) => {
      const minutes = g.lessonStartMinutes;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      return {
        time: timeStr,
        title: g.name,
        meta: g.course.title,
        room: g.room?.name ?? 'Xona 1',
        date: 'Bugun',
      };
    });

    const recentPayments: DashboardData['recentPayments'] = recentPaymentRows.map((p) => {
      const d = p.createdAt;
      const dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
      return {
        date: dateStr,
        student: `${p.student.lastName} ${p.student.firstName}`,
        course: p.group?.course.title ?? 'Kurs',
        amount: `+${p.amountUzs.toLocaleString('fr-FR').replace(/\s/g, ' ')} UZS`,
        status: 'Muvaffaqiyatli',
        tone: 'success',
      };
    });

    return {
      stats,
      upcomingLessons,
      recentPayments,
      attendanceTrend,
    };
  }
}
