<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import { faceOf } from '@/utils/face'

const props = defineProps<{
  refreshing: boolean
  loading: boolean
  finished: boolean
  total: number
}>()

const emit = defineEmits<{
  refresh: []
  more: []
}>()

const instance = getCurrentInstance()
const heightPx = ref('')
let moved = false

function measure() {
  const proxy = instance?.proxy
  if (!proxy)
    return
  uni.createSelectorQuery().in(proxy).select('.list-scroll').boundingClientRect((rect) => {
    const box = rect && !Array.isArray(rect) ? rect : null
    if (!box)
      return
    if (box.height > 40) {
      heightPx.value = `${box.height}px`
      return
    }
    if (box.top <= 0)
      return
    const info = uni.getWindowInfo()
    const inset = Math.max(0, (info.screenHeight || info.windowHeight) - (info.safeArea?.bottom || info.windowHeight))
    const next = info.windowHeight - uni.upx2px(184) - inset - box.top
    if (next > 40)
      heightPx.value = `${next}px`
  }).exec()
}

onMounted(() => {
  nextTick(() => measure())
})

watch(() => props.refreshing, (on) => {
  if (on)
    moved = false
})

function onScroll(event: { detail?: { scrollTop?: number } }) {
  if ((event.detail?.scrollTop || 0) > 16)
    moved = true
}

function onLower() {
  if (!moved)
    return
  emit('more')
}
</script>

<template>
  <scroll-view
    scroll-y
    class="list-scroll h-0 min-h-0 w-full flex-1"
    :style="heightPx ? { height: heightPx } : undefined"
    :show-scrollbar="false"
    refresher-enabled
    refresher-default-style="none"
    refresher-background="#fbf3ea"
    :refresher-threshold="56"
    :refresher-triggered="refreshing"
    :lower-threshold="120"
    @refresherrefresh="emit('refresh')"
    @scrolltolower="onLower"
    @scroll="onScroll"
  >
    <template #refresher>
      <view class="box-border h-full w-full flex items-center justify-center gap-16rpx">
        <ink-spin />
        <text class="text-26rpx text-#7a534c" :class="faceOf('正在刷新', 'sans')">
          正在刷新
        </text>
      </view>
    </template>
    <slot />
    <view v-if="loading" class="flex items-center justify-center gap-16rpx py-32rpx">
      <ink-spin />
      <text class="text-26rpx text-#7a534c" :class="faceOf('正在往下翻', 'sans')">
        正在往下翻
      </text>
    </view>
    <view v-else-if="finished && total > 10" class="flex items-center justify-center py-32rpx">
      <text class="text-26rpx text-#7a534c" :class="faceOf('没有更多了', 'sans')">
        没有更多了
      </text>
    </view>
  </scroll-view>
</template>
