<script setup lang="ts">
import type { AccountView, OrderDetail, OrderItem } from '@/api/eat'
import { dateLabel, listOrders, SLOT_LABEL, STATUS_LABEL } from '@/api/eat'
import CoverZoom from '@/components/cover-zoom/cover-zoom.vue'
import { useCoverZoom } from '@/composables/useCoverZoom'
import { usePaged } from '@/composables/usePaged'
import { ensureAccount, patchBadges, rememberAccount } from '@/utils/account'
import { art } from '@/utils/theme'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { markTabFresh, noteBadges, openTab } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const props = defineProps<{
  active?: boolean
}>()

const {
  coverZoom,
  heldId,
  domId,
  remember,
  release,
  open: openZoom,
} = useCoverZoom(() => props.active !== false)

const account = ref<AccountView | null>(null)
const { shown, total, finished, loading, reset, more } = usePaged(async (page) => {
  const listed = await listOrders({ page })
  await primeFileUrls(listed.orders.flatMap(order => order.items.map(item => item.coverFileId)))
  return { rows: listed.orders, total: listed.total }
})
const pulling = ref(false)

onMounted(() => {
  void refresh()
})

async function refresh() {
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view)
      return
    await reset()
    const nextBadges = patchBadges({ orders: 0 })
    account.value = { ...view, badges: nextBadges }
    rememberAccount(account.value)
    noteBadges(nextBadges)
    markTabFresh('orders')
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
  uni.navigateTo({ url: `/pages/eat/order?id=${order.orderId}` })
}

function itemKey(order: OrderDetail, item: OrderItem) {
  return `${order.orderId}-${item.dishId}`
}

function previewItem(order: OrderDetail, item: OrderItem) {
  if (!item.coverFileId) {
    openOrder(order)
    return
  }
  void openZoom({
    id: itemKey(order, item),
    fileId: item.coverFileId,
    radius: 26,
  })
}

function openMenu() {
  openTab('menu')
}

async function onMore() {
  try {
    await more()
  }
  catch (err) {
    showError(err)
  }
}

defineExpose({ refresh })

function when(order: OrderDetail) {
  if (!account.value)
    return order.date
  return `${dateLabel(order.date, account.value.today)} · ${SLOT_LABEL[order.slot]}`
}

function statusTone(order: OrderDetail) {
  if (order.status === 'rejected' || order.status === 'cancelled')
    return 'text-muted'
  return 'text-accent'
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

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <list-scroll
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      @refresh="onPull"
      @more="onMore"
    >
      <screen-head title="订单" :note="account && !total ? '还没有点过。' : ''" />
      <template v-if="account">
        <view v-if="!shown.length" class="w-full flex justify-center pb-16rpx pt-32rpx">
          <view class="relative h-428rpx w-616rpx" @tap="openMenu">
            <view class="absolute left-0 top-156rpx box-border h-264rpx w-full flex items-end justify-center border-2rpx border-line rounded-40rpx border-solid bg-cream px-32rpx pb-48rpx">
              <view class="flex items-center gap-12rpx">
                <text class="text-44rpx text-accent leading-none" :class="faceOf('去菜单里点一餐', 'serif')">
                  去菜单里点一餐
                </text>
                <text class="text-44rpx text-accent leading-none" :class="faceOf('›', 'sans')">
                  ›
                </text>
              </view>
            </view>
            <image class="pointer-events-none absolute left-98rpx top-0 z-1 h-320rpx w-420rpx" :src="art('cook-pot')" mode="aspectFit" />
          </view>
        </view>
        <view v-else class="flex flex-col pt-12rpx">
          <view
            v-for="order in shown"
            :key="order.orderId"
            class="flex flex-col border-0 border-t-4rpx border-line border-solid pb-16rpx pt-32rpx"
            @tap="openOrder(order)"
          >
            <view class="flex items-center justify-between pb-16rpx">
              <text class="text-36rpx text-ink leading-[1.15]" :class="faceOf(when(order), 'serif')">
                {{ when(order) }}
              </text>
              <text
                class="text-30rpx leading-[1.15]"
                :class="[statusTone(order), faceOf(STATUS_LABEL[order.status], 'mono')]"
              >
                {{ STATUS_LABEL[order.status] }}
              </text>
            </view>
            <view
              v-for="item in order.items"
              :key="item.dishId"
              class="flex items-center gap-24rpx py-12rpx"
            >
              <view
                :id="domId(itemKey(order, item))"
                class="h-128rpx w-128rpx shrink-0 rounded-32rpx"
                :style="{ boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.28)' }"
                @tap.stop="previewItem(order, item)"
              >
                <dish-cover
                  class="box-border h-full w-full border-6rpx border-photo rounded-32rpx border-solid"
                  :file-id="item.coverFileId"
                  :name="item.name"
                  :held="heldId === itemKey(order, item)"
                  @size="remember(itemKey(order, item), $event)"
                />
              </view>
              <view class="min-w-0 flex-1">
                <text class="text-44rpx text-ink leading-[1.2]" :class="faceOf(item.name, 'serif')">
                  {{ item.name }}
                </text>
              </view>
            </view>
            <view v-if="extra(order)" class="pb-12rpx pt-16rpx">
              <view class="box-border flex items-center gap-16rpx border-3rpx border-line rounded-24rpx border-solid px-24rpx py-16rpx">
                <text class="shrink-0 text-26rpx text-accent leading-none" :class="faceOf('备注', 'mono')">
                  备注
                </text>
                <view class="min-w-0 flex flex-1 items-center -translate-y-6rpx">
                  <text class="text-30rpx text-ink leading-none" :class="faceOf(extra(order), 'serif')">
                    {{ extra(order) }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </template>
    </list-scroll>
    <CoverZoom ref="coverZoom" @idle="release" />
  </view>
</template>
