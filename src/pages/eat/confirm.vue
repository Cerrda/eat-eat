<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { createOrder, dateLabel, EatRequestError, SLOT_LABEL } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { orderDraft } from '@/utils/draft'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const account = ref<AccountView | null>(null)
const note = ref('')
const pending = ref(false)

const headline = computed(() => {
  if (!account.value || !orderDraft.slot)
    return ''
  return `${dateLabel(orderDraft.date, account.value.today)} · ${SLOT_LABEL[orderDraft.slot]}`
})

onShow(async () => {
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view)
      return
    if (!orderDraft.date || !orderDraft.slot || !orderDraft.dishes.length) {
      uni.navigateBack()
      return
    }
    account.value = view
  }
  catch (err) {
    showError(err)
  }
})

async function submit() {
  if (pending.value || !orderDraft.slot)
    return
  pending.value = true
  try {
    const order = await createOrder({
      date: orderDraft.date,
      slot: orderDraft.slot,
      dishIds: orderDraft.dishes.map(dish => dish.dishId),
      note: note.value.trim(),
    })
    uni.redirectTo({ url: `/pages/eat/done?id=${order.orderId}` })
  }
  catch (err) {
    if (err instanceof EatRequestError && err.errCode === 'SLOT_TAKEN') {
      const orderId = (err.data as { orderId?: string } | undefined)?.orderId
      uni.showModal({
        title: '这一餐已经点过了',
        content: '同一天的同一餐，进行中只能有一笔。',
        confirmText: orderId ? '去看' : '知道了',
        showCancel: Boolean(orderId),
        success(result) {
          if (result.confirm && orderId)
            uni.redirectTo({ url: `/pages/eat/order?id=${orderId}` })
        },
      })
      return
    }
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
      <back-bar label="确认" fallback="/pages/eat/menu" />
      <template v-if="account && orderDraft.dishes.length">
      <text class="text-30rpx text-#7a534c font-body">
        {{ headline }}
      </text>
      <view v-for="dish in orderDraft.dishes" :key="dish.dishId" class="flex flex-col gap-4rpx">
        <text class="text-40rpx text-#3c2428 font-display">
          {{ dish.name }}
        </text>
        <text class="text-26rpx text-#7a534c font-body">
          {{ dish.categoryName || '未分类' }}
        </text>
      </view>
      <view class="flex items-center justify-between">
        <text class="text-28rpx text-#7a534c font-body">
          备注
        </text>
        <text class="text-24rpx text-#7a534c font-body">
          {{ note.length }} / 100
        </text>
      </view>
      <view class="rounded-28rpx bg-#fff9f4 px-28rpx py-24rpx">
        <textarea
          v-model="note"
          class="h-140rpx w-full text-36rpx text-#3c2428 font-body"
          :maxlength="100"
          placeholder="想早一点吃。"
          placeholder-class="ph"
        />
      </view>
      <stamp-button :disabled="pending" :busy="pending" @tap="submit">
        {{ pending ? '正在点餐' : '点这餐' }}
      </stamp-button>
      </template>
      <ink-load v-else label="正在核对这一餐" />
    </view>
  </paper-page>
</template>

<style>
.ph {
  color: #c9a297;
}
</style>
