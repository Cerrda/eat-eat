<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import { useTopPadding } from '@/composables/useTopPadding'
import { readTabShift } from '@/utils/tab-motion'

const props = defineProps<{
  dock?: boolean
}>()

const topPadding = useTopPadding()
const shift = ref(props.dock ? readTabShift() : '')
let shiftTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (!shift.value)
    return
  shiftTimer = setTimeout(() => {
    shift.value = ''
  }, 420)
})

onUnmounted(() => {
  if (shiftTimer)
    clearTimeout(shiftTimer)
})
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
      :class="[
        dock ? 'pb-[calc(184rpx+env(safe-area-inset-bottom))]' : 'pb-[calc(64rpx+env(safe-area-inset-bottom))]',
        shift === 'right' ? 'paper-tab-from-right' : '',
        shift === 'left' ? 'paper-tab-from-left' : '',
      ]"
      :style="{ paddingTop: topPadding }"
    >
      <slot />
    </view>
    <slot name="dock" />
  </view>
</template>

<style>
.paper-tab-from-right {
  animation: paper-tab-from-right 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.paper-tab-from-left {
  animation: paper-tab-from-left 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes paper-tab-from-right {
  from {
    transform: translate3d(56rpx, 0, 0);
  }

  to {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes paper-tab-from-left {
  from {
    transform: translate3d(-56rpx, 0, 0);
  }

  to {
    transform: translate3d(0, 0, 0);
  }
}
</style>
