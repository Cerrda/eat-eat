<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import type { AccountView, OrderDetail } from '@/api/eat'
import { badges, dateLabel, listOrders, SLOT_LABEL, STATUS_LABEL } from '@/api/eat'
import { usePaged } from '@/composables/usePaged'
import { ensureAccount, rememberAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { showHint } from '@/utils/hint'
import { fillOrders, isSample } from '@/utils/sample-feed'
import { markTabFresh, noteBadges, openTab } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const account = ref<AccountView | null>(null)
const pool = ref<OrderDetail[]>([])
const rows = computed(() => fillOrders(pool.value, account.value?.today || ''))
const { shown, total, finished, loading, reset, more } = usePaged(rows)
const pulling = ref(false)

onMounted(() => {
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
    noteBadges(nextBadges)
    markTabFresh('orders')
    pool.value = listed.orders
    reset()
  }
  catch (err) {
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

function openOrder(order: OrderDetail) {
  if (isSample(order.orderId)) {
    showHint('这是凑出来的示例')
    return
  }
  uni.navigateTo({ url: `/pages/eat/order?id=${order.orderId}` })
}

function openMenu() {
  openTab('menu')
}

defineExpose({ refresh })

function when(order: OrderDetail) {
  if (!account.value)
    return order.date
  return `${dateLabel(order.date, account.value.today)} · ${SLOT_LABEL[order.slot]}`
}

function statusTone(order: OrderDetail) {
  if (order.status === 'rejected' || order.status === 'cancelled')
    return 'text-#7a534c'
  return 'text-#792b3e'
}

function extra(order: OrderDetail) {
  if (order.note && order.status === 'pending')
    return order.note
  if (order.rejectNote)
    return `${account.value?.partnerNickname || '厨神'}：${order.rejectNote}`
  if (order.cancelNote)
    return order.cancelNote
  return ''
}
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <view class="shrink-0">
      <screen-head title="订单" />
    </view>
    <ink-load v-if="!account" label="正在翻点过的" />
    <list-scroll
      v-else
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      @refresh="onPull"
      @more="more"
    >
      <view v-if="!shown.length" class="w-full flex justify-center pb-16rpx pt-32rpx">
        <view class="relative h-428rpx w-616rpx" @tap="openMenu">
          <view class="absolute left-0 top-156rpx box-border h-264rpx w-full flex items-end justify-center border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-48rpx">
            <view class="flex items-center gap-12rpx">
              <text class="text-44rpx text-#792b3e leading-none" :class="faceOf('去菜单里点一餐', 'serif')">
                去菜单里点一餐
              </text>
              <text class="text-44rpx text-#792b3e leading-none" :class="faceOf('›', 'sans')">
                ›
              </text>
            </view>
          </view>
          <image class="pointer-events-none absolute left-98rpx top-0 z-1 h-320rpx w-420rpx" src="/static/cook-pot.png" mode="aspectFit" />
        </view>
      </view>
      <view v-else class="flex flex-col pt-8rpx">
        <view
          v-for="order in shown"
          :key="order.orderId"
          class="flex flex-col gap-8rpx border-0 border-t-4rpx border-#c9a297 border-solid py-28rpx"
          @tap="openOrder(order)"
        >
          <view class="flex items-center justify-between">
            <text class="text-30rpx text-#3c2428 font-semibold leading-[1.15]">
              {{ when(order) }}
            </text>
            <text
              class="text-30rpx leading-[1.15] tracking-[1.2rpx]"
              :class="[statusTone(order), faceOf(STATUS_LABEL[order.status], 'mono')]"
            >
              {{ STATUS_LABEL[order.status] }}
            </text>
          </view>
          <text class="text-28rpx text-#3c2428" :class="faceOf(order.items.map(item => item.name).join('、'), 'sans')">
            {{ order.items.map(item => item.name).join('、') }}
          </text>
          <text v-if="extra(order)" class="text-26rpx text-#7a534c" :class="faceOf(extra(order), 'sans')">
            {{ extra(order) }}
          </text>
        </view>
      </view>
    </list-scroll>
  </view>
</template>
