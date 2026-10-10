<script setup lang="ts">
import type { AccountView, OrderDetail } from '@/api/eat'
import { acceptOrder, dateLabel, listTodo, SLOT_LABEL, STATUS_LABEL } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { whenTabIdle } from '@/utils/tab-motion'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const account = ref<AccountView | null>(null)
const orders = ref<OrderDetail[]>([])
const acting = ref('')
const ready = ref(false)
let spin = 0

const groups = computed(() => {
  const map = new Map<string, OrderDetail[]>()
  for (const order of orders.value) {
    const list = map.get(order.date) || []
    list.push(order)
    map.set(order.date, list)
  }
  return [...map.entries()].map(([date, list]) => ({ date, list }))
})

onShow(() => {
  void refresh()
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view || id !== spin)
      return
    const data = await listTodo()
    if (id !== spin)
      return
    await whenTabIdle()
    if (id !== spin)
      return
    account.value = view
    orders.value = data.orders
    ready.value = true
    await primeFileUrls(data.orders.flatMap(order => order.items.map(item => item.coverFileId)))
  }
  catch (err) {
    if (id === spin)
      showError(err)
  }
}

function settled(order: OrderDetail) {
  return order.status === 'accepted' && !!account.value && order.date < account.value.today
}

function statusText(order: OrderDetail) {
  if (settled(order))
    return '已完成'
  return STATUS_LABEL[order.status]
}

function dayTitle(date: string) {
  if (!account.value)
    return date
  return dateLabel(date, account.value.today)
}

