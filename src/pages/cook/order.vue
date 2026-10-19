<script setup lang="ts">
import type { AccountView, OrderDetail, OrderItem } from '@/api/eat'
import { acceptOrder, dateLabel, getDish, getOrder, SLOT_LABEL, STATUS_LABEL } from '@/api/eat'
import CoverZoom from '@/components/cover-zoom/cover-zoom.vue'
import { useCoverZoom } from '@/composables/useCoverZoom'
import { ensureAccount, releaseTodo } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { pageStyle } from '@/utils/theme'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const {
  coverZoom,
  heldId,
  domId,
  remember,
  release,
  open: openZoom,
} = useCoverZoom()

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
    const wasPending = order.value.status === 'pending'
    order.value = await acceptOrder(order.value.orderId)
    if (wasPending)
      releaseTodo()
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

function previewItem(item: OrderItem) {
  if (!item.coverFileId) {
    openRecipe(item.dishId)
    return
  }
  void openZoom({ id: item.dishId, fileId: item.coverFileId })
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

function cancel() {
  if (!order.value)
    return
  uni.navigateTo({ url: `/pages/cook/cancel?id=${order.value.orderId}` })
}
</script>

<template>
  <page-meta :page-style="pageStyle" />
  <paper-page>
    <view class="flex flex-col gap-32rpx">
      <back-bar label="这一餐" fallback="/pages/home/index" />
      <template v-if="order">
        <text class="text-30rpx text-ink font-semibold leading-[1.15]">
          {{ headline }}
        </text>
        <text class="text-30rpx text-accent" :class="faceOf(statusText, 'mono')">
          {{ statusText }}
        </text>
        <view v-if="order.items.length" class="flex flex-col">
          <view
            v-for="(item, index) in order.items"
            :key="item.dishId"
            class="flex items-center gap-24rpx border-0 border-t-4rpx border-line border-solid py-28rpx"
            @tap="openRecipe(item.dishId)"
          >
            <view
              :id="domId(item.dishId)"
              class="h-144rpx w-144rpx shrink-0"
              @tap.stop="previewItem(item)"
            >
              <dish-cover
                class="box-border h-full w-full border-6rpx border-photo rounded-36rpx border-solid"
                :file-id="item.coverFileId"
                :name="item.name"
                :held="heldId === item.dishId"
                @size="remember(item.dishId, $event)"
              />
            </view>
            <view class="min-w-0 flex flex-1 flex-col gap-8rpx">
              <text class="text-40rpx text-ink leading-[1.15]" :class="faceOf(item.name, 'serif')">
                {{ item.name }}
              </text>
              <text v-if="categories[index]" class="text-26rpx text-muted" :class="faceOf(categories[index], 'sans')">
                {{ categories[index] }}
              </text>
            </view>
          </view>
        </view>
        <view v-if="order.note" class="flex flex-col gap-8rpx border-0 border-l-4rpx border-accent border-solid py-12rpx pl-28rpx pr-4rpx">
          <text class="text-28rpx text-accent leading-[1.15]" :class="faceOf(`${account?.partnerNickname || '食神'}留下的话`, 'mono')">
            {{ account?.partnerNickname || '食神' }}留下的话
          </text>
          <text class="text-44rpx text-ink leading-[1.15]" :class="faceOf(order.note, 'serif')">
            {{ order.note }}
          </text>
        </view>
        <view v-if="order.status === 'pending'" class="flex items-center gap-20rpx">
          <view class="box-border flex items-center justify-center border-4rpx border-line rounded-36rpx border-solid bg-cream px-44rpx py-30rpx" @tap="reject">
            <text class="text-30rpx text-ink font-medium leading-none" :class="faceOf('拒绝', 'sans')">
              拒绝
            </text>
          </view>
          <view
            class="box-border flex flex-1 items-center justify-center gap-16rpx rounded-52rpx px-32rpx py-30rpx"
            :class="pending ? 'bg-accent-busy' : 'bg-accent'"
            @tap="accept"
          >
            <ink-spin v-if="pending" tone="paper" />
            <text class="text-30rpx text-paper font-medium leading-none" :class="faceOf(pending ? '正在接下' : '接下这一餐', 'sans')">
              {{ pending ? '正在接下' : '接下这一餐' }}
            </text>
          </view>
        </view>
        <view
          v-else-if="statusText === '已完成' && !order.recorded"
          class="box-border flex items-center justify-center rounded-52rpx bg-accent px-32rpx py-30rpx"
          @tap="writeRecord"
        >
          <text class="text-30rpx text-paper font-medium leading-none" :class="faceOf('补上', 'sans')">
            补上
          </text>
        </view>
        <view
          v-if="order.status === 'accepted'"
          class="box-border flex items-center justify-center border-4rpx border-line rounded-36rpx border-solid bg-cream px-44rpx py-30rpx"
          @tap="cancel"
        >
          <text class="text-30rpx text-ink font-medium leading-none" :class="faceOf('取消这一餐', 'sans')">
            取消这一餐
          </text>
        </view>
      </template>
    </view>
    <CoverZoom ref="coverZoom" @idle="release" />
  </paper-page>
</template>
