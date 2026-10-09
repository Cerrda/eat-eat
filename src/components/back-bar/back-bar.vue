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

<style>
@import "../../styles/font-util.css";
</style>

<template>
  <paper-pin reserve="56rpx">
    <view class="flex items-center gap-16rpx" @tap="back">
      <view class="h-40rpx w-40rpx flex shrink-0 items-center justify-center">
        <view style="width: 18rpx; height: 18rpx; border-left: 3rpx solid #3C2428; border-bottom: 3rpx solid #3C2428; transform: rotate(45deg);" />
      </view>
      <text class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(label, 'serif')">
        {{ label }}
      </text>
    </view>
  </paper-pin>
</template>
