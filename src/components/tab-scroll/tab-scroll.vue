<script setup lang="ts">
import { useTopPadding } from '@/composables/useTopPadding'

const props = defineProps<{
  active: boolean
  motion: '' | 'left' | 'right'
}>()

const topPadding = useTopPadding()
const shiftClass = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let frame: ReturnType<typeof setTimeout> | undefined

watch(() => props.active, (on) => {
  if (on)
    return
  shiftClass.value = ''
  if (timer)
    clearTimeout(timer)
  if (frame)
    clearTimeout(frame)
})

watch(() => props.motion, (value) => {
  if (!props.active || !value)
    return
  if (timer)
    clearTimeout(timer)
  if (frame)
    clearTimeout(frame)
  shiftClass.value = value === 'right' ? 'tab-hold-right' : 'tab-hold-left'
  frame = setTimeout(() => {
    shiftClass.value = value === 'right' ? 'tab-hold-right tab-from-right' : 'tab-hold-left tab-from-left'
  }, 32)
  timer = setTimeout(() => {
    shiftClass.value = ''
  }, 420)
})

onUnmounted(() => {
  if (timer)
    clearTimeout(timer)
  if (frame)
    clearTimeout(frame)
})
</script>

<template>
  <view
    class="fixed left-0 top-0 box-border w-full flex flex-col overflow-hidden"
    :style="{
      height: '100vh',
      paddingTop: topPadding,
      paddingBottom: 'calc(184rpx + env(safe-area-inset-bottom))',
      visibility: active ? 'visible' : 'hidden',
      pointerEvents: active ? 'auto' : 'none',
      zIndex: active ? 1 : 0,
    }"
  >
    <view class="h-0 min-h-0 flex flex-1 flex-col px-44rpx" :class="shiftClass">
      <slot />
    </view>
  </view>
</template>

<style>
.tab-hold-right {
  transform: translate3d(56rpx, 0, 0);
}

.tab-hold-left {
  transform: translate3d(-56rpx, 0, 0);
}

.tab-from-right {
  animation: tab-from-right 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tab-from-left {
  animation: tab-from-left 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes tab-from-right {
  from {
    transform: translate3d(56rpx, 0, 0);
  }

  to {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes tab-from-left {
  from {
    transform: translate3d(-56rpx, 0, 0);
  }

  to {
    transform: translate3d(0, 0, 0);
  }
}
</style>
