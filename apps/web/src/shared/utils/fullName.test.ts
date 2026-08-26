import { describe, expect, it } from 'vitest'
import { joinFullName, splitFullName } from './fullName'

describe('full name helpers', () => {
  it('uses first word as name and remaining words as surname', () => {
    expect(splitFullName('Aziza Nuriddin qizi Rahimova')).toEqual({
      firstName: 'Aziza',
      lastName: 'Nuriddin qizi Rahimova',
    })
  })

  it('normalizes spaces when joining stored name parts', () => {
    expect(joinFullName(' Sardor ', ' Abdullayev ')).toBe('Sardor Abdullayev')
  })
})
