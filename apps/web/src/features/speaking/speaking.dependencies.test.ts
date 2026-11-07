import { describe, expect, it } from 'vitest'

import { ApiSpeakingRepository } from './apiSpeaking.repository'
import { speakingRepository } from './speaking.dependencies'

describe('speaking.dependencies', () => {
  it('binds ApiSpeakingRepository as production implementation', () => {
    expect(speakingRepository).toBeInstanceOf(ApiSpeakingRepository)
  })
})
