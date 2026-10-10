<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'solid' | 'ghost'
  disabled?: boolean
  busy?: boolean
  openType?: 'share'
  flat?: boolean
  strong?: boolean
}>(), {
  variant: 'solid',
  disabled: false,
  busy: false,
  flat: false,
  strong: false,
})

const emit = defineEmits<{ buttonTap: [] }>()

const shellClass = computed(() => {
  if (!props.flat)
    return 'rounded-full px-32rpx py-28rpx'
  return props.variant === 'solid'
    ? 'rounded-50rpx px-31rpx py-29rpx'
    : 'rounded-35rpx px-31rpx py-27rpx'
})

const faceClass = computed(() => {
  if (!props.flat)
    return 'text-30rpx font-medium'
  return props.strong ? 'text-29rpx font-medium' : 'text-29rpx font-normal'
})

const pressClass = computed(() => props.flat ? 'eat-flat-press' : 'translate-x-6rpx translate-y-8rpx')

function onTap() {
  if (props.disabled || props.busy)
    return
  emit('buttonTap')
}
</script>

<template>
  <view class="relative">
    <view
      v-if="variant === 'solid' && !busy && !flat"
      class="absolute bottom--8rpx left-6rpx right--6rpx top-8rpx rounded-full bg-#4e222d/35"
    />
    <button
      v-if="openType"
      class="eat-stamp relative box-border w-full border-4rpx border-solid text-center font-body"
      :class="[
        shellClass,
        faceClass,
        variant === 'solid' ? 'border-#792b3e bg-#792b3e text-#fbf3ea' : 'border-#c9a297 bg-#fff9f4 text-#3c2428',
      ]"
      :open-type="openType"
      :disabled="disabled"
      :hover-class="pressClass"
      :hover-stay-time="80"
    >
      <slot />
    </button>
    <view
      v-else
      class="relative box-border w-full border-4rpx border-solid text-center"
      :class="[
        shellClass,
        variant === 'solid'
          ? (busy ? 'border-#a24c5c bg-#a24c5c' : 'border-#792b3e bg-#792b3e')
          : 'border-#c9a297 bg-#fff9f4',
        disabled && !busy ? 'opacity-60' : '',
      ]"
      :hover-class="disabled || busy ? 'none' : pressClass"
      :hover-stay-time="80"
      @tap="onTap"
    >
      <view class="flex items-center justify-center" :class="flat ? 'gap-15rpx' : 'gap-16rpx'">
        <ink-spin v-if="busy" :tone="variant === 'solid' ? 'paper' : 'muted'" />
        <text
          class="font-body"
          :class="[
            faceClass,
            variant === 'solid' ? 'text-#fbf3ea' : (busy ? 'text-#7a534c' : 'text-#3c2428'),
          ]"
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

.eat-flat-press {
  opacity: 0.86;
}
</style>
