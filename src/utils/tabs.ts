import type { Badges, Role } from '@/api/eat'

export const eaterTabs = ['menu', 'orders', 'records', 'settings'] as const
export const cookerTabs = ['todo', 'dishes', 'records', 'settings'] as const
export type TabKey = typeof eaterTabs[number] | typeof cookerTabs[number]

export const homePath = '/pages/home/index'
export const tabKey = ref<TabKey>('menu')
export const tabBadges = ref<Badges>({ todo: 0, orders: 0, records: 0 })

const fresh = new Set<TabKey>()
let pickHandler: ((key: TabKey) => void) | null = null

export function tabsOf(role: Role): readonly TabKey[] {
  return role === 'cooker' ? cookerTabs : eaterTabs
}

export function noteBadges(badges: Badges) {
  tabBadges.value = badges
}

export function markTabFresh(key: TabKey) {
  fresh.add(key)
}

export function isTabFresh(key: TabKey) {
  return fresh.has(key)
}

export function invalidateTabs() {
  fresh.clear()
}

export function resetHomeTab(role: Role) {
  tabKey.value = role === 'eater' ? 'menu' : 'todo'
  fresh.clear()
}

export function onTabPick(handler: (key: TabKey) => void) {
  pickHandler = handler
  onUnmounted(() => {
    if (pickHandler === handler)
      pickHandler = null
  })
}

export function openTab(key: TabKey) {
  if (pickHandler)
    pickHandler(key)
  else
    tabKey.value = key
}

export function returnHome() {
  const pages = getCurrentPages()
  const index = pages.findIndex(page => page.route === 'pages/home/index')
  if (index >= 0 && index < pages.length - 1) {
    uni.navigateBack({ delta: pages.length - 1 - index })
    return
  }
  uni.reLaunch({ url: homePath })
}
