<script setup lang="ts">
import type { AccountView, Category, MealBoard, MenuDish, OrderDetail, Slot } from '@/api/eat'
import { badges, dateLabel, getOrder, listCategories, listMenu, mealBoard, SLOT_LABEL } from '@/api/eat'
import { ensureAccount, rememberAccount } from '@/utils/account'
import { menuIntent, orderDraft } from '@/utils/draft'
import { primeFileUrls } from '@/utils/files'
import { monthDay } from '@/utils/format'
import { showHint } from '@/utils/hint'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const slots: Slot[] = ['morning', 'noon', 'evening']
const slotShort: Record<Slot, string> = { morning: '早', noon: '中', evening: '晚' }

const account = ref<AccountView | null>(null)
const board = ref<MealBoard | null>(null)
const dishes = ref<MenuDish[]>([])
const categories = ref<Category[]>([])
const keyword = ref('')
const categoryId = ref('')
const date = ref('')
const slot = ref<Slot>('morning')
const picked = ref<MenuDish[]>([])
const activeOrder = ref<OrderDetail | null>(null)
const knownCount = ref(-1)
let timer = 0
let spin = 0

const selectedBusy = computed(() => {
  if (!board.value)
    return null
  return board.value.busy.find(item => item.date === date.value && item.slot === slot.value) || null
})

const emptyMenu = computed(() => knownCount.value === 0)

onShow(() => {
  void refresh()
})

watch(keyword, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    void refresh()
  }, 250) as unknown as number
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view || id !== spin)
      return
    const [menu, cats, meal, nextBadges] = await Promise.all([
      listMenu({
        keyword: keyword.value.trim() || undefined,
        categoryId: categoryId.value || undefined,
      }),
      listCategories(),
      mealBoard(),
      badges(),
    ])
    if (id !== spin)
      return
    account.value = { ...view, badges: nextBadges }
    rememberAccount(account.value)
    dishes.value = menu.dishes
    categories.value = cats.categories
    board.value = meal
    if (!keyword.value.trim() && !categoryId.value)
      knownCount.value = menu.dishes.length
    await primeFileUrls(menu.dishes.map(dish => dish.coverFileId))
    ensureSelection()
  }
  catch (err) {
    if (id === spin)
      showError(err)
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
  void refresh()
}

function chosen(id: string) {
  return picked.value.some(dish => dish.dishId === id)
}

function inOrder(id: string) {
  return activeOrder.value?.items.some(item => item.dishId === id) || false
}

