import type { OrderDetail } from '@/api/types'
import { peekAccount } from '@/utils/account'

const CACHE_KEY = 'eat-todo-home-v1'

export interface TodoScreen {
  orders: OrderDetail[]
  total: number
}

interface StoredTodoScreen extends TodoScreen {
  owner: string
}

function ownerKey() {
  const view = peekAccount()
  if (!view)
    return ''
  return `${view.nickname}\n${view.partnerNickname}\n${view.role}`
}

export function readTodoScreen(): TodoScreen | null {
  try {
    const stored = uni.getStorageSync(CACHE_KEY) as StoredTodoScreen | ''
    if (!stored || typeof stored !== 'object')
      return null
    const owner = ownerKey()
    if (!owner || stored.owner !== owner)
      return null
    if (!Array.isArray(stored.orders))
      return null
    return {
      orders: stored.orders,
      total: Number(stored.total || 0),
    }
  }
  catch {
    return null
  }
}

export function writeTodoScreen(screen: TodoScreen) {
  try {
    const stored: StoredTodoScreen = {
      ...screen,
      owner: ownerKey(),
    }
    uni.setStorageSync(CACHE_KEY, stored)
  }
  catch {
    // 写不进去只影响下次首屏
  }
}
