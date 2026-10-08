<script setup lang="ts">
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

<template>
  <view class="flex items-center gap-8rpx py-8rpx" @tap="back">
    <text class="text-44rpx text-#3c2428 leading-none font-body">
      ‹
    </text>
    <text class="text-36rpx text-#3c2428 font-body">
      {{ label }}
    </text>
  </view>
</template>
