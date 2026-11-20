import type { OrderDetail } from '@/api/types'
import { createScreenCache } from '@/utils/screenCache'

export interface OrdersScreen {
  orders: OrderDetail[]
  total: number
}

const cache = createScreenCache<OrdersScreen>('eat-orders-home-v1', screen =>
  Array.isArray(screen.orders) && typeof screen.total === 'number')

export function readOrdersScreen() {
  return cache.read()
}

export function writeOrdersScreen(screen: OrdersScreen) {
  cache.write(screen)
}
