<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { createOrder, dateLabel, EatRequestError, SLOT_LABEL } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { orderDraft } from '@/utils/draft'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { ask, showError, tell } from '@/utils/ui'

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
    await primeFileUrls(orderDraft.dishes.map(dish => dish.coverFileId))
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
      const agreed = orderId
        ? await ask('这一餐已经点过了', '同一天的同一餐，进行中只能有一笔。', '去看')
        : await tell('这一餐已经点过了', '同一天的同一餐，进行中只能有一笔。')
      if (agreed && orderId)
        uni.redirectTo({ url: `/pages/eat/order?id=${orderId}` })
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
      <back-bar label="确认" fallback="/pages/home/index" />
      <template v-if="account && orderDraft.dishes.length">
        <text class="text-30rpx text-#3c2428 font-semibold leading-[1.15]">
          {{ headline }}
        </text>
        <view
          v-for="dish in orderDraft.dishes"
          :key="dish.dishId"
          class="flex items-center gap-24rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx"
        >
          <view
            class="h-128rpx w-128rpx shrink-0 rounded-36rpx"
            :style="{ boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.28)' }"
          >
            <dish-cover
              class="box-border h-full w-full border-6rpx border-#fff9f4 rounded-36rpx border-solid"
              :file-id="dish.coverFileId"
              :name="dish.name"
            />
          </view>
          <view class="min-w-0 flex flex-1 flex-col gap-6rpx">
            <text class="text-40rpx text-#3c2428 leading-[1.15]" :class="faceOf(dish.name, 'serif')">
              {{ dish.name }}
            </text>
            <text class="text-26rpx text-#7a534c" :class="faceOf(dish.categoryName || '未分类', 'sans')">
              {{ dish.categoryName || '未分类' }}
            </text>
          </view>
        </view>
        <view class="flex flex-col gap-16rpx">
          <view class="flex items-center justify-between">
            <text class="text-28rpx text-#792b3e leading-[1.15]" :class="faceOf('备注', 'mono')">
              备注
            </text>
            <text class="text-24rpx text-#7a534c" :class="faceOf(`${note.length} / 100`, 'sans')">
              {{ note.length }} / 100
            </text>
          </view>
          <view class="box-border h-240rpx rounded-36rpx border-4rpx border-#c9a297 border-solid bg-#fff9f4 px-28rpx py-28rpx">
            <textarea
              v-model="note"
              disable-default-padding
              class="box-border h-176rpx w-full text-40rpx text-#3c2428 leading-56rpx font-display"
              :maxlength="100"
              placeholder="想对最爱的老公吩咐点什么吗~"
              placeholder-class="ph-serif"
              placeholder-style="font-size: 40rpx; line-height: 56rpx;"
              :show-confirm-bar="false"
            />
          </view>
        </view>
        <view class="relative">
          <view
            v-if="!pending"
            class="absolute bottom--8rpx left-6rpx right--6rpx top-8rpx rounded-52rpx bg-#4e222d/35"
          />
          <view
            class="eat-stamp-face relative box-border w-full flex items-center justify-center gap-16rpx rounded-52rpx px-32rpx py-30rpx"
            :class="pending ? 'bg-#a24c5c' : 'bg-#792b3e'"
            :hover-class="pending ? 'none' : 'translate-x-6rpx translate-y-8rpx'"
            :hover-stay-time="160"
            @tap="submit"
          >
            <ink-spin v-if="pending" tone="paper" />
            <text class="text-30rpx text-#fbf3ea font-medium leading-none" :class="faceOf(pending ? '正在点餐' : '点这餐', 'sans')">
              {{ pending ? '正在点餐' : '点这餐' }}
            </text>
          </view>
        </view>
      </template>
      <ink-load v-else label="正在核对这一餐" />
    </view>
  </paper-page>
</template>
