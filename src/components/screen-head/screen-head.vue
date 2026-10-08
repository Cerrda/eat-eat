<script setup lang="ts">
defineProps<{
  kicker?: string
  title: string
}>()
</script>

<template>
  <view class="flex flex-col items-start gap-8rpx">
    <text v-if="kicker" class="text-28rpx text-#7a534c font-body">
      {{ kicker }}
    </text>
    <text class="text-72rpx text-#3c2428 leading-[1.15] font-display">
      {{ title }}
    </text>
    <ink-underline :width="150" />
  </view>
</template>
