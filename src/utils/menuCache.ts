import type { Category, MealBoard, MenuDish } from '@/api/types'
import { peekAccount } from '@/utils/account'

const CACHE_KEY = 'eat-menu-home-v1'

export interface MenuScreen {
  categories: Category[]
  board: MealBoard
  dishes: MenuDish[]
  total: number
  menuTotal: number
}

interface StoredMenuScreen extends MenuScreen {
  owner: string
}

function ownerKey() {
  const view = peekAccount()
  if (!view)
    return ''
  return `${view.nickname}\n${view.partnerNickname}\n${view.role}`
}

export function readMenuScreen(): MenuScreen | null {
  try {
    const stored = uni.getStorageSync(CACHE_KEY) as StoredMenuScreen | ''
    if (!stored || typeof stored !== 'object')
      return null
    const owner = ownerKey()
    if (!owner || stored.owner !== owner)
      return null
    if (!Array.isArray(stored.categories) || !Array.isArray(stored.dishes))
      return null
    if (!stored.board || !Array.isArray(stored.board.dates) || !Array.isArray(stored.board.busy))
      return null
    return {
      categories: stored.categories,
      board: stored.board,
      dishes: stored.dishes,
      total: Number(stored.total || 0),
      menuTotal: Number(stored.menuTotal || 0),
    }
  }
  catch {
    return null
  }
}

export function writeMenuScreen(screen: MenuScreen) {
  try {
    const stored: StoredMenuScreen = {
      ...screen,
      owner: ownerKey(),
    }
    uni.setStorageSync(CACHE_KEY, stored)
  }
  catch {
    // 写不进去只影响下次首屏
  }
}
