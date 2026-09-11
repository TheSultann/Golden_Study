import type { AttendanceSession, Exam, TeacherDashboard, TeacherRatingRow, TeacherScheduleLesson, TeacherSalaryOverview, TeacherSalaryHistoryItem } from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@golden-study/contracts';
import { ApiError } from '../../common/errors/api-error.js';

export class TeacherPanelService {
  public constructor(private readonly prisma: PrismaClient) {}

  private async resolveTeacherId(user: AuthUser): Promise<string | null> {
    if (user.teacherId) return user.teacherId;
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { teacherId: true, login: true },
    });
    if (dbUser?.teacherId) return dbUser.teacherId;
    if (dbUser?.login) {
      const foundTeacher = await this.prisma.teacher.findFirst({
        where: {
          OR: [
            { user: { login: dbUser.login } },
            { phone: dbUser.login },
          ],
        },
      });
      if (foundTeacher) return foundTeacher.id;

      // Fallback: match by login format 'first.last'
      const parts = dbUser.login.split('.');
      if (parts.length >= 2) {
        const fName = parts[0] ?? '';
        const lName = parts[1] ?? '';
        const matched = await this.prisma.teacher.findFirst({
          where: {
            firstName: { equals: fName, mode: 'insensitive' },
            lastName: { equals: lName, mode: 'insensitive' },
          },
        });
        if (matched) return matched.id;
      }
    }
    return null;
  }

  public async getDashboard(user: AuthUser): Promise<TeacherDashboard> {
    const teacherId = await this.resolveTeacherId(user);

    const teacher = teacherId
      ? await this.prisma.teacher.findUnique({ where: { id: teacherId } })
      : null;

    const teacherName = teacher ? `${teacher.lastName} ${teacher.firstName}` : 'O‘qituvchi';

    const groups = teacherId
      ? await this.prisma.group.findMany({
          where: { teacherId, status: 'ACTIVE' },
          include: { course: true, room: true, students: { where: { status: 'ACTIVE' } } },
        })
      : [];

    let totalStudents = 0;
    for (const g of groups) {
      totalStudents += g.students.length;
    }

    const upcomingLessons: TeacherDashboard['upcomingLessons'] = groups.map((g) => {
      const minutes = g.lessonStartMinutes;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      return {
        id: g.id,
        groupId: g.id,
        groupName: g.name,
        courseName: g.course.title,
        time: timeStr,
        room: g.room?.name ?? 'Xona 1',
      };
    });

    const teacherEntries = teacherId
      ? await this.prisma.ledgerEntry.findMany({
          where: { accountType: 'TEACHER', teacherId },
          select: { direction: true, amountUzs: true },
        })
      : [];
    const creditsUzs = teacherEntries.reduce(
      (sum, entry) => sum + (entry.direction === 'CREDIT' ? entry.amountUzs : 0),
      0,
    );
    const debitsUzs = teacherEntries.reduce(
      (sum, entry) => sum + (entry.direction === 'DEBIT' ? entry.amountUzs : 0),
      0,
    );
    const kpiBalance = Math.max(0, creditsUzs - debitsUzs);

    const dbUser = teacherId
      ? await this.prisma.user.findFirst({
          where: { teacherId },
          select: { lastSalaryPaidAt: true },
        })
      : null;

    let salaryType: 'fixed' | 'per_student' | 'percent' | undefined = undefined;
    let salaryRate: number | undefined = undefined;

    if (teacher) {
      if (teacher.salaryType === 'FIXED') {
        salaryType = 'fixed';
        salaryRate = teacher.fixedSalaryUzs ?? 0;
      } else if (teacher.salaryType === 'PER_STUDENT') {
        salaryType = 'per_student';
        salaryRate = teacher.perStudentRateUzs ?? 0;
      } else if (teacher.salaryType === 'PERCENT') {
        salaryType = 'percent';
        salaryRate = (teacher.kpiRateBasisPoints ?? 0) / 100;
      }
    }

    return {
      teacherName,
      activeGroups: groups.length,
      activeStudents: totalStudents,
      todayLessons: groups.length,
      attendancePercent: 95,
      upcomingLessons,
      kpiBalance,
      salaryType,
      salaryRate,
      lastSalaryPaidAt: dbUser?.lastSalaryPaidAt ? dbUser.lastSalaryPaidAt.toISOString().slice(0, 10) : null,
    };
  }

  private weekdayMap: Record<string, TeacherScheduleLesson['weekday']> = {
    MON: 'Du', TUE: 'Se', WED: 'Chor', THU: 'Pay', FRI: 'Ju', SAT: 'Sha', SUN: 'Yak',
  };

  public async getSchedule(user: AuthUser): Promise<TeacherScheduleLesson[]> {
    const teacherId = await this.resolveTeacherId(user);
    const groups = teacherId
      ? await this.prisma.group.findMany({
          where: { teacherId, status: 'ACTIVE' },
          include: { course: true, room: true, students: { where: { status: 'ACTIVE' } } },
        })
      : [];

    const result: TeacherScheduleLesson[] = [];
    for (const g of groups) {
      const minutes = g.lessonStartMinutes;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      for (const wd of g.weekdays) {
        result.push({
          id: `${g.id}-${wd}`,
          groupId: g.id,
          groupName: g.name,
          courseName: g.course.title,
          weekday: this.weekdayMap[wd] ?? 'Du',
          time: timeStr,
          room: g.room?.name ?? 'Xona 1',
          studentsCount: g.students.length,
        });
      }
    }
    return result;
  }

  public async getRating(user: AuthUser): Promise<TeacherRatingRow[]> {
    const teacherId = await this.resolveTeacherId(user);
    const groups = teacherId
      ? await this.prisma.group.findMany({
          where: { teacherId, status: 'ACTIVE' },
          include: { course: true, students: { where: { status: 'ACTIVE' }, include: { student: true } } },
        })
      : [];

    const rows: TeacherRatingRow[] = [];
    for (const g of groups) {
      for (const gs of g.students) {
        const s = gs.student;
        const attendance = await this.prisma.attendance.findMany({
          where: { studentId: s.id, groupId: g.id, isReversed: false },
        });
        const total = attendance.length;
        const cameRecords = attendance.filter((a) => a.status === 'CAME');
        const cameCount = cameRecords.length;
        const presentCount = cameCount + attendance.filter((a) => a.status === 'EXCUSED').length;
        const attendanceRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;
        const avgRating = cameCount > 0 ? cameRecords.reduce((sum, a) => sum + (a.rating ?? 0), 0) / cameCount : 0;
        const homeworkDone = total > 0 ? (attendance.filter((a) => a.status !== 'ABSENT' && a.homeworkDone).length / total) * 100 : 0;
        const attendanceRating = Math.round(avgRating);
        const totalScore = total > 0
          ? Math.round((attendanceRate / 100) * 40 + (attendanceRating / 100) * 30 + (homeworkDone / 100) * 30)
          : 0;
        const stars = cameCount > 0 ? Math.min(5, Math.max(0, Math.round(avgRating / 20))) : 0;

        rows.push({
          studentId: s.id,
          studentCode: s.studentCode,
          studentName: `${s.lastName} ${s.firstName}`,
          groupName: g.name,
          examsCount: 0,
          averagePercent: 0,
          attendanceRate,
          attendanceRating,
          homeworkRate: Math.round(homeworkDone),
          totalScore: Math.min(100, totalScore),
          stars,
        });
      }
    }
    return rows.sort((a, b) => b.totalScore - a.totalScore);
  }

  public async getAttendanceGroups(user: AuthUser) {
    const teacherId = await this.resolveTeacherId(user);
    const groups = teacherId
      ? await this.prisma.group.findMany({
          where: { teacherId, status: 'ACTIVE' },
          include: { students: { where: { status: 'ACTIVE' } } },
        })
      : [];
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
    }));
  }

  public async getAttendance(user: AuthUser, groupId: string, date: string): Promise<AttendanceSession> {
    const teacherId = await this.resolveTeacherId(user);
    const groupWhere: Record<string, unknown> = { id: groupId, status: 'ACTIVE' };
    if (teacherId) groupWhere.teacherId = teacherId;
    const group = await this.prisma.group.findFirst({ where: groupWhere as any });
    if (!group) {
      return { groupId, groupName: 'Guruh', date, rows: [] };
    }
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const nextDay = new Date(dayStart);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const memberships = await this.prisma.groupStudent.findMany({
      where: {
        groupId,
        joinedAt: { lt: nextDay },
        OR: [{ leftAt: null }, { leftAt: { gte: dayStart } }],
      },
      select: {
        student: true,
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const students = memberships.map((m) => m.student);
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: { groupId, date: dayStart, isReversed: false },
    });
    const attendanceMap = new Map(attendanceRecords.map((a) => [a.studentId, a]));
    return {
      groupId,
      groupName: group.name,
      date,
      rows: students.map((s) => {
        const existing = attendanceMap.get(s.id);
        return {
          studentId: s.id,
          studentCode: s.studentCode,
          studentName: `${s.lastName} ${s.firstName}`,
          status: existing ? existing.status.toLowerCase() as AttendanceSession['rows'][number]['status'] : 'came',
          rating: existing?.rating ?? 0,
          homeworkDone: existing?.homeworkDone ?? false,
          comment: existing?.comment ?? '',
          lockedByAdmin: existing?.lockedByAdmin ?? false,
        };
      }),
    };
  }

  public async saveAttendance(user: AuthUser, session: AttendanceSession): Promise<AttendanceSession> {
    const teacherId = await this.resolveTeacherId(user);
    const groupWhere: Record<string, unknown> = { id: session.groupId, status: 'ACTIVE' };
    if (teacherId) groupWhere.teacherId = teacherId;
    const group = await this.prisma.group.findFirst({ where: groupWhere as any });
    if (!group) throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    const date = new Date(`${session.date}T00:00:00.000Z`);
    await this.prisma.$transaction(
      session.rows.map((row) =>
        this.prisma.attendance.upsert({
          where: { groupId_studentId_date: { groupId: session.groupId, studentId: row.studentId, date } },
          create: {
            groupId: session.groupId,
            studentId: row.studentId,
            date,
            status: row.status.toUpperCase() as import('@prisma/client').AttendanceStatus,
            rating: row.rating,
            homeworkDone: row.homeworkDone,
            comment: row.comment,
            lockedByAdmin: row.lockedByAdmin,
            createdByUserId: user.id,
          },
          update: {
            status: row.status.toUpperCase() as import('@prisma/client').AttendanceStatus,
            rating: row.rating,
            homeworkDone: row.homeworkDone,
            comment: row.comment,
            lockedByAdmin: row.lockedByAdmin,
          },
        }),
      ),
    );
    return session;
  }

  public async getExams(user: AuthUser): Promise<Exam[]> {
    const teacherId = await this.resolveTeacherId(user);
    const groupIds = teacherId
      ? (await this.prisma.group.findMany({ where: { teacherId, status: 'ACTIVE' }, select: { id: true } })).map((g) => g.id)
      : [];

    if (groupIds.length === 0) return [];

    const exams = await this.prisma.exam.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: { select: { name: true } },
        results: { include: { student: { select: { studentCode: true, firstName: true, lastName: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return exams.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      groupName: e.group.name,
      name: e.name,
      date: e.date.toISOString().split('T')[0]!,
      maxScore: e.maxScore,
      results: e.results
        .map((r) => ({
          studentId: r.studentId,
          studentCode: r.student.studentCode,
          studentName: `${r.student.lastName} ${r.student.firstName}`,
          score: r.score,
          comment: r.comment,
          rank: r.rank,
        }))
        .sort((a, b) => a.rank - b.rank),
    }));
  }

  public async getExamGroups(user: AuthUser) {
    const teacherId = await this.resolveTeacherId(user);
    const groups = teacherId
      ? await this.prisma.group.findMany({
          where: { teacherId, status: 'ACTIVE' },
          include: { students: { where: { status: 'ACTIVE' }, include: { student: true } } },
        })
      : [];
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      students: g.students.map((gs) => ({
        id: gs.student.id,
        code: gs.student.studentCode,
        name: `${gs.student.lastName} ${gs.student.firstName}`,
      })),
    }));
  }

  public async saveExam(user: AuthUser, exam: Exam): Promise<Exam> {
    const teacherId = await this.resolveTeacherId(user);
    const groupWhere: Record<string, unknown> = { id: exam.groupId, status: 'ACTIVE' };
    if (teacherId) groupWhere.teacherId = teacherId;
    const group = await this.prisma.group.findFirst({ where: groupWhere as any });
    if (!group) throw new ApiError(403, 'FORBIDDEN', 'Access denied');

    const existingExam = exam.id ? await this.prisma.exam.findUnique({ where: { id: exam.id } }) : null;

    if (!existingExam) {
      const created = await this.prisma.exam.create({
        data: {
          groupId: exam.groupId,
          name: exam.name,
          date: new Date(`${exam.date}T00:00:00.000Z`),
          maxScore: exam.maxScore,
          createdByUserId: user.id,
          results: {
            create: exam.results.map((r) => ({
              studentId: r.studentId,
              score: r.score,
              comment: r.comment,
              rank: r.rank,
            })),
          },
        },
        include: {
          group: { select: { name: true } },
          results: { include: { student: { select: { studentCode: true, firstName: true, lastName: true } } } },
        },
      });

      return {
        id: created.id,
        groupId: created.groupId,
        groupName: created.group.name,
        name: created.name,
        date: created.date.toISOString().split('T')[0]!,
        maxScore: created.maxScore,
        results: created.results
          .map((r) => ({
            studentId: r.studentId,
            studentCode: r.student.studentCode,
            studentName: `${r.student.lastName} ${r.student.firstName}`,
            score: r.score,
            comment: r.comment,
            rank: r.rank,
          }))
          .sort((a, b) => a.rank - b.rank),
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.exam.update({
        where: { id: exam.id },
        data: { name: exam.name, date: new Date(exam.date), maxScore: exam.maxScore },
      });
      await tx.examResult.deleteMany({ where: { examId: exam.id } });
      await tx.examResult.createMany({
        data: exam.results.map((r) => ({
          examId: exam.id!,
          studentId: r.studentId,
          score: r.score,
          comment: r.comment,
          rank: r.rank,
        })),
      });
    });

    const updated = await this.prisma.exam.findUnique({
      where: { id: exam.id },
      include: {
        group: { select: { name: true } },
        results: { include: { student: { select: { studentCode: true, firstName: true, lastName: true } } } },
      },
    });

    if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Exam not found');

    return {
      id: updated.id,
      groupId: updated.groupId,
      groupName: updated.group.name,
      name: updated.name,
      date: updated.date.toISOString().split('T')[0]!,
      maxScore: updated.maxScore,
      results: updated.results
        .map((r) => ({
          studentId: r.studentId,
          studentCode: r.student.studentCode,
          studentName: `${r.student.lastName} ${r.student.firstName}`,
          score: r.score,
          comment: r.comment,
          rank: r.rank,
        }))
        .sort((a, b) => a.rank - b.rank),
    };
  }

  public async deleteExam(user: AuthUser, id: string): Promise<void> {
    const teacherId = await this.resolveTeacherId(user);
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!exam) throw new ApiError(404, 'NOT_FOUND', 'Exam not found');
    if (teacherId && exam.group.teacherId !== teacherId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    await this.prisma.$transaction([
      this.prisma.examResult.deleteMany({ where: { examId: id } }),
      this.prisma.exam.delete({ where: { id } }),
    ]);
  }

  public async getSalaryOverview(user: AuthUser): Promise<TeacherSalaryOverview> {
    const teacherId = await this.resolveTeacherId(user);
    if (!teacherId) {
      return {
        teacherName: 'O‘qituvchi',
        pendingBalanceUzs: 0,
        totalPaidUzs: 0,
        salaryType: 'fixed',
        salaryRate: 0,
        lastPaidAt: null,
        history: [],
      };
    }

    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: {
          select: { lastSalaryPaidAt: true },
        },
      },
    });

    if (!teacher) {
      return {
        teacherName: 'O‘qituvchi',
        pendingBalanceUzs: 0,
        totalPaidUzs: 0,
        salaryType: 'fixed',
        salaryRate: 0,
        lastPaidAt: null,
        history: [],
      };
    }

    const teacherName = `${teacher.lastName} ${teacher.firstName}`;

    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        accountType: 'TEACHER',
        teacherId,
      },
      orderBy: { createdAt: 'desc' },
    });

    let creditsUzs = 0;
    let debitsUzs = 0;
    let latestPayoutDate: string | null = null;

    for (const entry of ledgerEntries) {
      if (entry.direction === 'CREDIT') {
        creditsUzs += entry.amountUzs;
      } else if (entry.direction === 'DEBIT') {
        debitsUzs += entry.amountUzs;
        if (!latestPayoutDate) {
          latestPayoutDate = entry.createdAt.toISOString();
        }
      }
    }

    let pendingBalanceUzs = Math.max(0, creditsUzs - debitsUzs);
    const totalPaidUzs = debitsUzs;

    let salaryType: 'fixed' | 'per_student' | 'percent' = 'fixed';
    let salaryRate = 0;

    if (teacher.salaryType === 'PERCENT') {
      salaryType = 'percent';
      salaryRate = (teacher.kpiRateBasisPoints ?? 0) / 100;
    } else if (teacher.salaryType === 'PER_STUDENT') {
      salaryType = 'per_student';
      salaryRate = teacher.perStudentRateUzs ?? 0;
    } else {
      salaryType = 'fixed';
      salaryRate = teacher.fixedSalaryUzs ?? 0;
      if (pendingBalanceUzs === 0 && ledgerEntries.length === 0 && salaryRate > 0) {
        pendingBalanceUzs = salaryRate;
      }
    }

    const lastPaidAt = latestPayoutDate ?? teacher.user?.lastSalaryPaidAt?.toISOString() ?? null;

    const history: TeacherSalaryHistoryItem[] = [];

    if (pendingBalanceUzs > 0) {
      history.push({
        id: 'pending-current',
        date: new Date().toISOString(),
        amountUzs: pendingBalanceUzs,
        type: 'accrual',
        status: 'pending',
        title: 'Kutilayotgan maosh',
        comment: 'Hisoblangan maosh (to‘lov kutilmoqda)',
      });
    }

    for (const entry of ledgerEntries) {
      const isDebit = entry.direction === 'DEBIT';
      let title = 'Maosh to‘lovi';
      if (!isDebit) {
        if (entry.category === 'KPI_FIXED_ACCRUAL') {
          title = 'Oylik fiks maosh';
        } else if (entry.category === 'KPI_PER_STUDENT_ACCRUAL') {
          title = 'O‘quvchi boshiga hisoblangan';
        } else if (entry.category === 'KPI_PERCENT_ACCRUAL') {
          title = 'Darslar bo‘yicha foiz (KPI)';
        } else if (entry.category === 'REVERSAL') {
          title = 'Qaytarish / Korreksiya';
        } else {
          title = 'Hisoblangan rag‘batlantirish';
        }
      } else {
        if (entry.category === 'TEACHER_PAYOUT') {
          title = 'To‘langan maosh';
        } else if (entry.category === 'REVERSAL') {
          title = 'Ushlab qolish / Korreksiya';
        }
      }

      history.push({
        id: entry.id,
        date: entry.createdAt.toISOString(),
        amountUzs: entry.amountUzs,
        type: isDebit ? 'payout' : 'accrual',
        status: 'paid',
        title,
        comment: entry.comment || undefined,
      });
    }

    return {
      teacherName,
      pendingBalanceUzs,
      totalPaidUzs,
      salaryType,
      salaryRate,
      lastPaidAt,
      history,
    };
  }
}
