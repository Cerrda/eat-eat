<script setup lang="ts">
import type { AccountView, OrderDetail } from '@/api/eat'
import { acceptOrder, dateLabel, listTodo, SLOT_LABEL, STATUS_LABEL } from '@/api/eat'
import { LIST_PAGE_SIZE, usePaged } from '@/composables/usePaged'
import { cachedHome, ensureAccount, peekAccount, releaseTodo } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { showHint } from '@/utils/hint'
import { askCookRemind, loadCookRemindAlways, renewCookRemindIfAlways } from '@/utils/subscribe'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { art } from '@/utils/theme'
import { readTodoScreen, writeTodoScreen } from '@/utils/todoCache'
import { showError, tell } from '@/utils/ui'

const account = ref<AccountView | null>(null)
const { shown, total, finished, loading, seed, reset, more } = usePaged(async (page) => {
  const data = await listTodo({ page })
  await primeFileUrls(data.orders.flatMap(order => order.items.map(item => item.coverFileId)))
  return { rows: data.orders, total: data.total }
})
const pulling = ref(false)
const acting = ref('')
const ready = ref(false)
const reminding = ref(false)
const remindAlways = ref(false)
let spin = 0

const groups = computed(() => {
  const map = new Map<string, OrderDetail[]>()
  for (const order of shown.value) {
    const list = map.get(order.date) || []
    list.push(order)
    map.set(order.date, list)
  }
  return [...map.entries()].map(([date, list]) => ({ date, list }))
})

onMounted(() => {
  hydrateTodo()
  void refresh()
})

function hydrateTodo() {
  const saved = readTodoScreen()
  if (!saved)
    return
  const view = peekAccount()
  if (view?.role === 'cooker') {
    account.value = view
    noteBadges(view.badges)
  }
  void primeFileUrls(saved.orders.flatMap(order => order.items.map(item => item.coverFileId)))
  seed(saved.orders, saved.total)
  ready.value = true
}

function loadTodoList() {
  return Promise.all([
    loadCookRemindAlways(),
    reset(),
  ])
}

