import type { Category, DishCard, DishStatus, MenuDish, OrderDetail, OrderStatus, RecordCard, Slot } from '@/api/types'
import { addDays } from '@/utils/format'

const MIN_ROWS = 30
const SLOTS: Slot[] = ['morning', 'noon', 'evening']
const SLOT_RANK: Record<Slot, number> = { morning: 0, noon: 1, evening: 2 }
const ORDER_STATUSES: OrderStatus[] = ['pending', 'accepted', 'rejected', 'cancelled']

const DISH_NAMES = [
  '番茄炒蛋',
  '红烧肉',
  '清炒时蔬',
  '蒜蓉西兰花',
  '糖醋排骨',
  '鱼香肉丝',
  '宫保鸡丁',
  '麻婆豆腐',
  '酸辣土豆丝',
  '葱油拌面',
  '皮蛋瘦肉粥',
  '小笼包',
  '香煎饺',
  '紫菜蛋花汤',
  '可乐鸡翅',
  '干煸四季豆',
  '地三鲜',
  '回锅肉',
  '青椒肉丝',
  '西红柿牛腩',
  '冬瓜排骨汤',
  '蒜泥白肉',
  '蚂蚁上树',
  '蛋炒饭',
  '凉拌黄瓜',
  '蒸蛋羹',
  '红烧茄子',
  '香菇青菜',
  '糖醋里脊',
  '鲫鱼豆腐汤',
]

const RECORD_LINES = [
  '这口刚刚好',
  '汤有点咸，下次少放',
  '青菜很脆',
  '米饭煮得有点软',
  '想再来一碗汤',
  '辣度刚好',
  '今晚吃得很干净',
  '留了一点明天热',
]

export function isSample(id: string) {
  return id.startsWith('sample-')
}

function fill<T>(rows: T[], make: (index: number) => T) {
  if (rows.length >= MIN_ROWS)
    return rows
  const next = rows.slice()
  for (let index = 0; next.length < MIN_ROWS; index += 1)
    next.push(make(index))
  return next
}

function freshName(used: Set<string>, index: number) {
  const base = DISH_NAMES[index % DISH_NAMES.length]
  const round = Math.floor(index / DISH_NAMES.length)
  const name = round ? `${base} ${round + 1}` : base
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const named = `${name} · ${index + 1}`
  used.add(named)
  return named
}

function resolveCategory(categories: Category[], categoryId: string, index: number) {
  if (categoryId) {
    const found = categories.find(item => item.categoryId === categoryId)
    return { id: categoryId, name: found?.name || '家常' }
  }
  if (!categories.length)
    return { id: '', name: '家常' }
  const category = categories[index % categories.length]
  return { id: category.categoryId, name: category.name }
}

function oldestDate(rows: Array<{ date: string }>, today: string) {
  if (!rows.length)
    return today
  return rows.reduce((min, row) => row.date < min ? row.date : min, rows[0].date)
}

function newestDate(rows: Array<{ date: string }>, today: string) {
  if (!rows.length)
    return today
  return rows.reduce((max, row) => row.date > max ? row.date : max, rows[0].date)
}

function dishPair(index: number) {
  const first = DISH_NAMES[index % DISH_NAMES.length]
  const second = DISH_NAMES[(index + 5) % DISH_NAMES.length]
  if (index % 2 === 0)
    return [{ dishId: `sample-item-${index}`, name: first, coverFileId: '' }]
  return [
    { dishId: `sample-item-${index}-a`, name: first, coverFileId: '' },
    { dishId: `sample-item-${index}-b`, name: second, coverFileId: '' },
  ]
}

export function fillMenu(rows: MenuDish[], categories: Category[], categoryId: string, names: string[]) {
  const used = new Set(names)
  return fill(rows, (index) => {
    const category = resolveCategory(categories, categoryId, index)
    return {
      dishId: `sample-menu-${categoryId || 'all'}-${index}`,
      name: freshName(used, index),
      categoryId: category.id,
      categoryName: category.name,
      coverFileId: '',
    }
  })
}

export function fillDishes(rows: DishCard[], categories: Category[], categoryId: string, names: string[]) {
  const used = new Set(names)
  return fill(rows, (index) => {
    const category = resolveCategory(categories, categoryId, index)
    const status: DishStatus = index % 6 === 5 ? 'off' : 'on'
    return {
      dishId: `sample-dish-${categoryId || 'all'}-${index}`,
      name: freshName(used, index),
      categoryId: category.id,
      categoryName: category.name,
      coverFileId: '',
      status,
    }
  })
}

export function fillOrders(rows: OrderDetail[], today: string) {
  const base = today || '2026-10-10'
  const anchor = oldestDate(rows, base)
  const filled = fill(rows, (index) => {
    const status = ORDER_STATUSES[index % ORDER_STATUSES.length]
    return {
      orderId: `sample-order-${index}`,
      date: addDays(anchor, -(index + 1)),
      slot: SLOTS[index % SLOTS.length],
      status,
      note: status === 'pending' && index % 2 === 0 ? '少放辣' : '',
      rejectNote: status === 'rejected' ? '今天来不及' : '',
      cancelNote: status === 'cancelled' ? '这餐先不吃了' : '',
      cancelledByRole: status === 'cancelled' ? (index % 2 ? 'eater' : 'cooker') : '',
      items: dishPair(index),
      recorded: false,
    }
  })
  return filled.slice().sort((a, b) => b.date.localeCompare(a.date) || SLOT_RANK[b.slot] - SLOT_RANK[a.slot])
}

export function fillTodo(rows: OrderDetail[], today: string) {
  const base = today || '2026-10-10'
  const anchor = newestDate(rows, base)
  const filled = fill(rows, (index) => {
    const date = rows.length ? addDays(anchor, index + 1) : addDays(base, index - 2)
    const status: OrderStatus = index % 3 === 0 ? 'accepted' : 'pending'
    const past = date < base
    return {
      orderId: `sample-todo-${index}`,
      date,
      slot: SLOTS[index % SLOTS.length],
      status,
      note: status === 'pending' && index % 2 === 0 ? '晚饭想吃热的' : '',
      rejectNote: '',
      cancelNote: '',
      cancelledByRole: '',
      items: dishPair(index),
      recorded: status === 'accepted' && past && index % 2 === 0,
    }
  })
  return filled.slice().sort((a, b) => a.date.localeCompare(b.date) || SLOT_RANK[a.slot] - SLOT_RANK[b.slot])
}

export function fillRecords(rows: RecordCard[], today: string) {
  const base = today || '2026-10-10'
  const anchor = oldestDate(rows, base)
  const filled = fill(rows, (index) => {
    const first = DISH_NAMES[index % DISH_NAMES.length]
    const second = DISH_NAMES[(index + 4) % DISH_NAMES.length]
    return {
      recordId: `sample-record-${index}`,
      date: addDays(anchor, -(index + 1)),
      slot: SLOTS[index % SLOTS.length],
      text: RECORD_LINES[index % RECORD_LINES.length],
      photoFileIds: [],
      dishes: index % 3 === 0
        ? [{ dishId: `sample-record-dish-${index}`, name: first }]
        : [
            { dishId: `sample-record-dish-${index}-a`, name: first },
            { dishId: `sample-record-dish-${index}-b`, name: second },
          ],
      orderId: '',
    }
  })
  return filled.slice().sort((a, b) => b.date.localeCompare(a.date) || SLOT_RANK[b.slot] - SLOT_RANK[a.slot])
}
