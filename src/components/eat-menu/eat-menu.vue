<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import type { Category, MealBoard, MenuDish, OrderDetail, Slot } from '@/api/eat'
import { badges, dateLabel, getOrder, listCategories, listMenu, mealBoard, SLOT_LABEL } from '@/api/eat'
import { usePaged } from '@/composables/usePaged'
import { ensureAccount, rememberAccount } from '@/utils/account'
import { menuIntent, orderDraft } from '@/utils/draft'
import { primeFileUrls } from '@/utils/files'
import { keepOneLine, monthDay } from '@/utils/format'
import { showHint } from '@/utils/hint'
import { fillMenu, isSample } from '@/utils/sample-feed'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const props = defineProps<{
  active?: boolean
}>()

const alive = computed(() => props.active !== false)

const slots: Slot[] = ['morning', 'noon', 'evening']
const slotShort: Record<Slot, string> = { morning: '早', noon: '中', evening: '晚' }

const board = ref<MealBoard | null>(null)
const pool = ref<MenuDish[]>([])
const categories = ref<Category[]>([])
const keyword = ref('')
keepOneLine(keyword)
const categoryId = ref('')
const date = ref('')
const slot = ref<Slot>('morning')
const picked = ref<MenuDish[]>([])
const activeOrder = ref<OrderDetail | null>(null)
const pulling = ref(false)
let spin = 0

const viewRows = computed(() => {
  const word = keyword.value.trim()
  let rows = pool.value
  if (categoryId.value)
    rows = rows.filter(dish => dish.categoryId === categoryId.value)
  if (word)
    return rows.filter(dish => dish.name.includes(word))
  return fillMenu(rows, categories.value, categoryId.value, pool.value.map(dish => dish.name))
})
const { shown, total, finished, loading, reset, more } = usePaged(viewRows)

const selectedBusy = computed(() => {
  if (!board.value)
    return null
  return board.value.busy.find(item => item.date === date.value && item.slot === slot.value) || null
})

onMounted(() => {
  void refresh()
})

watch([keyword, categoryId], () => {
  reset()
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view || id !== spin)
      return
    const [menu, cats, meal, nextBadges] = await Promise.all([
      listMenu(),
      listCategories(),
      mealBoard(),
      badges(),
    ])
    if (id !== spin)
      return
    rememberAccount({ ...view, badges: nextBadges })
    noteBadges(nextBadges)
    pool.value = menu.dishes
    categories.value = cats.categories
    board.value = meal
    reset()
    await primeFileUrls(menu.dishes.map(dish => dish.coverFileId))
    if (id !== spin)
      return
    ensureSelection()
    markTabFresh('menu')
  }
  catch (err) {
    if (id === spin)
      showError(err)
  }
}

async function onPull() {
  if (pulling.value)
    return
  pulling.value = true
  try {
    await refresh()
  }
  finally {
    pulling.value = false
  }
}

function busyOf(day: string, meal: Slot) {
  return board.value?.busy.find(item => item.date === day && item.slot === meal) || null
}

function ensureSelection() {
  if (!board.value)
    return
  if (menuIntent.date && menuIntent.slot) {
    const nextDate = menuIntent.date
    const nextSlot = menuIntent.slot
    menuIntent.date = ''
    menuIntent.slot = ''
    void selectSlot(nextDate, nextSlot)
    return
  }
  if (date.value) {
    void selectSlot(date.value, slot.value)
    return
  }
  for (const day of board.value.dates) {
    for (const meal of slots) {
      if (!busyOf(day.date, meal)) {
        date.value = day.date
        slot.value = meal
        return
      }
    }
  }
  const first = board.value.dates[0]
  if (first)
    void selectSlot(first.date, 'morning')
}

async function selectSlot(day: string, meal: Slot) {
  date.value = day
  slot.value = meal
  const busy = busyOf(day, meal)
  if (!busy) {
    activeOrder.value = null
    return
  }
  picked.value = []
  try {
    activeOrder.value = await getOrder(busy.orderId)
  }
  catch (err) {
    showError(err)
  }
}

function pickCategory(id: string) {
  categoryId.value = id
}

function chosen(id: string) {
  return picked.value.some(dish => dish.dishId === id)
}

