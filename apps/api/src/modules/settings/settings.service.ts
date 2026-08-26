import type { CenterSettings } from '@golden-study/contracts';
import type { PrismaClient } from '@prisma/client';

export class SettingsService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getSettings(): Promise<CenterSettings> {
    const row = await this.prisma.settings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        centerName: 'Golden Study',
        billingMode: 'DAILY',
        timezone: 'Asia/Tashkent',
      },
      update: {},
    });

    return {
      id: row.id,
      centerName: row.centerName,
      logoUrl: row.logoUrl ?? null,
      timezone: 'Asia/Tashkent',
      currency: 'UZS',
      dateFormat: 'DD.MM.YYYY',
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  public async updateSettings(input: Partial<CenterSettings>): Promise<CenterSettings> {
    const row = await this.prisma.settings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        centerName: input.centerName ?? 'Golden Study',
        logoUrl: input.logoUrl ?? null,
        billingMode: 'DAILY',
        timezone: 'Asia/Tashkent',
      },
      update: {
        ...(input.centerName ? { centerName: input.centerName } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      },
    });

    return {
      id: row.id,
      centerName: row.centerName,
      logoUrl: row.logoUrl ?? null,
      timezone: 'Asia/Tashkent',
      currency: 'UZS',
      dateFormat: 'DD.MM.YYYY',
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
