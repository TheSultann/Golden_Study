import { ApiSpeakingRepository } from './apiSpeaking.repository'
import type { SpeakingRepository } from './speaking.repository'

export const speakingRepository: SpeakingRepository = new ApiSpeakingRepository()
