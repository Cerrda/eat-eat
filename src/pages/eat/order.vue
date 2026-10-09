<script setup lang="ts">
import type { AccountView, OrderDetail } from '@/api/eat'
import { dateLabel, getOrder, SLOT_LABEL } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { menuIntent } from '@/utils/draft'
import { withinMenu } from '@/utils/format'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const orderId = ref('')
const account = ref<AccountView | null>(null)
const order = ref<OrderDetail | null>(null)

onLoad((query) => {
  orderId.value = String(query?.id || '')
})

onShow(() => {
  void refresh()
})

async function refresh() {
  if (!orderId.value)
    return
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view)
      return
    account.value = view
    order.value = await getOrder(orderId.value)
  }
  catch (err) {
    showError(err)
  }
}

const headline = computed(() => {
  if (!order.value || !account.value)
    return ''
  return `${dateLabel(order.value.date, account.value.today)} · ${SLOT_LABEL[order.value.slot]}`
})

const canChange = computed(() => order.value?.status === 'pending' || order.value?.status === 'accepted')
const ended = computed(() => order.value?.status === 'rejected' || order.value?.status === 'cancelled')
const canReorder = computed(() => {
  if (!order.value || !account.value || !ended.value)
    return false
  return withinMenu(order.value.date, account.value.today)
})

function cancel() {
  uni.navigateTo({ url: `/pages/eat/cancel?id=${orderId.value}` })
}

function reorder() {
  if (!order.value)
    return
  menuIntent.date = order.value.date
  menuIntent.slot = order.value.slot
  uni.redirectTo({ url: '/pages/eat/menu' })
}
</script>

<template>
  <paper-page>
    <view class="flex flex-col gap-24rpx">
      <back-bar label="订单" fallback="/pages/eat/orders" />
      <template v-if="order && account">
      <view class="flex flex-col items-start">
        <text class="text-72rpx text-#3c2428 leading-[1.15] font-display">
          {{ headline }}
        </text>
        <ink-underline class="mt-8rpx" :width="176" />
      </view>
      <text
        v-for="item in order.items"
        :key="item.dishId"
        class="text-40rpx text-#3c2428 font-display"
      >
        {{ item.name }}
      </text>
      <view v-if="order.note && canChange" class="flex flex-col gap-8rpx pt-8rpx">
        <text class="text-28rpx text-#7a534c font-body">
          备注
        </text>
        <text class="text-40rpx text-#3c2428 font-display">
          {{ order.note }}
        </text>
      </view>
      <view v-if="order.rejectNote" class="flex flex-col gap-8rpx pt-8rpx">
        <text class="text-28rpx text-#7a534c font-body">
          {{ account.partnerNickname || '厨神' }}留下的话
        </text>
        <text class="text-48rpx text-#3c2428 leading-[1.3] font-display">
          {{ order.rejectNote }}
        </text>
      </view>
      <view v-else-if="order.cancelNote" class="flex flex-col gap-8rpx pt-8rpx">
        <text class="text-28rpx text-#7a534c font-body">
          留下的话
        </text>
        <text class="text-40rpx text-#3c2428 font-display">
          {{ order.cancelNote }}
        </text>
      </view>
      <stamp-button v-if="canChange" variant="ghost" @tap="cancel">
        取消这一餐
      </stamp-button>
      <stamp-button v-else-if="canReorder" @tap="reorder">
        重新点这一餐
      </stamp-button>
      </template>
      <ink-load v-else label="正在打开这一餐" />
    </view>
  </paper-page>
</template>
