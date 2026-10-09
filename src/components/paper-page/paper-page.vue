<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import { useTopPadding } from '@/composables/useTopPadding'
import { holdTabMotion, readTabShift } from '@/utils/tab-motion'

const props = defineProps<{
  dock?: boolean
}>()

const topPadding = useTopPadding()
const shift = ref(props.dock ? readTabShift() : '')
const playing = ref(false)
const page = getCurrentInstance()
let shiftTimer: ReturnType<typeof setTimeout> | undefined
let playTimer: ReturnType<typeof setTimeout> | undefined

if (shift.value)
  holdTabMotion(80)

const shiftClass = computed(() => {
  if (shift.value === 'right')
    return playing.value ? 'paper-tab-hold-right paper-tab-from-right' : 'paper-tab-hold paper-tab-hold-right'
  if (shift.value === 'left')
    return playing.value ? 'paper-tab-hold-left paper-tab-from-left' : 'paper-tab-hold paper-tab-hold-left'
  return ''
})

function playShift() {
  if (!shift.value)
    return
  holdTabMotion(480)
  const play = () => {
    if (playing.value || !shift.value)
      return
    playing.value = true
    holdTabMotion(420)
    shiftTimer = setTimeout(() => {
      shift.value = ''
      playing.value = false
    }, 420)
  }
  nextTick(() => {
    uni.createSelectorQuery()
      .in(page?.proxy)
      .select('.paper-tab-hold')
      .boundingClientRect()
      .exec(() => play())
  })
  playTimer = setTimeout(play, 120)
}

onMounted(() => {
  const route = getCurrentPages().slice(-1)[0]?.route || ''
  if (route === 'pages/bind/invite' || route === 'pages/bind/waiting')
    uni.showShareMenu({ menus: ['shareAppMessage'] })
  else
    uni.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
  playShift()
})

onUnmounted(() => {
  if (shiftTimer)
    clearTimeout(shiftTimer)
  if (playTimer)
    clearTimeout(playTimer)
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
        shiftClass,
      ]"
      :style="{ paddingTop: topPadding }"
    >
      <slot />
    </view>
    <slot name="dock" />
    <ink-toast />
  </view>
</template>

<style>
.paper-tab-hold-right {
  transform: translate3d(56rpx, 0, 0);
}

.paper-tab-hold-left {
  transform: translate3d(-56rpx, 0, 0);
}

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
