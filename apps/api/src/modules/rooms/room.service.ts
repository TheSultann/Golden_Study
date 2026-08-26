import type {
  RoomApi,
  RoomCreateInput,
  RoomListQuery,
  RoomUpdateInput,
} from '@golden-study/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { ApiError } from '../../common/errors/api-error.js';
import { toPaginationMeta } from '../../common/http/pagination.js';

export class RoomService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async list(query: RoomListQuery) {
    const where: Prisma.RoomWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } satisfies Prisma.RoomOrderByWithRelationInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.room.count({ where }),
    ]);
    return {
      data: rows.map(toRoomApi),
      meta: toPaginationMeta(query.page, query.limit, total),
    };
  }

  public async get(id: string): Promise<RoomApi> {
    const row = await this.prisma.room.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Room not found');
    return toRoomApi(row);
  }

  public async create(input: RoomCreateInput): Promise<RoomApi> {
    await this.assertUniqueName(input.name);
    return toRoomApi(await this.prisma.room.create({ data: input }));
  }

  public async update(id: string, input: RoomUpdateInput): Promise<RoomApi> {
    await this.get(id);
    if (input.name) await this.assertUniqueName(input.name, id);
    return toRoomApi(
      await this.prisma.room.update({
        where: { id },
        data: input.name === undefined ? {} : { name: input.name },
      }),
    );
  }

  public async deactivate(id: string): Promise<void> {
    await this.get(id);
    if (
      (await this.prisma.group.count({
        where: { roomId: id, status: 'ACTIVE' },
      })) > 0
    ) {
      throw new ApiError(409, 'CONFLICT', 'Room has active groups');
    }
    await this.prisma.room.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async assertUniqueName(name: string, excludeId?: string) {
    const duplicate = await this.prisma.room.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ApiError(409, 'CONFLICT', 'Room name already exists');
    }
  }
}

function toRoomApi(row: {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): RoomApi {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
