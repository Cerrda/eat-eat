import type { MenuDish, Slot } from '@/api/types'

export const orderDraft: {
  date: string
  slot: Slot | ''
  dishes: MenuDish[]
  note: string
} = {
  date: '',
  slot: '',
  dishes: [],
  note: '',
}

export const menuIntent: {
  date: string
  slot: Slot | ''
} = {
  date: '',
  slot: '',
}
