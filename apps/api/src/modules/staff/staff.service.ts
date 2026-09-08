import type { StaffCreateInput, StaffMember } from '@golden-study/contracts';
import type { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../common/errors/api-error.js';

function mapRole(role: StaffMember['role']): Role {
  switch (role) {
    case 'superadmin':
      return 'SUPER_ADMIN';
    case 'admin':
      return 'ADMIN';
    case 'teacher':
      return 'TEACHER';
    default:
      return 'ADMIN';
  }
}

function unmapRole(role: Role): StaffMember['role'] {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'superadmin';
    case 'ADMIN':
    case 'MANAGER':
    case 'ACCOUNTANT':
    case 'KASSIR':
      return 'admin';
    case 'TEACHER':
      return 'teacher';
    default:
      return 'admin';
  }
}

function formatPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    const nat = digits.slice(3);
    return `+998 ${nat.slice(0, 2)} ${nat.slice(2, 5)} ${nat.slice(5, 7)} ${nat.slice(7)}`;
  }
  if (digits.length === 9) {
    return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

function computeStatus(position: string | null, isActive: boolean): StaffMember['status'] {
  const isArchived = position?.startsWith('[ARCHIVED]') ?? false;
  if (isArchived) return 'archived';
  return isActive ? 'active' : 'blocked';
}

function archivePrefix(position: string | null | undefined, status: StaffMember['status']): string | null {
  const pos = position ?? '';
  if (status === 'archived') {
    return pos.startsWith('[ARCHIVED]') ? pos : `[ARCHIVED]${pos}`;
  }
  return pos.replace('[ARCHIVED]', '') || null;
}

function resolveFullName(
  login: string,
  teacher?: { firstName: string; lastName: string } | null,
): string {
  if (teacher) return `${teacher.firstName} ${teacher.lastName}`.trim();
  if (login.toLowerCase() === 'superadmin') return 'Super Administrator';
  if (login.toLowerCase() === 'admin') return 'Administrator';
  return login;
}

export class StaffService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(): Promise<StaffMember[]> {
    const users = await this.prisma.user.findMany({
      include: { teacher: true },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      fullName: resolveFullName(u.login, u.teacher),
      login: u.login,
      phone: formatPhone(u.phone ?? u.teacher?.phone),
      role: unmapRole(u.role),
      position: u.position,
      passportPinfl: u.passportPinfl,
      hiredAt: u.hiredAt ? u.hiredAt.toISOString().slice(0, 10) : null,
      avatarUrl: u.avatarUrl,
      salaryUzs: u.salaryUzs,
      status: computeStatus(u.position, u.isActive),
      linkedTeacherId: u.teacherId,
      linkedTeacherName: u.teacher ? `${u.teacher.firstName} ${u.teacher.lastName}`.trim() : null,
      lastLoginAt: u.updatedAt.toISOString(),
      lastSalaryPaidAt: u.lastSalaryPaidAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  public async create(input: StaffCreateInput): Promise<StaffMember> {
    const existing = await this.prisma.user.findUnique({ where: { login: input.login } });
    if (existing) {
      throw new ApiError(409, 'CONFLICT', 'User login already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        login: input.login,
        passwordHash,
        role: mapRole(input.role),
        isActive: true,
        phone: input.phone ?? null,
        position: input.position ?? null,
        passportPinfl: input.passportPinfl ?? null,
        hiredAt: input.hiredAt ? new Date(input.hiredAt) : null,
        salaryUzs: input.salaryUzs ?? null,
      },
    });

    return {
      id: user.id,
      fullName: input.fullName,
      login: user.login,
      phone: formatPhone(user.phone),
      role: input.role,
      position: user.position,
      passportPinfl: user.passportPinfl,
      hiredAt: user.hiredAt ? user.hiredAt.toISOString().slice(0, 10) : null,
      avatarUrl: user.avatarUrl,
      salaryUzs: user.salaryUzs,
      status: 'active',
      linkedTeacherId: null,
      linkedTeacherName: null,
      lastLoginAt: null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  public async update(member: StaffMember): Promise<StaffMember> {
    const pos = archivePrefix(member.position, member.status);

    const passwordHash =
      member.password && member.password.trim().length >= 6
        ? await bcrypt.hash(member.password.trim(), 10)
        : undefined;

    const user = await this.prisma.user.update({
      where: { id: member.id },
      data: {
        login: member.login,
        role: mapRole(member.role),
        isActive: member.status === 'active',
        phone: member.phone ?? null,
        position: pos,
        passportPinfl: member.passportPinfl ?? null,
        hiredAt: member.hiredAt ? new Date(member.hiredAt) : null,
        salaryUzs: member.salaryUzs ?? null,
        ...(passwordHash ? { passwordHash } : {}),
      },
      include: { teacher: true },
    });

    if (user.teacherId) {
      const teacherData: { isActive?: boolean; fixedSalaryUzs?: number } = {};
      if (member.status === 'active' && !user.teacher?.isActive) {
        teacherData.isActive = true;
      }
      if (member.salaryUzs !== undefined && member.salaryUzs !== null) {
        teacherData.fixedSalaryUzs = member.salaryUzs;
      }
      if (Object.keys(teacherData).length > 0) {
        await this.prisma.teacher.update({
          where: { id: user.teacherId },
          data: teacherData,
        });
      }
    }

    return {
      ...member,
      phone: formatPhone(user.phone ?? user.teacher?.phone ?? member.phone),
      position: member.position ?? null,
      status: member.status,
      lastSalaryPaidAt: user.lastSalaryPaidAt?.toISOString() ?? member.lastSalaryPaidAt ?? null,
      linkedTeacherName: user.teacher ? `${user.teacher.firstName} ${user.teacher.lastName}`.trim() : null,
    };
  }

  public async setStatus(id: string, status: StaffMember['status']): Promise<StaffMember> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Staff member not found');

    const currentPos = archivePrefix(existing.position, status);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: status === 'active', position: currentPos },
      include: { teacher: true },
    });

    if (status === 'active' && user.teacherId && !user.teacher?.isActive) {
      await this.prisma.teacher.update({
        where: { id: user.teacherId },
        data: { isActive: true },
      });
    }

    return {
      id: user.id,
      fullName: resolveFullName(user.login, user.teacher),
      login: user.login,
      phone: formatPhone(user.phone ?? user.teacher?.phone),
      role: unmapRole(user.role),
      position: user.position?.replace('[ARCHIVED]', '') ?? null,
      passportPinfl: user.passportPinfl,
      hiredAt: user.hiredAt ? user.hiredAt.toISOString().slice(0, 10) : null,
      avatarUrl: user.avatarUrl,
      salaryUzs: user.salaryUzs,
      status,
      linkedTeacherId: user.teacherId,
      linkedTeacherName: user.teacher ? `${user.teacher.firstName} ${user.teacher.lastName}`.trim() : null,
      lastLoginAt: user.updatedAt.toISOString(),
      lastSalaryPaidAt: user.lastSalaryPaidAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  public async payout(
    id: string,
    amount: number,
    comment: string | undefined,
    createdByUserId: string,
  ): Promise<StaffMember> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { teacher: true },
    });

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'Staff member not found');
    }

    const categoryText = 'Xodimlar ish haqi';
    const finalComment = comment ? `${categoryText}: ${comment}` : categoryText;

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ledgerEntry.create({
        data: {
          accountType: 'CENTER',
          direction: 'DEBIT',
          category: 'STAFF_PAYOUT',
          amountUzs: amount,
          operationKey: `STAFF_PAYOUT:${user.id}:${Date.now()}`,
          sourceType: 'PAYOUT',
          sourceId: user.id,
          comment: `${finalComment} (${user.login})`,
          createdByUserId,
        },
      }),
      this.prisma.user.update({
        where: { id },
        data: { lastSalaryPaidAt: now },
      }),
    ]);

    return {
      id: user.id,
      fullName: resolveFullName(user.login, user.teacher),
      login: user.login,
      phone: formatPhone(user.phone ?? user.teacher?.phone),
      role: unmapRole(user.role),
      position: user.position,
      passportPinfl: user.passportPinfl,
      hiredAt: user.hiredAt ? user.hiredAt.toISOString().slice(0, 10) : null,
      avatarUrl: user.avatarUrl,
      salaryUzs: user.salaryUzs,
      status: computeStatus(user.position, user.isActive),
      linkedTeacherId: user.teacherId,
      linkedTeacherName: user.teacher ? `${user.teacher.firstName} ${user.teacher.lastName}`.trim() : null,
      lastLoginAt: user.updatedAt.toISOString(),
      lastSalaryPaidAt: now.toISOString(),
      createdAt: user.createdAt.toISOString(),
    };
  }
}
