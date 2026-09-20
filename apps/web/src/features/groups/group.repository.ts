import type { Group } from '@golden-study/contracts'
export interface GroupRepository {
  list(): Promise<Group[]>;
  save(group: Group): Promise<Group>;
  setActive(id: string, active: boolean): Promise<Group>;
  unlinkTelegram(id: string): Promise<Group>;
}


