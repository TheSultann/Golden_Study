import type { DashboardData } from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';

export class DashboardService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getDashboardData(): Promise<DashboardData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyPayments, activeStudentsCount, activeGroupsCount, studentLedgerRows, recentPaymentRows, upcomingGroupRows] =
      await Promise.all([
        this.prisma.payment.aggregate({
          where: { createdAt: { gte: startOfMonth } },
          _sum: { amountUzs: true },
        }),
        this.prisma.student.count({ where: { status: 'ACTIVE' } }),
        this.prisma.group.count({ where: { status: 'ACTIVE' } }),
        this.prisma.ledgerEntry.groupBy({
          by: ['studentId', 'direction'],
          where: { accountType: 'STUDENT', studentId: { not: null } },
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
      ]);

    const monthlyIncomeUzs = monthlyPayments._sum?.amountUzs ?? 0;

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

    const stats: DashboardData['stats'] = [
      {
        label: "Oylik tushum",
        value: `${monthlyIncomeUzs.toLocaleString('fr-FR').replace(/\s/g, ' ')} UZS`,
        change: "+0%",
        tone: "green",
      },
      {
        label: "Faol o'quvchilar",
        value: `${activeStudentsCount}`,
        change: "+0%",
        tone: "blue",
      },
      {
        label: "Qarzdorlar",
        value: `${debtorsCount}`,
        change: "0",
        tone: "gold",
      },
      {
        label: "Guruhlar",
        value: `${activeGroupsCount}`,
        change: "0",
        tone: "violet",
      },
    ];

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
    };
  }
}
