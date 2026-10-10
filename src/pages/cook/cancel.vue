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
  const names = order.value.items.map(item => item.name).join('、')
  return `${dateLabel(order.value.date, today.value)}${SLOT_LABEL[order.value.slot]} · ${names}`
})

onLoad((query) => {
  orderId.value = String(query?.id || '')
})

onShow(async () => {
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
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
    <view class="flex flex-col gap-32rpx">
      <back-bar label="取消" fallback="/pages/home/index" />
      <view class="flex flex-col items-start gap-12rpx">
        <text v-if="order" class="text-30rpx text-#7a534c leading-[1.5]" :class="faceOf(headline, 'sans')">
          {{ headline }}
        </text>
      </view>
      <ink-load v-if="!order" label="正在打开这一餐" />
      <view class="box-border h-300rpx flex flex-col justify-between rounded-28rpx bg-#fff9f4 px-28rpx py-28rpx">
        <textarea
          v-model="note"
          disable-default-padding
          class="box-border h-180rpx w-full text-44rpx text-#3c2428 leading-80rpx"
          :class="faceOf(note, 'serif')"
          :maxlength="40"
          placeholder="你怎么忍心取消的呀！！！"
          placeholder-class="ph-serif"
          placeholder-style="font-size: 44rpx; line-height: 80rpx;"
          :show-confirm-bar="false"
        />
        <text class="block text-right text-30rpx text-#7a534c" :class="faceOf(`${note.length} / 40`, 'mono')">
          {{ note.length }} / 40
        </text>
      </view>
      <stamp-button :disabled="pending" :busy="pending" @button-tap="submit">
        {{ pending ? '正在取消' : '取消这一餐' }}
      </stamp-button>
    </view>
  </paper-page>
</template>

