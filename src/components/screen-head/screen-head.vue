<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import { faceOf } from '@/utils/face'

defineProps<{
  kicker?: string
  title: string
  note?: string
}>()

const markWidth = 176
</script>

<style>
@import "../../styles/font-util.css";
</style>

<template>
  <paper-pin :reserve="note ? (kicker ? '244rpx' : '208rpx') : (kicker ? '168rpx' : '132rpx')">
    <view class="flex items-end justify-between gap-24rpx">
      <view class="min-w-0 flex flex-col items-start">
        <view class="flex flex-col items-start gap-4rpx">
          <text v-if="kicker" class="text-28rpx text-#792b3e leading-[1.15]" :class="faceOf(kicker, 'mono')">
            {{ kicker }}
          </text>
          <text class="text-72rpx text-#3c2428 leading-[1.15]" :class="faceOf(title, 'serif')">
            {{ title }}
          </text>
          <ink-underline :width="markWidth" />
        </view>
        <text v-if="note" class="mt-28rpx text-32rpx text-#7a534c leading-[1.5]" :class="faceOf(note, 'sans')">
          {{ note }}
        </text>
      </view>
      <slot />
    </view>
  </paper-pin>
</template>