async function refresh() {
  const id = ++spin
  try {
    // 有上次的账号时，列表和账号校验一起发，少等一个来回。
    const eager = cachedHome('cooker') ? loadTodoList() : null
    eager?.catch(() => {})
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view || id !== spin)
      return
    const [always] = await (eager ? eager.catch(loadTodoList) : loadTodoList())
    if (id !== spin)
      return
    account.value = view
    noteBadges(view.badges)
    markTabFresh('todo')
    remindAlways.value = always
    ready.value = true
    writeTodoScreen({
      orders: shown.value.slice(0, LIST_PAGE_SIZE),
      total: total.value,
    })
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

function statusText(order: OrderDetail) {
  return STATUS_LABEL[order.status]
}

function dayTitle(date: string) {
  if (!account.value)
    return date
  return dateLabel(date, account.value.today)
}

async function accept(order: OrderDetail) {
  void renewCookRemindIfAlways().then((still) => {
    if (still === false)
      remindAlways.value = false
  })
  if (acting.value)
    return
  acting.value = order.orderId
  try {
    await acceptOrder(order.orderId)
    if (order.status === 'pending')
      releaseTodo()
    await refresh()
  }
  catch (err) {
    showError(err)
  }
  finally {
    acting.value = ''
  }
}

function openOrder(order: OrderDetail) {
  uni.navigateTo({ url: `/pages/cook/order?id=${order.orderId}` })
}

function reject(order: OrderDetail) {
  uni.navigateTo({ url: `/pages/cook/reject?id=${order.orderId}` })
}

async function onMore() {
  try {
    await more()
  }
  catch (err) {
    showError(err)
  }
}

function remind() {
  if (reminding.value)
    return
  const pending = askCookRemind()
  reminding.value = true
  void pending.then(async (choice) => {
    reminding.value = false
    if (choice === 'accept') {
      remindAlways.value = await loadCookRemindAlways()
      showHint(remindAlways.value ? '之后有新餐会发到微信' : '下一餐会发到微信')
    }
    else if (choice === 'reject') {
      void tell('没有打开提醒', '点允许之后，对方点餐才会发到微信。若不再弹出，到小程序右上角的设置里打开「待办事项提醒」。')
    }
    else if (choice === 'ban') {
      void tell('暂时发不了提醒', '这条提醒被微信停用了。')
    }
    else {
      showHint('这次没有打开提醒')
    }
  })
}

defineExpose({ refresh })
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <list-scroll
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      @refresh="onPull"
      @more="onMore"
    >
      <screen-head title="待做" :note="ready && !total ? '还没有待做的一餐' : ''" />
      <view
        v-if="ready && !remindAlways"
        class="eat-press mt-28rpx box-border h-78rpx flex items-center justify-between border-3rpx border-line rounded-36rpx border-solid px-32rpx"
        hover-class="eat-press-on"
        :hover-stay-time="140"
        @tap="remind"
      >
        <text class="text-28rpx text-ink font-medium leading-none" :class="faceOf('有新餐时提醒我', 'sans')">
          有新餐时提醒我
        </text>
        <text class="text-28rpx text-accent leading-none" :class="faceOf(reminding ? '正在打开' : '允许', 'mono')">
          {{ reminding ? '正在打开' : '允许' }}
        </text>
      </view>
      <template v-if="ready">
        <view v-if="!groups.length" class="w-full flex flex-col items-center pb-16rpx pt-32rpx">
          <view class="relative h-428rpx w-616rpx">
            <image class="absolute left-98rpx top-0 z-1 h-320rpx w-420rpx" :src="art('cook-pot')" mode="aspectFit" />
            <view class="absolute left-0 top-156rpx z-0 box-border h-264rpx w-616rpx flex items-end justify-center border-2rpx border-line rounded-40rpx border-solid bg-cream px-36rpx pb-48rpx">
              <text class="text-44rpx text-ink leading-[1.15]" :class="faceOf('等对方点一餐', 'serif')">
                等对方点一餐
              </text>
            </view>
          </view>
        </view>
        <view v-else class="flex flex-col gap-28rpx pt-28rpx">
          <view
            v-for="group in groups"
            :key="group.date"
            class="box-border flex flex-col gap-24rpx border-2rpx border-line rounded-36rpx border-solid p-28rpx"
          >
            <text class="text-60rpx text-ink leading-[1.15]" :class="faceOf(dayTitle(group.date), 'serif')">
              {{ dayTitle(group.date) }}
            </text>
            <template v-for="(order, orderIndex) in group.list" :key="order.orderId">
              <view v-if="orderIndex" class="h-2rpx w-full bg-line" />
              <view class="flex flex-col gap-20rpx" @tap="openOrder(order)">
                <view class="flex items-center justify-between">
                  <text class="text-32rpx text-ink" :class="faceOf(SLOT_LABEL[order.slot], 'sans')">
                    {{ SLOT_LABEL[order.slot] }}
                  </text>
                  <text
                    class="text-30rpx"
                    :class="[order.status === 'pending' ? 'text-accent' : 'text-muted', faceOf(statusText(order), 'mono')]"
                  >
                    {{ statusText(order) }}
                  </text>
                </view>
                <view class="flex flex-col gap-20rpx">
                  <view
                    v-for="item in order.items"
                    :key="item.dishId"
                    class="relative box-border overflow-hidden border-4rpx border-photo rounded-36rpx border-solid"
                    :class="order.status === 'pending' ? 'h-296rpx' : 'h-352rpx'"
                  >
                    <dish-cover class="absolute left-0 top-0 h-full w-full" :file-id="item.coverFileId" :name="item.name" size="cover" />
                    <view class="absolute bottom-0 left-0 right-0 flex">
                      <view
                        class="box-border max-w-full flex flex-col gap-6rpx rounded-br-36rpx rounded-tr-36rpx bg-cream"
                        :class="order.status === 'pending' ? 'px-32rpx py-24rpx' : 'pb-24rpx pl-36rpx pr-32rpx pt-24rpx'"
                      >
                        <text
                          class="text-ink leading-[1.1]"
                          :class="[order.status === 'pending' ? 'text-52rpx' : 'text-56rpx', faceOf(item.name, 'serif')]"
                        >
                          {{ item.name }}
                        </text>
                        <view
                          class="h-8rpx overflow-hidden rounded-[50%] bg-accent"
                          :class="order.status === 'pending' ? 'w-96rpx' : 'w-104rpx'"
                        />
                      </view>
                    </view>
                  </view>
                </view>
                <text v-if="order.note" class="text-28rpx text-muted" :class="faceOf(`${account?.partnerNickname || '食神'}：${order.note}`, 'sans')">
                  {{ account?.partnerNickname || '食神' }}：{{ order.note }}
                </text>
                <view v-if="order.status === 'pending'" class="flex items-center justify-end gap-16rpx">
                  <view class="eat-press box-border h-78rpx flex items-center border-3rpx border-line rounded-36rpx border-solid px-32rpx" hover-class="eat-press-on" :hover-stay-time="140" @tap.stop="reject(order)">
                    <text class="text-28rpx text-ink font-medium leading-none" :class="faceOf('拒绝', 'sans')">
                      拒绝
                    </text>
                  </view>
                  <view
                    class="eat-press box-border h-78rpx flex items-center gap-16rpx rounded-36rpx px-36rpx"
                    :class="acting === order.orderId ? 'bg-accent-busy' : 'bg-accent'"
                    :hover-class="acting === order.orderId ? 'none' : 'eat-press-on'"
                    :hover-stay-time="140"
                    @tap.stop="accept(order)"
                  >
                    <ink-spin v-if="acting === order.orderId" tone="paper" />
                    <text class="text-28rpx text-paper font-medium leading-none" :class="faceOf(acting === order.orderId ? '正在接单' : '接单', 'sans')">
                      {{ acting === order.orderId ? '正在接单' : '接单' }}
                    </text>
                  </view>
                </view>
              </view>
            </template>
          </view>
        </view>
      </template>
    </list-scroll>
  </view>
</template>
