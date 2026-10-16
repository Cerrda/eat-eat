<script setup lang="ts">
import { faceOf } from '@/utils/face'

const props = withDefaults(defineProps<{
  refreshing: boolean
  loading: boolean
  finished: boolean
  total: number
  insetTop?: number
  insetBottom?: number
  intoView?: string
}>(), {
  insetTop: 0,
  insetBottom: 0,
  intoView: '',
})
const emit = defineEmits<{
  refresh: []
  more: []
}>()
const PULL_DISTANCE = 50
const HOLD_MS = 1200

const instance = getCurrentInstance()
const heightPx = ref('')
const canRefresh = ref(false)
const held = ref(false)
const aimStep = ref(0)
const aimReady = ref(false)
const scrollStyle = computed(() => {
  const style: Record<string, string> = { backgroundColor: 'transparent' }
  if (heightPx.value)
    style.height = heightPx.value
  return style
})
const cuePad = computed(() => {
  const inset = uni.upx2px(props.insetTop)
  return `${Math.max(4, 18 - inset / 2)}px`
})
const indicatorStyle = computed(() => ({
  height: `${PULL_DISTANCE}px`,
  paddingBottom: cuePad.value,
}))
const pullClass = computed(() => {
  const names: string[] = []
  if (held.value)
    names.push('is-loading')
  else if (aimReady.value)
    names.push('is-ready')
  if (!held.value && aimStep.value)
    names.push(`pull-a${aimStep.value}`)
  return names
})
const bodyStyle = computed(() => {
  if (!props.insetBottom)
    return undefined
  return { paddingBottom: `${props.insetBottom}rpx` }
})
let moved = false
let releaseTimer: ReturnType<typeof setTimeout> | undefined

function applyHeight(px: string) {
  if (heightPx.value === px) {
    canRefresh.value = true
    return
  }
  canRefresh.value = false
  heightPx.value = px
  nextTick(() => {
    canRefresh.value = true
  })
}

function measure(attempt = 0) {
  const proxy = instance?.proxy
  if (!proxy)
    return
  uni.createSelectorQuery().in(proxy).select('.list-scroll').boundingClientRect((rect) => {
    const box = rect && !Array.isArray(rect) ? rect : null
    if (box && box.height > 40) {
      applyHeight(`${box.height}px`)
      return
    }
    if (box && box.top > 0) {
      const info = uni.getWindowInfo()
      const inset = Math.max(0, (info.screenHeight || info.windowHeight) - (info.safeArea?.bottom || info.windowHeight))
      const next = info.windowHeight - uni.upx2px(184) - inset - box.top
      if (next > 40) {
        applyHeight(`${next}px`)
        return
      }
    }
    if (attempt < 8) {
      setTimeout(() => measure(attempt + 1), 50)
      return
    }
    canRefresh.value = true
  }).exec()
}

function resetAim() {
  aimStep.value = 0
  aimReady.value = false
}

function onPulling(event: { detail?: { dy?: number } }) {
  if (held.value)
    return
  const dy = Number(event?.detail?.dy || 0)
  if (dy <= 0) {
    resetAim()
    return
  }
  const ratio = Math.min(1, dy / PULL_DISTANCE)
  const step = Math.round(ratio * ratio * 18)
  if (step !== aimStep.value)
    aimStep.value = step
  const ready = dy >= PULL_DISTANCE
  if (ready !== aimReady.value)
    aimReady.value = ready
}

function onRefresh() {
  if (held.value)
    return
  held.value = true
  resetAim()
  emit('refresh')
  if (releaseTimer)
    clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    releaseTimer = undefined
    held.value = false
    resetAim()
  }, HOLD_MS)
}

function onAbort() {
  if (!held.value)
    resetAim()
}

onMounted(() => {
  nextTick(() => measure())
})

onUnmounted(() => {
  if (releaseTimer)
    clearTimeout(releaseTimer)
})

watch(() => props.refreshing, (on) => {
  if (on)
    moved = false
})

function onScroll(event: { detail?: { scrollTop?: number } }) {
  const top = Number(event?.detail?.scrollTop || 0)
  if (top > 16)
    moved = true
}

function onLower() {
  if (!moved)
    return
  emit('more')
}

const scrollTop = ref(0)

interface ScrollFrame {
  scrollTop: number
  scrollHeight: number
  height: number
}

function readFrame(): Promise<ScrollFrame | null> {
  const proxy = instance?.proxy
  if (!proxy)
    return Promise.resolve(null)
  return new Promise((resolve) => {
    uni.createSelectorQuery()
      .in(proxy)
      .select('.list-scroll')
      .boundingClientRect()
      .select('.list-scroll')
      .scrollOffset()
      .exec((result) => {
        const list = Array.isArray(result) ? result : []
        const box = list[0] as { height?: number } | null
        const offset = list[1] as { scrollTop?: number, scrollHeight?: number } | null
        if (!box || Array.isArray(box) || !box.height || !offset || Array.isArray(offset)) {
          resolve(null)
          return
        }
        resolve({
          scrollTop: offset.scrollTop || 0,
          scrollHeight: offset.scrollHeight || 0,
          height: box.height,
        })
      })
  })
}