async function accept(order: OrderDetail) {
  if (acting.value)
    return
  acting.value = order.orderId
  try {
    await acceptOrder(order.orderId)
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

function openRecipe(order: OrderDetail, dishId: string) {
  uni.navigateTo({ url: `/pages/cook/recipe?orderId=${order.orderId}&dishId=${dishId}` })
}

function reject(order: OrderDetail) {
  uni.navigateTo({ url: `/pages/cook/reject?id=${order.orderId}` })
}

function writeRecord(order: OrderDetail) {
  uni.navigateTo({ url: `/pages/cook/record-edit?orderId=${order.orderId}` })
}

function openRecords() {
  uni.redirectTo({ url: '/pages/cook/records' })
}
</script>

<template>
  <paper-page dock>
    <view v-if="!ready" class="flex flex-col">
      <screen-head title="待做" />
      <ink-load label="正在看待做" />
    </view>
    <view v-else-if="!groups.length" class="flex flex-col gap-28rpx">
      <screen-head title="待做" note="还没有待做的一餐" />
      <view class="w-full flex flex-col items-center pb-16rpx pt-32rpx">
        <view class="relative h-428rpx w-616rpx">
          <image class="absolute left-98rpx top-0 z-1 h-320rpx w-420rpx" src="/static/cook-pot.png" mode="aspectFit" />
          <view class="absolute left-0 top-156rpx z-0 box-border h-264rpx w-616rpx flex items-end justify-center border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-36rpx pb-48rpx">
            <text class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf('等对方点一餐', 'serif')">
              等对方点一餐
            </text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="flex flex-col gap-28rpx">
      <screen-head title="待做" />
      <view
        v-for="group in groups"
        :key="group.date"
        class="box-border flex flex-col gap-24rpx border-2rpx border-#c9a297 rounded-36rpx border-solid p-28rpx"
      >
        <text class="text-60rpx text-#3c2428 leading-[1.15]" :class="faceOf(dayTitle(group.date), 'serif')">
          {{ dayTitle(group.date) }}
        </text>
        <template v-for="(order, orderIndex) in group.list" :key="order.orderId">
          <view v-if="orderIndex" class="h-2rpx w-full bg-#c9a297" />
          <view class="flex flex-col" :class="settled(order) ? 'gap-16rpx' : 'gap-20rpx'" @tap="openOrder(order)">
            <view class="flex items-center justify-between">
              <text class="text-32rpx text-#3c2428" :class="faceOf(SLOT_LABEL[order.slot], 'sans')">
                {{ SLOT_LABEL[order.slot] }}
              </text>
              <text
                class="text-30rpx"
                :class="[order.status === 'pending' ? 'text-#792b3e' : 'text-#7a534c', faceOf(statusText(order), 'mono')]"
              >
                {{ statusText(order) }}
              </text>
            </view>

            <template v-if="!settled(order)">
              <view class="flex flex-col gap-20rpx">
                <view
                  v-for="item in order.items"
                  :key="item.dishId"
                  class="relative box-border overflow-hidden border-4rpx border-#fff9f4 rounded-36rpx border-solid"
                  :class="order.status === 'pending' ? 'h-296rpx' : 'h-352rpx'"
                >
                  <dish-cover class="absolute left-0 top-0 h-full w-full" :file-id="item.coverFileId" :name="item.name" size="cover" />
                  <view class="absolute bottom-0 left-0 right-0 flex">
                    <view
                      class="box-border max-w-full flex flex-col gap-6rpx rounded-br-36rpx rounded-tr-36rpx bg-#fff9f4"
                      :class="order.status === 'pending' ? 'px-32rpx py-24rpx' : 'pb-24rpx pl-36rpx pr-32rpx pt-24rpx'"
                    >
                      <text
                        class="text-#3c2428 leading-[1.1]"
                        :class="[order.status === 'pending' ? 'text-52rpx' : 'text-56rpx', faceOf(item.name, 'serif')]"
                      >
                        {{ item.name }}
                      </text>
                      <view
                        class="h-8rpx overflow-hidden rounded-[50%] bg-#792b3e"
                        :class="order.status === 'pending' ? 'w-96rpx' : 'w-104rpx'"
                      />
                    </view>
                  </view>
                </view>
              </view>
              <text v-if="order.note" class="text-28rpx text-#7a534c" :class="faceOf(`${account?.partnerNickname || '食神'}：${order.note}`, 'sans')">
                {{ account?.partnerNickname || '食神' }}：{{ order.note }}
              </text>
              <view v-if="order.status === 'pending'" class="flex items-center justify-end gap-16rpx">
                <view class="box-border h-78rpx flex items-center border-3rpx border-#c9a297 rounded-36rpx border-solid px-32rpx" @tap.stop="reject(order)">
                  <text class="text-28rpx text-#3c2428 font-medium leading-none" :class="faceOf('拒绝', 'sans')">
                    拒绝
                  </text>
                </view>
                <view
                  class="box-border h-78rpx flex items-center gap-16rpx rounded-36rpx px-36rpx"
                  :class="acting === order.orderId ? 'bg-#a24c5c' : 'bg-#792b3e'"
                  @tap.stop="accept(order)"
                >
                  <ink-spin v-if="acting === order.orderId" tone="paper" />
                  <text class="text-28rpx text-#fbf3ea font-medium leading-none" :class="faceOf(acting === order.orderId ? '正在接单' : '接单', 'sans')">
                    {{ acting === order.orderId ? '正在接单' : '接单' }}
                  </text>
                </view>
              </view>
            </template>
            <view v-else-if="order.recorded" class="flex items-center justify-between gap-16rpx">
              <view class="min-w-0 flex flex-1 flex-wrap items-center gap-16rpx">
                <view v-for="item in order.items" :key="item.dishId" class="flex items-center gap-16rpx">
                  <text class="text-30rpx text-#3c2428 leading-[1.2]" :class="faceOf(item.name, 'sans')">
                    {{ item.name }}
                  </text>
                  <text class="text-28rpx text-#792b3e" :class="faceOf('做法', 'mono')" @tap.stop="openRecipe(order, item.dishId)">
                    做法
                  </text>
                </view>
              </view>
              <view class="box-border h-78rpx flex shrink-0 items-center border-3rpx border-#c9a297 rounded-36rpx border-solid px-32rpx" @tap.stop="openRecords">
                <text class="text-28rpx text-#7a534c font-medium leading-none" :class="faceOf('已记下', 'sans')">
                  已记下
                </text>
              </view>
            </view>
            <template v-else>
              <view v-for="item in order.items" :key="item.dishId" class="flex items-center justify-between">
                <text class="text-30rpx text-#3c2428 leading-[1.2]" :class="faceOf(item.name, 'sans')">
                  {{ item.name }}
                </text>
                <text class="text-28rpx text-#792b3e" :class="faceOf('做法', 'mono')" @tap.stop="openRecipe(order, item.dishId)">
                  做法
                </text>
              </view>
              <view class="flex justify-end">
                <view class="box-border h-78rpx flex items-center rounded-36rpx bg-#792b3e px-36rpx" @tap.stop="writeRecord(order)">
                  <text class="text-28rpx text-#fbf3ea font-medium leading-none" :class="faceOf('补上', 'sans')">
                    补上
                  </text>
                </view>
              </view>
            </template>
          </view>
        </template>
      </view>
    </view>
    <template #dock>
      <tab-dock role="cooker" current="todo" :badges="account?.badges || { todo: 0, orders: 0, records: 0 }" />
    </template>
  </paper-page>
</template>
