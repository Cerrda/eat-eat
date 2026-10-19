<script setup lang="ts">
import type { OrderDetail } from '@/api/eat'
import { getOrder } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { art, pageStyle } from '@/utils/theme'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const orderId = ref('')
const order = ref<OrderDetail | null>(null)

onLoad((query) => {
  orderId.value = String(query?.id || '')
})

onShow(async () => {
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view || !orderId.value)
      return
    order.value = await getOrder(orderId.value)
  }
  catch (err) {
    showError(err)
  }
})

const dishLines = computed(() => order.value?.items.map(item => item.name).join('\n') ?? '')

function openOrder() {
  uni.redirectTo({ url: `/pages/eat/order?id=${orderId.value}` })
}
</script>

<template>
  <page-meta :page-style="pageStyle" />
  <paper-page>
    <view v-if="order" class="flex flex-col gap-32rpx pt-24rpx">
      <view class="eat-rise">
        <text class="text-56rpx text-accent leading-[1.3]" :class="faceOf('点好了', 'sans')">
          点好了
        </text>
      </view>
      <view class="eat-delay-2 eat-seal flex justify-center">
        <image class="h-216rpx w-216rpx" :src="art('cook-seal')" mode="aspectFit" />
      </view>
      <view class="eat-rise eat-delay-4 box-border flex flex-col gap-12rpx border-0 border-l-4rpx border-accent border-solid py-12rpx pl-24rpx pr-4rpx">
        <text class="whitespace-pre-line text-44rpx text-ink leading-[1.15]" :class="faceOf(dishLines, 'serif')">
          {{ dishLines }}
        </text>
        <text v-if="order.note" class="text-28rpx text-muted" :class="faceOf(order.note, 'sans')">
          {{ order.note }}
        </text>
      </view>
      <view class="eat-rise eat-delay-5">
        <stamp-button @button-tap="openOrder">
          看这一餐
        </stamp-button>
      </view>
    </view>
  </paper-page>
</template>
