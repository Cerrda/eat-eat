import { peekAccount } from '@/utils/account'

interface StoredScreen<T> {
  owner: string
  screen: T
}

function ownerKey() {
  const view = peekAccount()
  if (!view)
    return ''
  return `${view.nickname}\n${view.partnerNickname}\n${view.role}`
}

export function createScreenCache<T>(key: string, valid: (screen: Record<string, unknown>) => boolean) {
  function read(): T | null {
    try {
      const stored = uni.getStorageSync(key) as StoredScreen<Record<string, unknown>> | ''
      if (!stored || typeof stored !== 'object')
        return null
      const owner = ownerKey()
      if (!owner || stored.owner !== owner)
        return null
      const screen = stored.screen
      if (!screen || typeof screen !== 'object' || Array.isArray(screen) || !valid(screen))
        return null
      return screen as unknown as T
    }
    catch {
      return null
    }
  }

  function write(screen: T) {
    try {
      const stored: StoredScreen<T> = { owner: ownerKey(), screen }
      uni.setStorageSync(key, stored)
    }
    catch {
      // 写不进去只影响下次首屏
    }
  }

  return { read, write }
}
