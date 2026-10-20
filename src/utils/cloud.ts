import type { EatCloud } from '@/api/types'

let instance: EatCloud | null = null

export function eatCloud() {
  instance ??= uniCloud.importObject('eat', {
    customUI: true,
  }) as EatCloud
  return instance
}
