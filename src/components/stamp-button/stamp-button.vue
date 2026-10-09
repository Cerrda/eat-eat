<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'solid' | 'ghost'
  disabled?: boolean
  busy?: boolean
  openType?: 'share'
}>(), {
  variant: 'solid',
  disabled: false,
  busy: false,
})

const emit = defineEmits<{ tap: [] }>()

function onTap() {
  if (props.disabled || props.busy)
    return
  emit('tap')
}
</script>

<template>
  <view class="relative">
    <view
      v-if="variant === 'solid' && !busy"
      class="absolute bottom--8rpx left-6rpx right--6rpx top-8rpx rounded-full bg-#4e222d/35"
    />
    <button
      v-if="openType"
      class="eat-stamp relative box-border w-full border-4rpx rounded-full border-solid px-32rpx py-28rpx text-center text-30rpx font-medium font-body"
      :class="variant === 'solid' ? 'border-#792b3e bg-#792b3e text-#fbf3ea' : 'border-#c9a297 bg-#fff9f4 text-#3c2428'"
      :open-type="openType"
      :disabled="disabled"
      hover-class="translate-x-6rpx translate-y-8rpx"
      :hover-stay-time="80"
    >
      <slot />
    </button>
    <view
      v-else
      class="relative box-border w-full border-4rpx rounded-full border-solid px-32rpx py-28rpx text-center"
      :class="[
        variant === 'solid'
          ? (busy ? 'border-#a24c5c bg-#a24c5c' : 'border-#792b3e bg-#792b3e')
          : 'border-#c9a297 bg-#fff9f4',
        disabled && !busy ? 'opacity-60' : '',
      ]"
      :hover-class="disabled || busy ? 'none' : 'translate-x-6rpx translate-y-8rpx'"
      :hover-stay-time="80"
      @tap="onTap"
    >
      <view class="flex items-center justify-center gap-16rpx">
        <ink-spin v-if="busy" :tone="variant === 'solid' ? 'paper' : 'muted'" />
        <text
          class="text-30rpx font-medium font-body"
          :class="variant === 'solid' ? 'text-#fbf3ea' : (busy ? 'text-#7a534c' : 'text-#3c2428')"
        >
          <slot />
        </text>
      </view>
    </view>
  </view>
</template>

<style>
@import "../../styles/font-util.css";

.eat-stamp {
  margin: 0;
  line-height: 1.2;
}

.eat-stamp::after {
  border: none;
}
</style>
