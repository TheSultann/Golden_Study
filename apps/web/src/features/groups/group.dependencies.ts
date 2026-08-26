import { ApiGroupRepository } from './apiGroup.repository'
import type { GroupRepository } from './group.repository'

export const groupRepository: GroupRepository = new ApiGroupRepository()