function toggle(dish: MenuDish) {
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
</script>

<template>
  <paper-page dock>
    <view v-if="emptyMenu" class="flex flex-col gap-28rpx">
      <screen-head :kicker="`${account?.partnerNickname || '厨神'}的菜`" title="菜单" note="还没有上架的菜。" />
      <view class="w-full flex flex-col items-center">
        <image class="relative z-1 h-248rpx w-264rpx" src="/static/cook-tomato.png" mode="aspectFit" />
        <view class="relative z-0 -mt-100rpx w-456rpx flex items-center justify-center border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-36rpx pt-128rpx">
          <text class="text-44rpx text-#3c2428 font-display">
            等对方上架
          </text>
        </view>
      </view>
    </view>
    <view v-else class="flex flex-col gap-28rpx">
      <screen-head
        :kicker="board && !selectedBusy ? `${account?.partnerNickname || '厨神'}的菜` : ''"
        title="菜单"
      />
      <template v-if="board">
        <view class="flex gap-12rpx">
          <view
            v-for="day in board.dates"
            :key="day.date"
            class="flex flex-1 flex-col items-center gap-8rpx"
          >
            <text class="text-36rpx text-#3c2428 font-display">
              {{ dateLabel(day.date, board.today) }}
            </text>
            <text class="text-22rpx text-#7a534c font-body">
              {{ monthDay(day.date) }}
            </text>
            <view class="flex gap-6rpx">
              <view
                v-for="meal in slots"
                :key="meal"
                class="flex flex-col items-center"
                @tap="selectSlot(day.date, meal)"
              >
                <view
                  class="h-64rpx w-64rpx flex items-center justify-center rounded-full"
                  :class="date === day.date && slot === meal ? 'bg-#792b3e' : ''"
                >
                  <text
                    class="text-28rpx font-body"
                    :class="date === day.date && slot === meal ? 'text-#fff9f4' : 'text-#3c2428'"
                  >
                    {{ slotShort[meal] }}
                  </text>
                </view>
                <text v-if="busyOf(day.date, meal)" class="text-20rpx text-#792b3e font-body">
                  已点
                </text>
              </view>
            </view>
          </view>
        </view>
        <view class="flex items-center rounded-full bg-#fff9f4 px-28rpx py-16rpx">
          <input
            v-model="keyword"
            class="flex-1 text-30rpx text-#3c2428 font-body"
            placeholder="搜菜名"
            placeholder-class="ph"
            confirm-type="search"
          >
        </view>
        <scroll-view scroll-x enhanced class="w-full whitespace-nowrap" :show-scrollbar="false">
          <view class="inline-flex gap-20rpx">
            <view class="rounded-full px-24rpx py-10rpx" :class="categoryId ? '' : 'bg-#792b3e'" @tap="pickCategory('')">
              <text class="text-28rpx font-body" :class="categoryId ? 'text-#7a534c' : 'text-#fff9f4'">
                全部
              </text>
            </view>
            <view
              v-for="category in categories"
              :key="category.categoryId"
              class="rounded-full px-24rpx py-10rpx"
              :class="categoryId === category.categoryId ? 'bg-#792b3e' : ''"
              @tap="pickCategory(category.categoryId)"
            >
              <text
                class="text-28rpx font-body"
                :class="categoryId === category.categoryId ? 'text-#fff9f4' : 'text-#7a534c'"
              >
                {{ category.name }}
              </text>
            </view>
          </view>
        </scroll-view>
        <view v-for="dish in dishes" :key="dish.dishId" class="flex items-center gap-20rpx">
          <dish-cover class="h-112rpx w-112rpx rounded-24rpx" :file-id="dish.coverFileId" :name="dish.name" />
          <view class="min-w-0 flex flex-1 flex-col gap-4rpx">
            <text class="text-40rpx text-#3c2428 font-display">
              {{ dish.name }}
            </text>
            <text class="text-26rpx text-#7a534c font-body">
              {{ dish.categoryName || '未分类' }}
            </text>
          </view>
          <text
            v-if="selectedBusy && inOrder(dish.dishId)"
            class="text-26rpx text-#7a534c font-body"
          >
            在这一餐
          </text>
          <text
            v-else-if="!selectedBusy"
            class="text-26rpx font-body"
            :class="chosen(dish.dishId) ? 'text-#7a534c' : 'text-#792b3e'"
            @tap="toggle(dish)"
          >
            {{ chosen(dish.dishId) ? '已加上' : '加上' }}
          </text>
        </view>
        <text v-if="!dishes.length" class="text-30rpx text-#7a534c font-body">
          没有这道菜。
        </text>
        <view v-if="selectedBusy" class="flex flex-col gap-12rpx pt-8rpx">
          <text class="text-28rpx text-#3c2428 font-body">
            {{ dateLabel(date, board.today) }} · {{ SLOT_LABEL[slot] }}
          </text>
          <text class="text-26rpx text-#7a534c font-body">
            进行中，不能再开一笔
          </text>
          <stamp-button variant="ghost" @tap="viewOrdered">
            查看已点的这一餐
          </stamp-button>
        </view>
        <view v-else-if="picked.length" class="flex flex-col gap-12rpx pt-8rpx">
          <view class="flex items-center justify-between">
            <text class="text-28rpx text-#3c2428 font-body">
              已选 {{ picked.length }} 道
            </text>
            <text class="text-26rpx text-#7a534c font-body">
              还可以再加 {{ 6 - picked.length }} 道
            </text>
          </view>
          <stamp-button variant="ghost" @tap="goConfirm">
            去确认
          </stamp-button>
        </view>
      </template>
      <ink-load v-else label="正在摆这一餐" />
    </view>
    <template #dock>
      <tab-dock role="eater" current="menu" :badges="account?.badges || { todo: 0, orders: 0, records: 0 }" />
    </template>
  </paper-page>
</template>

<style>
.ph {
  color: #c9a297;
}
</style>
