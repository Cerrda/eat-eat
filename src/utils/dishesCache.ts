import type { Category, DishCard } from '@/api/types'
import { createScreenCache } from '@/utils/screenCache'

export interface DishesScreen {
  categories: Category[]
  dishes: DishCard[]
  total: number
}

const cache = createScreenCache<DishesScreen>('eat-dishes-home-v1', screen =>
  Array.isArray(screen.categories) && Array.isArray(screen.dishes) && typeof screen.total === 'number')

export function readDishesScreen() {
  return cache.read()
}

export function writeDishesScreen(screen: DishesScreen) {
  cache.write(screen)
}
