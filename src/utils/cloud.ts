import type { EatCloud } from '@/api/types'

export function eatCloud() {
  return uniCloud.importObject('eat', {
    customUI: true,
  }) as EatCloud
}
