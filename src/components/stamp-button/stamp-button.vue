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
      class="absolute bottom--8rpx left-6rpx right--6rpx top-8rpx rounded-full bg-shade-35"
    />
    <button
      v-if="openType"
      class="eat-stamp eat-stamp-face relative box-border w-full border-4rpx border-solid text-center font-body"
      :class="[
        shellClass,
        faceClass,
        variant === 'solid' ? 'border-accent bg-accent text-paper' : 'border-line bg-cream text-ink',
      ]"
      :open-type="openType"
      :disabled="disabled"
      :hover-class="pressClass"
      :hover-stay-time="160"
    >
      <slot />
    </button>
    <view
      v-else
      class="eat-stamp-face relative box-border w-full border-4rpx border-solid text-center"
      :class="[
        shellClass,
        variant === 'solid'
          ? (busy ? 'border-accent-busy bg-accent-busy' : 'border-accent bg-accent')
          : 'border-line bg-cream',
        disabled && !busy ? 'opacity-60' : '',
      ]"
      :hover-class="disabled || busy ? 'none' : pressClass"
      :hover-stay-time="160"
      @tap="onTap"
    >
      <view class="flex items-center justify-center" :class="flat ? 'gap-15rpx' : 'gap-16rpx'">
        <ink-spin v-if="busy" :tone="variant === 'solid' ? 'paper' : 'muted'" />
        <text
          class="font-body"
          :class="[
            faceClass,
            variant === 'solid' ? 'text-paper' : (busy ? 'text-muted' : 'text-ink'),
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
@import "../../styles/motion.css";

.eat-stamp {
  margin: 0;
  line-height: 1.2;
}

.eat-stamp::after {
  border: none;
}

.eat-flat-press {
  transform: scale(0.97);
}
</style>
