<script setup lang="ts">
import type { OrderDetail } from '@/api/eat'
import { cancelOrder, dateLabel, getOrder, SLOT_LABEL } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { showHint } from '@/utils/hint'
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
const today = ref('')
const note = ref('')
const pending = ref(false)

const headline = computed(() => {
  if (!order.value)
    return ''
  return `${dateLabel(order.value.date, today.value)}${SLOT_LABEL[order.value.slot]}`
})

onLoad((query) => {
  orderId.value = String(query?.id || '')
})

onShow(async () => {
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view || !orderId.value)
      return
    today.value = view.today
    order.value = await getOrder(orderId.value)
  }
  catch (err) {
    showError(err)
  }
})

async function submit() {
  if (pending.value)
    return
  if (!note.value.trim()) {
    showHint('请留下一句话')
    return
  }
  pending.value = true
  try {
    await cancelOrder(orderId.value, note.value.trim())
    uni.navigateBack()
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <paper-page>
    <view class="flex flex-col gap-28rpx">
      <back-bar label="取消" fallback="/pages/home/index" />
      <text v-if="order" class="text-30rpx text-#7a534c leading-[1.5]" :class="faceOf(headline, 'sans')">
        {{ headline }}
      </text>
      <ink-load v-if="!order" label="正在打开这一餐" />
      <view class="rounded-28rpx bg-#fff9f4 px-28rpx py-24rpx">
        <textarea
          v-model="note"
          class="h-180rpx w-full text-36rpx text-#3c2428 font-body"
          :maxlength="40"
          placeholder="早上改吃别的，这餐先不用了。"
          placeholder-class="ph"
        />
        <text class="block text-right text-26rpx text-#7a534c font-body">
          {{ note.length }} / 40
        </text>
      </view>
      <stamp-button :disabled="pending" :busy="pending" @button-tap="submit">
        {{ pending ? '正在取消' : '取消这一餐' }}
      </stamp-button>
    </view>
  </paper-page>
</template>

<style>
.ph {
  color: #c9a297;
}
</style>
