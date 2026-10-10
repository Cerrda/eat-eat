<script setup lang="ts">
import type { Role } from '@/api/eat'
import type { TabKey } from '@/utils/tabs'
import CookDishes from '@/components/cook-dishes/cook-dishes.vue'
import CookRecords from '@/components/cook-records/cook-records.vue'
import CookTodo from '@/components/cook-todo/cook-todo.vue'
import EatMenu from '@/components/eat-menu/eat-menu.vue'
import EatOrders from '@/components/eat-orders/eat-orders.vue'
import SettingsPane from '@/components/settings-pane/settings-pane.vue'
import TabDock from '@/components/tab-dock/tab-dock.vue'
import TabScroll from '@/components/tab-scroll/tab-scroll.vue'
import { useTopPadding } from '@/composables/useTopPadding'
import { ensureAccount } from '@/utils/account'
import { cookerTabs, eaterTabs, invalidateTabs, isTabFresh, noteBadges, onTabPick, tabBadges, tabKey, tabsOf } from '@/utils/tabs'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
    disableScroll: true,
  },
})

interface Pane {
  refresh: () => void
}

const topPadding = useTopPadding()
const role = ref<Role>('eater')
const ready = ref(false)
const motion = ref<'' | 'left' | 'right'>('')
const opened = reactive<Record<TabKey, boolean>>({
  menu: false,
  orders: false,
  records: false,
  settings: false,
  todo: false,
  dishes: false,
})
const menuPane = ref<Pane | null>(null)
const ordersPane = ref<Pane | null>(null)
const recordsPane = ref<Pane | null>(null)
const todoPane = ref<Pane | null>(null)
const dishesPane = ref<Pane | null>(null)
const settingsPane = ref<Pane | null>(null)

function knownTab(key: string): key is TabKey {
  return (eaterTabs as readonly string[]).includes(key) || (cookerTabs as readonly string[]).includes(key)
}

function pane(key: TabKey) {
  if (key === 'menu')
    return menuPane.value
  if (key === 'orders')
    return ordersPane.value
  if (key === 'todo')
    return todoPane.value
  if (key === 'dishes')
    return dishesPane.value
  if (key === 'settings')
    return settingsPane.value
  return recordsPane.value
}

function showTab(key: string) {
  if (!knownTab(key) || key === tabKey.value)
    return
  if (!ready.value) {
    tabKey.value = key
    return
  }
  const keys = tabsOf(role.value)
  const from = keys.indexOf(tabKey.value)
  const to = keys.indexOf(key)
  if (from < 0 || to < 0)
    return
  const first = !opened[key]
  opened[key] = true
  motion.value = ''
  tabKey.value = key
  nextTick(() => {
    motion.value = to > from ? 'right' : 'left'
    if (!first && !isTabFresh(key))
      pane(key)?.refresh()
  })
}

onTabPick(showTab)

let firstShow = true

onShow(() => {
  uni.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
  if (firstShow) {
    firstShow = false
    return
  }
  if (!ready.value)
    return
  invalidateTabs()
  nextTick(() => pane(tabKey.value)?.refresh())
})

async function boot() {
  try {
    const view = await ensureAccount({ next: 'home' })
    if (!view || (view.role !== 'eater' && view.role !== 'cooker'))
      return
    role.value = view.role
    noteBadges(view.badges)
    if (!tabsOf(view.role).includes(tabKey.value))
      tabKey.value = view.role === 'eater' ? 'menu' : 'todo'
    opened[tabKey.value] = true
    ready.value = true
  }
  catch (err) {
    showError(err)
  }
}

onLoad(() => {
  void boot()
})
</script>

<template>
  <view class="relative h-screen w-full overflow-hidden bg-#fbf3ea">
    <image class="pointer-events-none fixed left-0 top-0 z-0 h-screen w-full" src="/static/paper.jpg" mode="aspectFill" />
    <template v-if="ready">
      <tab-scroll v-if="role === 'eater' && opened.menu" :active="tabKey === 'menu'" :motion="motion">
        <eat-menu ref="menuPane" :active="tabKey === 'menu'" />
      </tab-scroll>
      <tab-scroll v-if="role === 'eater' && opened.orders" :active="tabKey === 'orders'" :motion="motion">
        <eat-orders ref="ordersPane" />
      </tab-scroll>
      <tab-scroll v-if="role === 'cooker' && opened.todo" :active="tabKey === 'todo'" :motion="motion">
        <cook-todo ref="todoPane" />
      </tab-scroll>
      <tab-scroll v-if="role === 'cooker' && opened.dishes" :active="tabKey === 'dishes'" :motion="motion">
        <cook-dishes ref="dishesPane" />
      </tab-scroll>
      <tab-scroll v-if="opened.records" :active="tabKey === 'records'" :motion="motion">
        <cook-records ref="recordsPane" />
      </tab-scroll>
      <tab-scroll v-if="opened.settings" :active="tabKey === 'settings'" :motion="motion">
        <settings-pane ref="settingsPane" />
      </tab-scroll>
      <tab-dock :role="role" :current="tabKey" :badges="tabBadges" @pick="showTab" />
    </template>
    <view v-else class="relative z-1 px-44rpx" :style="{ paddingTop: topPadding }">
      <ink-load label="正在打开厨房" />
    </view>
    <ink-toast />
    <ink-dialog />
  </view>
</template>