function inOrder(id: string) {
  return activeOrder.value?.items.some(item => item.dishId === id) || false
}

function toggle(dish: MenuDish) {
  if (isSample(dish.dishId)) {
    showHint('这是凑出来的示例')
    return
  }
  if (selectedBusy.value)
    return
  const index = picked.value.findIndex(item => item.dishId === dish.dishId)
  if (index >= 0) {
    picked.value.splice(index, 1)
    return
  }
  if (picked.value.length >= 6) {
    showHint('这一餐最多 6 道菜')
    return
  }
  picked.value.push(dish)
}

function goConfirm() {
  if (!picked.value.length || !slot.value) {
    showHint('先加上一道菜')
    return
  }
  orderDraft.date = date.value
  orderDraft.slot = slot.value
  orderDraft.dishes = [...picked.value]
  orderDraft.note = ''
  uni.navigateTo({ url: '/pages/eat/confirm' })
}

function viewOrdered() {
  if (!activeOrder.value)
    return
  uni.navigateTo({ url: `/pages/eat/order?id=${activeOrder.value.orderId}` })
}

const showTray = computed(() => {
  if (!board.value)
    return false
  return Boolean(selectedBusy.value) || picked.value.length > 0
})

const remain = computed(() => Math.max(0, 6 - picked.value.length))

function mealOn(day: string, meal: Slot) {
  return date.value === day && slot.value === meal
}

function mealTone(day: string, meal: Slot) {
  if (mealOn(day, meal))
    return 'text-#fbf3ea'
  if (busyOf(day, meal))
    return 'text-#9c342c'
  return 'text-#7a534c'
}

function onTrayTap() {
  if (selectedBusy.value)
    viewOrdered()
  else
    goConfirm()
}

