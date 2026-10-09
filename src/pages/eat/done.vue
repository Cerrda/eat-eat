<script setup lang="ts">
import type { OrderDetail } from '@/api/eat'
import { getOrder } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
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

function openOrder() {
  uni.redirectTo({ url: `/pages/eat/order?id=${orderId.value}` })
}
</script>

<template>
  <paper-page>
    <view v-if="order" class="flex flex-col items-start gap-28rpx pt-40rpx">
      <view class="h-140rpx w-140rpx flex items-center justify-center border-6rpx border-#792b3e rounded-full border-solid">
        <text class="text-64rpx text-#792b3e font-display">
          ✓
        </text>
      </view>
      <text class="text-56rpx text-#792b3e leading-[1.3]" :class="faceOf('点好了', 'sans')">
        点好了
      </text>
      <text class="text-44rpx text-#3c2428 leading-[1.4] font-display">
        {{ order.items.map(item => item.name).join(' / ') }}
      </text>
      <text v-if="order.note" class="text-30rpx text-#7a534c font-body">
        {{ order.note }}
      </text>
      <stamp-button @tap="openOrder">
        看这一餐
      </stamp-button>
    </view>
    <ink-load v-else label="正在写下这一笔" />
  </paper-page>
</template>
