// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { defaultMeal } from './format'

const today = '2026-10-26'

function at(hour: number, minute = 0) {
  return new Date(2026, 9, 26, hour, minute)
}

describe('defaultMeal', () => {
  it('下午选今天中午', () => {
    expect(defaultMeal(today, at(14, 35))).toEqual({ date: today, slot: 'noon' })
  })

  it('上午 11 点选昨天晚上', () => {
    expect(defaultMeal(today, at(11))).toEqual({ date: '2026-10-25', slot: 'evening' })
  })

  it('到点才算这一餐已经过去', () => {
    expect(defaultMeal(today, at(11, 59))).toEqual({ date: '2026-10-25', slot: 'evening' })
    expect(defaultMeal(today, at(12))).toEqual({ date: today, slot: 'noon' })
    expect(defaultMeal(today, at(17, 59))).toEqual({ date: today, slot: 'noon' })
    expect(defaultMeal(today, at(18))).toEqual({ date: today, slot: 'evening' })
  })

  it('早上和夜里都不选早上', () => {
    expect(defaultMeal(today, at(8))).toEqual({ date: '2026-10-25', slot: 'evening' })
    expect(defaultMeal(today, at(2))).toEqual({ date: '2026-10-25', slot: 'evening' })
    expect(defaultMeal(today, at(23))).toEqual({ date: today, slot: 'evening' })
  })
})