defineExpose({ refresh })
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <view class="shrink-0">
      <screen-head title="菜单" />
    </view>
    <ink-load v-if="!board" label="正在摆这一餐" />
    <list-scroll
      v-else
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      @refresh="onPull"
      @more="more"
    >
      <view class="flex flex-col gap-28rpx pt-28rpx" :class="showTray ? 'pb-140rpx' : ''">
        <view class="box-border min-w-0 w-full flex items-stretch gap-12rpx border-4rpx border-#c9a297 rounded-36rpx border-solid bg-#fff9f4 p-16rpx">
          <view
            v-for="day in board.dates"
            :key="day.date"
            class="min-w-0 flex flex-1 flex-col items-center gap-16rpx overflow-hidden rounded-28rpx px-8rpx py-20rpx"
            :class="date === day.date ? 'bg-#f6e4de' : ''"
          >
            <text class="text-44rpx text-#3c2428 leading-none font-display">
              {{ dateLabel(day.date, board.today) }}
            </text>
            <text class="text-24rpx text-#7a534c leading-none font-body">
              {{ monthDay(day.date) }}
            </text>
            <view class="w-full flex items-center justify-center gap-8rpx">
              <view
                v-for="meal in slots"
                :key="meal"
                class="h-80rpx min-w-0 flex flex-1 flex-col items-center justify-center gap-2rpx overflow-hidden rounded-24rpx"
                :class="mealOn(day.date, meal) ? 'bg-#792b3e' : ''"
                @tap="selectSlot(day.date, meal)"
              >
                <text class="text-32rpx leading-none font-display" :class="mealTone(day.date, meal)">
                  {{ slotShort[meal] }}
                </text>
                <text v-if="busyOf(day.date, meal)" class="whitespace-nowrap text-22rpx leading-none font-body" :class="mealTone(day.date, meal)">
                  已点
                </text>
              </view>
            </view>
          </view>
        </view>
        <view class="flex flex-col gap-20rpx">
          <view class="h-84rpx flex items-center gap-16rpx border-2rpx border-#c9a297 rounded-full border-solid bg-#fff9f4 px-28rpx">
            <image class="h-32rpx w-32rpx shrink-0" src="/static/icons/search.png" mode="aspectFit" />
            <textarea
              v-model="keyword"
              disable-default-padding
              class="h-84rpx min-w-0 flex-1 text-30rpx text-#3c2428 leading-84rpx font-body"
              placeholder="搜菜名"
              placeholder-class="ph-sans"
              placeholder-style="line-height: 84rpx; font-size: 30rpx;"
              confirm-type="search"
              :show-confirm-bar="false"
            />
          </view>
          <scroll-view scroll-x enhanced class="w-full whitespace-nowrap" :show-scrollbar="false">
            <view class="inline-flex gap-16rpx">
              <view
                class="inline-flex items-center justify-center border-2rpx rounded-32rpx border-solid px-24rpx py-14rpx"
                :class="categoryId ? 'border-#c9a297 bg-#fff9f4' : 'border-#792b3e bg-#792b3e'"
                @tap="pickCategory('')"
              >
                <text class="text-28rpx leading-none font-body" :class="categoryId ? 'text-#3c2428' : 'text-#fff9f4'">
                  全部
                </text>
              </view>
              <view
                v-for="category in categories"
                :key="category.categoryId"
                class="inline-flex items-center justify-center border-2rpx rounded-32rpx border-solid px-24rpx py-14rpx"
                :class="categoryId === category.categoryId ? 'border-#792b3e bg-#792b3e' : 'border-#c9a297 bg-#fff9f4'"
                @tap="pickCategory(category.categoryId)"
              >
                <text class="text-28rpx leading-none font-body" :class="categoryId === category.categoryId ? 'text-#fff9f4' : 'text-#3c2428'">
                  {{ category.name }}
                </text>
              </view>
            </view>
          </scroll-view>
        </view>
        <view
          v-for="dish in shown"
          :key="dish.dishId"
          class="flex items-center gap-24rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx"
        >
          <view
            class="h-144rpx w-144rpx shrink-0 rounded-36rpx"
            :style="{ boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.28)' }"
          >
            <dish-cover
              class="box-border h-full w-full border-6rpx border-#fff9f4 rounded-36rpx border-solid"
              :file-id="dish.coverFileId"
              :name="dish.name"
            />
          </view>
          <view class="min-w-0 flex flex-1 flex-col gap-6rpx">
            <text class="text-40rpx text-#3c2428 leading-[1.15] font-display">
              {{ dish.name }}
            </text>
            <text class="text-26rpx text-#7a534c font-body">
              {{ dish.categoryName || '未分类' }}
            </text>
          </view>
          <text
            v-if="selectedBusy && inOrder(dish.dishId)"
            class="shrink-0 text-28rpx text-#792b3e font-semibold font-body"
          >
            在这一餐
          </text>
          <text
            v-else-if="!selectedBusy"
            class="shrink-0 text-28rpx font-body"
            :class="chosen(dish.dishId) ? 'text-#792b3e font-semibold' : 'text-#3c2428'"
            @tap="toggle(dish)"
          >
            {{ chosen(dish.dishId) ? '已加上' : '加上' }}
          </text>
        </view>
        <text v-if="!shown.length" class="text-30rpx text-#7a534c font-body">
          没有这道菜。
        </text>
      </view>
    </list-scroll>
    <root-portal v-if="alive && showTray && board">
      <view
        class="fixed bottom-[calc(184rpx+env(safe-area-inset-bottom))] left-0 right-0 z-10 box-border flex items-center justify-between gap-24rpx border-0 border-t-4rpx border-#c9a297 border-solid bg-#fbf3ea px-44rpx py-24rpx"
      >
        <view class="min-w-0 flex flex-col gap-4rpx">
          <text class="text-28rpx text-#3c2428 font-medium font-body">
            {{ selectedBusy ? `${dateLabel(date, board.today)} · ${SLOT_LABEL[slot]}` : `已选 ${picked.length} 道` }}
          </text>
          <text class="text-28rpx text-#7a534c font-body">
            {{ selectedBusy ? '进行中，不能再开一笔' : `还可以再加 ${remain} 道` }}
          </text>
        </view>
        <view
          class="inline-flex shrink-0 items-center justify-center rounded-full bg-#792b3e px-32rpx py-24rpx"
          :style="{ boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.35)' }"
          hover-class="opacity-80"
          :hover-stay-time="80"
          @tap="onTrayTap"
        >
          <text class="whitespace-nowrap text-28rpx text-#fbf3ea font-medium leading-none font-body">
            {{ selectedBusy ? '查看已点的这一餐' : '去确认' }}
          </text>
        </view>
      </view>
    </root-portal>
  </view>
</template>
