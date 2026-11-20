import type { RecordCard } from '@/api/types'
import { createScreenCache } from '@/utils/screenCache'

export interface RecordsScreen {
  records: RecordCard[]
  total: number
}

const cache = createScreenCache<RecordsScreen>('eat-records-home-v1', screen =>
  Array.isArray(screen.records) && typeof screen.total === 'number')

export function readRecordsScreen() {
  return cache.read()
}

export function writeRecordsScreen(screen: RecordsScreen) {
  cache.write(screen)
}
