<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import { useTopPadding } from '@/composables/useTopPadding'

defineProps<{
  dock?: boolean
}>()

const topPadding = useTopPadding()
</script>

<template>
  <view class="relative w-full bg-#fbf3ea">
    <image
      class="pointer-events-none fixed left-0 top-0 z-0 h-screen w-full"
      src="/static/paper.jpg"
      mode="aspectFill"
    />
    <view
      class="relative z-1 box-border px-44rpx"
      :class="dock ? 'pb-[calc(184rpx+env(safe-area-inset-bottom))]' : 'pb-[calc(64rpx+env(safe-area-inset-bottom))]'"
      :style="{ paddingTop: topPadding }"
    >
      <slot />
    </view>
    <slot name="dock" />
  </view>
</template>
