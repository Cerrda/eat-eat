<script setup lang="ts">
import { currentPage, dismissHint, pageRoute, showHint, useHint } from '@/utils/hint'

const { hintRoute, hintSeq, hintText } = useHint()
const ownerRoute = ref(pageRoute(currentPage()))
const visible = ref(false)
let leaveTimer: ReturnType<typeof setTimeout> | undefined

const active = computed(() => hintSeq.value > 0 && hintRoute.value !== '' && hintRoute.value === ownerRoute.value)

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
  }, 240)
}, { immediate: true })
</script>

<template>
  <view class="pointer-events-none fixed left-0 right-0 top-536rpx z-30 flex justify-center px-64rpx">
    <view
      class="box-border max-w-full border-2rpx border-#792b3e rounded-44rpx border-solid bg-#fff9f4 px-32rpx py-22rpx"
      :class="active ? 'ink-toast-in' : 'ink-toast-out'"
      :style="{ opacity: active ? 1 : 0, boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.35)' }"
    >
      <text class="text-center text-30rpx text-#3c2428 font-medium leading-normal font-body">
        {{ hintText }}
      </text>
    </view>
  </view>
</template>

<style>
.ink-toast-in {
  animation: ink-toast-in 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.ink-toast-out {
  animation: ink-toast-out 0.24s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes ink-toast-in {
  from {
    transform: translate3d(0, 16rpx, 0) scale(0.96);
  }

  to {
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes ink-toast-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
    transform: translate3d(0, -12rpx, 0);
  }
}
</style>