function scrollTo(top: number) {
  const next = Math.max(0, Math.round(top))
  if (scrollTop.value === next) {
    scrollTop.value = next === 0 ? 1 : next - 1
    nextTick(() => {
      scrollTop.value = next
    })
    return
  }
  scrollTop.value = next
}

defineExpose({ readFrame, scrollTo })
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: false,
  },
}
</script>

<template>
  <scroll-view
    class="list-scroll h-0 min-h-0 w-full flex-1"
    :style="scrollStyle"
    enhanced
    :show-scrollbar="false"
    :bounces="false"
    scroll-y
    :scroll-top="scrollTop"
    :scroll-into-view="intoView"
    scroll-with-animation
    :lower-threshold="120"
    :refresher-enabled="canRefresh"
    :refresher-threshold="PULL_DISTANCE"
    refresher-default-style="none"
    refresher-background="transparent"
    :refresher-triggered="held"
    @refresherpulling="onPulling"
    @refresherrefresh="onRefresh"
    @refresherrestore="resetAim"
    @refresherabort="onAbort"
    @scroll="onScroll"
    @scrolltolower="onLower"
  >
    <template #refresher>
      <view class="pull-indicator" :class="pullClass" :style="indicatorStyle">
        <view class="pull-kit">
          <view class="pull-arrow">
            <view class="pull-ring">
              <view class="pull-chevron" />
            </view>
          </view>
          <view class="pull-spin">
            <ink-spin />
          </view>
          <text class="pull-copy pull-copy-pull" :class="faceOf('下拉刷新', 'sans')">
            下拉刷新
          </text>
          <text class="pull-copy pull-copy-ready" :class="faceOf('松手刷新', 'sans')">
            松手刷新
          </text>
          <text class="pull-copy pull-copy-load" :class="faceOf('正在刷新', 'sans')">
            正在刷新
          </text>
        </view>
      </view>
    </template>
    <view class="pull-body box-border pr-28rpx" :style="bodyStyle">
      <slot />
      <view v-if="loading" class="flex items-center justify-center gap-16rpx py-32rpx">
        <ink-spin />
        <text class="text-26rpx text-#7a534c" :class="faceOf('正在往下翻', 'sans')">
          正在往下翻
        </text>
      </view>
      <view v-else-if="finished && total > 10" class="flex items-center justify-center py-32rpx">
        <text class="text-26rpx text-#7a534c" :class="faceOf('没有更多了', 'sans')">
          没有更多了
        </text>
      </view>
    </view>
  </scroll-view>
</template>

<style>
@import "../../styles/scrollbar.css";

:host {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: calc(100% + 28rpx);
  height: 0;
  min-height: 0;
  margin-right: -28rpx;
  overflow: hidden;
}

.list-scroll {
  background-color: transparent;
}

.pull-indicator {
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  overflow: hidden;
  padding-right: 28rpx;
}

.pull-kit {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.pull-a1 .pull-arrow { transform: rotate(10deg); }
.pull-a2 .pull-arrow { transform: rotate(20deg); }
.pull-a3 .pull-arrow { transform: rotate(30deg); }
.pull-a4 .pull-arrow { transform: rotate(40deg); }
.pull-a5 .pull-arrow { transform: rotate(50deg); }
.pull-a6 .pull-arrow { transform: rotate(60deg); }
.pull-a7 .pull-arrow { transform: rotate(70deg); }
.pull-a8 .pull-arrow { transform: rotate(80deg); }
.pull-a9 .pull-arrow { transform: rotate(90deg); }
.pull-a10 .pull-arrow { transform: rotate(100deg); }
.pull-a11 .pull-arrow { transform: rotate(110deg); }
.pull-a12 .pull-arrow { transform: rotate(120deg); }
.pull-a13 .pull-arrow { transform: rotate(130deg); }
.pull-a14 .pull-arrow { transform: rotate(140deg); }
.pull-a15 .pull-arrow { transform: rotate(150deg); }
.pull-a16 .pull-arrow { transform: rotate(160deg); }
.pull-a17 .pull-arrow { transform: rotate(170deg); }
.pull-a18 .pull-arrow { transform: rotate(180deg); }

.pull-arrow {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
}

.pull-ring {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border: 3rpx solid #792b3e;
  border-radius: 50%;
}

.pull-chevron {
  width: 10rpx;
  height: 10rpx;
  margin-top: -6rpx;
  border-right: 3rpx solid #792b3e;
  border-bottom: 3rpx solid #792b3e;
  transform: rotate(45deg);
}

.pull-spin {
  display: none;
  flex-shrink: 0;
}

.pull-copy {
  display: none;
  font-size: 26rpx;
  line-height: 1;
  color: #7a534c;
}

.pull-copy-pull {
  display: block;
}

.is-ready .pull-copy-pull {
  display: none;
}

.is-ready .pull-copy-ready {
  display: block;
}

.is-loading .pull-arrow,
.is-loading .pull-copy-pull,
.is-loading .pull-copy-ready {
  display: none;
}

.is-loading .pull-spin,
.is-loading .pull-copy-load {
  display: flex;
}

.is-loading .pull-copy-load {
  display: block;
}
</style>
