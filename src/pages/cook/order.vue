<script setup lang="ts">
import type { AccountView, OrderDetail } from '@/api/eat'
import { acceptOrder, dateLabel, getDish, getOrder, SLOT_LABEL, STATUS_LABEL } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { primeFileUrls } from '@/utils/files'
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
const categories = ref<string[]>([])
const pending = ref(false)

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
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view)
      return
    account.value = view
    const detail = await getOrder(orderId.value)
    order.value = detail
    await primeFileUrls(detail.items.map(item => item.coverFileId))
    categories.value = await Promise.all(detail.items.map(async (item) => {
      try {
        const dish = await getDish(item.dishId)
        return dish.categoryName
      }
      catch {
        return ''
      }
    }))
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

const statusText = computed(() => {
  if (!order.value || !account.value)
    return ''
  if (order.value.status === 'accepted' && order.value.date < account.value.today)
    return '已完成'
  return STATUS_LABEL[order.value.status]
})

async function accept() {
  if (!order.value || pending.value)
    return
  pending.value = true
  try {
    order.value = await acceptOrder(order.value.orderId)
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = false
  }
}

function reject() {
  if (!order.value)
    return
  uni.navigateTo({ url: `/pages/cook/reject?id=${order.value.orderId}` })
}

function openRecipe(dishId: string) {
  if (!order.value)
    return
  uni.navigateTo({ url: `/pages/cook/recipe?orderId=${order.value.orderId}&dishId=${dishId}` })
}

function writeRecord() {
  if (!order.value)
    return
  uni.navigateTo({ url: `/pages/cook/record-edit?orderId=${order.value.orderId}` })
}
</script>

<template>
  <paper-page>
    <view class="flex flex-col gap-28rpx">
      <back-bar label="这一餐" fallback="/pages/cook/todo" />
      <template v-if="order">
      <text class="text-30rpx text-#7a534c font-body">
        {{ headline }}
      </text>
      <text class="text-30rpx text-#792b3e font-body">
        {{ statusText }}
      </text>
      <view v-for="(item, index) in order.items" :key="item.dishId" class="flex items-center gap-20rpx">
        <dish-cover class="h-128rpx w-128rpx rounded-28rpx" :file-id="item.coverFileId" :name="item.name" />
        <view class="flex flex-1 flex-col gap-6rpx">
          <text class="text-40rpx text-#3c2428 font-display">
            {{ item.name }}
          </text>
          <text v-if="categories[index]" class="text-26rpx text-#7a534c font-body">
            {{ categories[index] }}
          </text>
        </view>
        <text class="text-28rpx text-#792b3e font-body" @tap="openRecipe(item.dishId)">
          做法
        </text>
      </view>
      <view v-if="order.note" class="flex flex-col gap-8rpx pt-8rpx">
        <text class="text-28rpx text-#7a534c font-body">
          {{ account?.partnerNickname || '食神' }}留下的话
        </text>
        <text class="text-44rpx text-#3c2428 leading-[1.3] font-display">
          {{ order.note }}
        </text>
      </view>
      <view v-if="order.status === 'pending'" class="flex items-center gap-20rpx pt-12rpx">
        <view class="flex-1">
          <stamp-button variant="ghost" @tap="reject">
            拒绝
          </stamp-button>
        </view>
        <view class="flex-[1.4]">
          <stamp-button :disabled="pending" :busy="pending" @tap="accept">
            {{ pending ? '正在接下' : '接下这一餐' }}
          </stamp-button>
        </view>
      </view>
      <stamp-button v-else-if="statusText === '已完成' && !order.recorded" @tap="writeRecord">
        补上
      </stamp-button>
      </template>
      <ink-load v-else label="正在打开这一餐" />
    </view>
  </paper-page>
</template>
