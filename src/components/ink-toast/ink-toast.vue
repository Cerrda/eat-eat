<script setup lang="ts">
import { currentPage, dismissHint, pageRoute, showHint, useHint } from '@/utils/hint'

const { hintRoute, hintSeq, hintText } = useHint()
const ownerRoute = ref(pageRoute(currentPage()))
const visible = ref(false)
let leaveTimer: ReturnType<typeof setTimeout> | undefined

const active = computed(() => hintSeq.value > 0 && hintText.value !== '' && hintRoute.value !== '' && hintRoute.value === ownerRoute.value)

function syncOwner() {
  ownerRoute.value = pageRoute(currentPage())
}

onMounted(syncOwner)
onShow(syncOwner)

onUnload(() => {
  if (hintRoute.value === ownerRoute.value)
    dismissHint()
})

onUnmounted(() => {
  if (leaveTimer)
    clearTimeout(leaveTimer)
})

defineExpose({ show: showHint })

watch(active, (on) => {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = undefined
  }
  if (on) {
    visible.value = true
    return
  }
  if (!visible.value)
    return
  leaveTimer = setTimeout(() => {
    visible.value = false
  }, 180)
}, { immediate: true })
</script>

<template>
  <view v-if="visible" class="pointer-events-none fixed left-0 right-0 top-536rpx z-30 flex justify-center px-64rpx">
    <view class="relative max-w-full">
      <view
        class="pointer-events-none absolute rounded-44rpx bg-#4e222d/35"
        :class="active ? 'ink-toast-shadow-in' : 'ink-toast-shadow-out'"
        style="top: 8rpx; right: -6rpx; bottom: -8rpx; left: 6rpx;"
      />
      <view
        class="relative box-border border-2rpx border-#792b3e rounded-44rpx border-solid bg-#fff9f4 px-32rpx py-22rpx"
        :class="active ? 'ink-toast-in' : 'ink-toast-out'"
      >
        <text class="text-center text-30rpx text-#3c2428 font-medium leading-normal font-body">
          {{ hintText }}
        </text>
      </view>
    </view>
  </view>
</template>

<style>
.ink-toast-in {
  animation: ink-toast-in 0.2s cubic-bezier(0.22, 1.08, 0.36, 1);
}

.ink-toast-out {
  animation: ink-toast-out 0.16s cubic-bezier(0.4, 0, 1, 1) forwards;
}

.ink-toast-shadow-in {
  animation: ink-toast-shadow-in 0.2s cubic-bezier(0.22, 1.08, 0.36, 1) 40ms both;
}

.ink-toast-shadow-out {
  animation: ink-toast-shadow-out 0.16s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes ink-toast-in {
  from {
    opacity: 0;
    transform: translate3d(0, 16rpx, 0) scale(0.94);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes ink-toast-out {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }

  to {
    opacity: 0;
    transform: translate3d(0, -10rpx, 0) scale(0.98);
  }
}

@keyframes ink-toast-shadow-in {
  from {
    opacity: 0;
    transform: translate3d(0, 22rpx, 0) scale(0.9);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes ink-toast-shadow-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
    transform: translate3d(0, -8rpx, 0);
  }
}
</style>
