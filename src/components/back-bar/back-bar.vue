<script setup lang="ts">
import { faceOf } from '@/utils/face'

const props = defineProps<{
  label: string
  fallback?: string
}>()

function back() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: props.fallback || '/pages/index' })
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
  <view class="eat-back inline-flex items-center self-start gap-16rpx" hover-class="eat-back-on" :hover-stay-time="140" @tap="back">
    <view class="eat-back-mark h-40rpx w-40rpx flex shrink-0 items-center justify-center">
      <view class="eat-back-chevron" />
    </view>
    <text class="text-44rpx text-ink leading-[1.15]" :class="faceOf(label, 'serif')">
      {{ label }}
    </text>
  </view>
</template>

<style>
@import "../../styles/font-util.css";

.eat-back-mark {
  transition: transform 140ms cubic-bezier(0.22, 1.08, 0.36, 1);
}

.eat-back-chevron {
  width: 18rpx;
  height: 18rpx;
  border-bottom: 3rpx solid var(--ink);
  border-left: 3rpx solid var(--ink);
  transform: rotate(45deg);
}

.eat-back-on .eat-back-mark {
  transform: translate3d(-6rpx, 0, 0);
}
</style>
