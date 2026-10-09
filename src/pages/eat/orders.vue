<script setup lang="ts">
import type { AccountView, OrderDetail } from '@/api/eat'
import { badges, dateLabel, listOrders, SLOT_LABEL, STATUS_LABEL } from '@/api/eat'
import { ensureAccount, rememberAccount } from '@/utils/account'
import { beginTabSwitch } from '@/utils/tab-motion'
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

onShow(() => {
  void refresh()
})

async function refresh() {
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view)
      return
    const listed = await listOrders()
    const nextBadges = await badges()
    account.value = { ...view, badges: nextBadges }
    rememberAccount(account.value)
    orders.value = listed.orders
  }
  catch (err) {
    showError(err)
  }
}

function openOrder(order: OrderDetail) {
  uni.navigateTo({ url: `/pages/eat/order?id=${order.orderId}` })
}

function openMenu() {
  beginTabSwitch('orders', 1, 0)
  uni.redirectTo({ url: '/pages/eat/menu' })
}

function when(order: OrderDetail) {
  if (!account.value)
    return order.date
  return `${dateLabel(order.date, account.value.today)} · ${SLOT_LABEL[order.slot]}`
}
</script>

<template>
  <paper-page dock>
    <ink-load v-if="!account" label="正在翻点过的" />
    <view v-else-if="!orders.length" class="flex flex-col gap-28rpx">
      <screen-head :kicker="`${account?.nickname || '食神'}点过的`" title="订单" note="还没有点过。" />
      <view class="w-full flex flex-col items-center">
        <image class="relative z-1 h-320rpx w-420rpx" src="/static/cook-pot.png" mode="aspectFit" />
        <view class="relative z-0 -mt-156rpx w-616rpx flex items-center justify-center gap-8rpx border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-36rpx pt-180rpx" @tap="openMenu">
          <text class="text-44rpx text-#792b3e font-display">
            去菜单里点一餐
          </text>
          <text class="text-44rpx text-#792b3e font-body">
            ›
          </text>
        </view>
      </view>
    </view>
    <view v-else class="flex flex-col gap-28rpx">
      <screen-head
        :kicker="`${account?.nickname || '食神'}点过的`"
        title="订单"
      />
      <view
        v-for="order in orders"
        :key="order.orderId"
        class="flex flex-col gap-8rpx border-0 border-t-2rpx border-#c9a297 border-solid pt-24rpx"
        @tap="openOrder(order)"
      >
        <view class="flex items-center justify-between">
          <text class="text-30rpx text-#3c2428 font-body">
            {{ when(order) }}
          </text>
          <text
            class="text-28rpx font-body"
            :class="order.status === 'rejected' ? 'text-#9c342c' : 'text-#792b3e'"
          >
            {{ STATUS_LABEL[order.status] }}
          </text>
        </view>
        <text class="text-32rpx text-#3c2428 font-body">
          {{ order.items.map(item => item.name).join('、') }}
        </text>
        <text v-if="order.note && order.status === 'pending'" class="text-26rpx text-#7a534c font-body">
          {{ order.note }}
        </text>
        <text v-if="order.rejectNote" class="text-26rpx text-#7a534c font-body">
          {{ account?.partnerNickname || '厨神' }}：{{ order.rejectNote }}
        </text>
        <text v-else-if="order.cancelNote" class="text-26rpx text-#7a534c font-body">
          {{ order.cancelNote }}
        </text>
      </view>
    </view>
    <template #dock>
      <tab-dock role="eater" current="orders" :badges="account?.badges || { todo: 0, orders: 0, records: 0 }" />
    </template>
  </paper-page>
</template>
