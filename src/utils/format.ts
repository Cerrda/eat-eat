import type { Ref } from 'vue'
import type { Slot } from '@/api/types'
import { watch } from 'vue'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function textLength(value: string) {
  return Array.from(value).length
}

export function keepOneLine(target: Ref<string>) {
  watch(target, (value) => {
    const next = value.replace(/[\r\n]/g, '')
    if (next !== value)
      target.value = next
  })
}

export function normalizeCode(raw: string) {
  return Array.from(raw.toUpperCase())
    .filter(char => CODE_ALPHABET.includes(char))
    .slice(0, 6)
    .join('')
}

export function splitPieces(value: string) {
  return value
    .split(/[\n/、,，]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

export function monthDay(ymd: string) {
  const [, month, day] = ymd.split('-')
  if (!month || !day)
    return ymd
  return `${Number(month)}月${Number(day)}日`
}

export function addDays(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function withinMenu(date: string, today: string) {
  return Boolean(today) && date >= today && date <= addDays(today, 2)
}

const MEAL_HOUR = { noon: 12, evening: 18 }

export function defaultMeal(day: string, now = new Date()) {
  const hour = now.getHours() + now.getMinutes() / 60
  if (hour < MEAL_HOUR.noon)
    return { date: addDays(day, -1), slot: 'evening' as Slot }
  if (hour < MEAL_HOUR.evening)
    return { date: day, slot: 'noon' as Slot }
  return { date: day, slot: 'evening' as Slot }
}

export function slotKey(label: string): Slot {
  if (label === '中午')
    return 'noon'
  if (label === '晚上')
    return 'evening'
  return 'morning'
}
