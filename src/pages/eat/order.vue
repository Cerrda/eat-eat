<script setup lang="ts">
import type { AccountView, OrderDetail } from '@/api/eat'
import { dateLabel, getOrder, SLOT_LABEL } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { menuIntent } from '@/utils/draft'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { withinMenu } from '@/utils/format'
import { openTab, returnHome } from '@/utils/tabs'
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
    if (order.value.status === 'pending' || order.value.status === 'accepted')
      await primeFileUrls(order.value.items.map(item => item.coverFileId))
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

const quote = computed(() => {
  if (!order.value || canChange.value)
    return ''
  return order.value.rejectNote || order.value.cancelNote
})

const quoteLabel = computed(() => {
  if (!order.value?.rejectNote)
    return '留下的话'
  return `${account.value?.partnerNickname || '厨神'}留下的话`
})

function cancel() {
  uni.navigateTo({ url: `/pages/eat/cancel?id=${orderId.value}` })
}

function reorder() {
  if (!order.value)
    return
  menuIntent.date = order.value.date
  menuIntent.slot = order.value.slot
  openTab('menu')
  returnHome()
}
</script>

<template>
  <paper-page>
    <view v-if="order && account" class="flex flex-col gap-28rpx">
      <back-bar label="订单" fallback="/pages/home/index" />
      <text class="text-72rpx text-#3c2428 leading-[1.15]" :class="faceOf(headline, 'serif')">
        {{ headline }}
      </text>
      <ink-underline :width="176" />
      <view v-if="canChange" class="flex flex-col gap-28rpx">
        <view
          v-for="(item, index) in order.items"
          :key="item.dishId"
          class="flex items-center gap-24rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx"
          :class="index === order.items.length - 1 ? 'border-b-4rpx' : ''"
        >
          <view
            class="h-128rpx w-128rpx shrink-0 rounded-36rpx"
            :style="{ boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.28)' }"
          >
            <dish-cover
              class="box-border h-full w-full border-6rpx border-#fff9f4 rounded-36rpx border-solid"
              :file-id="item.coverFileId"
              :name="item.name"
            />
          </view>
          <view class="min-w-0 flex-1">
            <text class="text-40rpx text-#3c2428 leading-[1.15]" :class="faceOf(item.name, 'serif')">
              {{ item.name }}
            </text>
          </view>
        </view>
      </view>
      <view v-else class="flex flex-col">
        <text
          v-for="item in order.items"
          :key="item.dishId"
          class="text-32rpx text-#3c2428 leading-[1.375]"
          :class="faceOf(item.name, 'sans')"
        >
          {{ item.name }}
        </text>
      </view>
      <view
        v-if="canChange && order.note"
        class="flex flex-col gap-8rpx border-0 border-l-4rpx border-#792b3e border-solid py-12rpx pl-28rpx pr-4rpx"
      >
        <text class="text-28rpx text-#792b3e leading-[1.15] tracking-[2rpx]" :class="faceOf('备注', 'mono')">
          备注
        </text>
        <text class="text-40rpx text-#3c2428 leading-[1.15]" :class="faceOf(order.note, 'serif')">
          {{ order.note }}
        </text>
      </view>
      <view
        v-else-if="quote"
        class="flex flex-col gap-16rpx border-0 border-l-4rpx border-#792b3e border-solid py-12rpx pl-28rpx pr-4rpx"
      >
        <text class="text-28rpx text-#792b3e leading-[1.15] tracking-[2rpx]" :class="faceOf(quoteLabel, 'mono')">
          {{ quoteLabel }}
        </text>
        <text class="text-52rpx text-#3c2428 leading-[1.15]" :class="faceOf(quote, 'serif')">
          {{ quote }}
        </text>
      </view>
      <view
        v-if="canChange"
        class="eat-press box-border w-full flex items-center justify-center rounded-36rpx border-4rpx border-#c9a297 border-solid bg-#fff9f4 px-32rpx py-30rpx"
        hover-class="eat-press-on"
        :hover-stay-time="140"
        @tap="cancel"
      >
        <text class="text-30rpx text-#3c2428 font-medium" :class="faceOf('取消这一餐', 'sans')">
          取消这一餐
        </text>
      </view>
      <view v-else-if="canReorder" class="relative">
        <view class="absolute bottom--8rpx left-6rpx right--6rpx top-8rpx rounded-52rpx bg-#4e222d/35" />
        <view
          class="eat-stamp-face relative box-border w-full flex items-center justify-center rounded-52rpx bg-#792b3e px-32rpx py-30rpx"
          hover-class="translate-x-6rpx translate-y-8rpx"
          :hover-stay-time="160"
          @tap="reorder"
        >
          <text class="text-30rpx text-#fbf3ea font-medium" :class="faceOf('重新点这一餐', 'sans')">
            重新点这一餐
          </text>
        </view>
      </view>
    </view>
    <ink-load v-else label="正在打开这一餐" />
  </paper-page>
</template>
