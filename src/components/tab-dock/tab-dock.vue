<script setup lang="ts">
import type { Badges, Role } from '@/api/eat'

const props = withDefaults(defineProps<{
  role: Role
  current: string
  badges: Badges
  leaving?: boolean
}>(), {
  leaving: false,
})

const emit = defineEmits<{
  pick: [key: string]
  departed: []
}>()

const items = computed(() => {
  const settings = { key: 'settings', label: '设置', count: 0 }
  if (props.role === 'cooker') {
    return [
      { key: 'todo', label: '待做', count: props.badges.todo },
      { key: 'dishes', label: '菜品', count: 0 },
      { key: 'records', label: '记录', count: props.badges.records },
      settings,
    ]
  }
  return [
    { key: 'menu', label: '菜单', count: 0 },
    { key: 'orders', label: '订单', count: props.badges.orders },
    { key: 'records', label: '记录', count: props.badges.records },
    settings,
  ]
})

const activeIndex = computed(() => {
  const index = items.value.findIndex(item => item.key === props.current)
  return index < 0 ? 0 : index
})

const LEAD_MS = 200
const SETTLE_MS = 200
const FLOW_MS = LEAD_MS + SETTLE_MS
const LEAVE_MS = 240

interface DockMetrics {
  width: number
  pill: number
  step: number
}

interface DockPose {
  left: number
  width: number
}

const flowing = ref(false)
const arrived = ref(false)
const showInkIn = ref(true)
const metrics = computed(() => measure(Math.max(items.value.length, 1)))
const pose = ref<DockPose>(restPose(activeIndex.value, metrics.value))
let slideToken = 0
let frame: ReturnType<typeof setTimeout> | undefined
let arriveTimer: ReturnType<typeof setTimeout> | undefined
let inkTimer: ReturnType<typeof setTimeout> | undefined
let leaveTimer: ReturnType<typeof setTimeout> | undefined
let left = false
const stretchEase = unitBezier(0.12, 0.72, 0.18, 1)
const settleEase = unitBezier(0.22, 1.18, 0.36, 1)

watch(activeIndex, (next, prev) => {
  if (prev == null || next === prev)
    return
  const token = ++slideToken
  stopFrame()
  const dock = metrics.value
  const from = { ...pose.value }
  const to = restPose(next, dock)
  const peak = stretchBetween(from, to)
  flowing.value = false
  showInkIn.value = false
  nextTick(() => {
    if (token !== slideToken)
      return
    flowing.value = true
    play(token, from, peak, to, dock)
  })
})

const pillMotion = computed(() => {
  if (flowing.value)
    return 'tab-dock-flow'
  if (!arrived.value)
    return 'tab-dock-pill-hold'
  return showInkIn.value ? 'tab-dock-ink-in' : ''
})

const shellClass = computed(() => {
  if (props.leaving)
    return 'tab-dock-leave'
  return arrived.value ? 'tab-dock-enter' : 'tab-dock-hold'
})

const shadowClass = computed(() => {
  if (props.leaving)
    return 'tab-dock-shadow-out'
  return arrived.value ? 'tab-dock-shadow-in' : 'tab-dock-shadow-hold'
})

watch(() => props.leaving, (on) => {
  if (!on)
    return
  left = false
  if (leaveTimer)
    clearTimeout(leaveTimer)
  leaveTimer = setTimeout(finishLeave, LEAVE_MS + 20)
})

function finishLeave() {
  if (left)
    return
  left = true
  if (leaveTimer)
    clearTimeout(leaveTimer)
  leaveTimer = undefined
  emit('departed')
}

function onMotionEnd(event: { animationName?: string, detail?: { animationName?: string } }) {
  const name = event.detail?.animationName || event.animationName || ''
  if (props.leaving && name.includes('tab-dock-leave'))
    finishLeave()
}

onMounted(() => {
  arriveTimer = setTimeout(() => {
    arrived.value = true
  }, 32)
  inkTimer = setTimeout(() => {
    showInkIn.value = false
  }, 420)
})

onUnmounted(() => {
  slideToken += 1
  stopFrame()
  if (arriveTimer)
    clearTimeout(arriveTimer)
  if (inkTimer)
    clearTimeout(inkTimer)
  if (leaveTimer)
    clearTimeout(leaveTimer)
})

const pillStyle = computed(() => ({
  width: `${pose.value.width}px`,
  transform: `translate3d(${pose.value.left}px, 0, 0)`,
}))

const inkStyle = computed(() => ({
  width: `${metrics.value.width}px`,
  transform: `translate3d(${-pose.value.left}px, 0, 0)`,
}))

function measure(count: number): DockMetrics {
  const gap = uni.upx2px(8)
  const width = uni.getWindowInfo().windowWidth - uni.upx2px(32) * 2 - uni.upx2px(4) * 2 - uni.upx2px(10) * 2
  const pill = (width - gap * (count - 1)) / count
  return { width, pill, step: pill + gap }
}

function restPose(index: number, dock: DockMetrics): DockPose {
  return { left: dock.step * index, width: dock.pill }
}

function stretchBetween(from: DockPose, to: DockPose): DockPose {
  const trail = 0.12
  if (to.left >= from.left) {
    const right = to.left + to.width
    const left = from.left + (to.left - from.left) * trail
    return { left, width: Math.max(to.width, right - left) }
  }
  const left = to.left
  const right = from.left + from.width + (to.left - from.left) * trail
  return { left, width: Math.max(to.width, right - left) }
}

function mixPose(from: DockPose, to: DockPose, t: number): DockPose {
  const width = from.width + (to.width - from.width) * t
  const fromRight = from.left + from.width
  const toRight = to.left + to.width
  if (Math.abs(fromRight - toRight) < 0.5)
    return { left: toRight - width, width }
  if (Math.abs(from.left - to.left) < 0.5)
    return { left: to.left, width }
  return {
    left: from.left + (to.left - from.left) * t,
    width,
  }
}

function contain(next: DockPose, dock: DockMetrics): DockPose {
  let left = next.left
  let width = Math.max(1, next.width)
  if (left < 0) {
    width += left
    left = 0
  }
  const overflow = left + width - dock.width
  if (overflow > 0)
    width -= overflow
  return { left, width: Math.max(1, width) }
}

function play(token: number, from: DockPose, peak: DockPose, to: DockPose, dock: DockMetrics) {
  const started = Date.now()
  const step = () => {
    frame = undefined
    if (token !== slideToken)
      return
    const elapsed = Date.now() - started
    if (elapsed < LEAD_MS) {
      pose.value = contain(mixPose(from, peak, stretchEase(elapsed / LEAD_MS)), dock)
      frame = setTimeout(step, 16)
      return
    }
    if (elapsed < FLOW_MS) {
      pose.value = contain(mixPose(peak, to, settleEase((elapsed - LEAD_MS) / SETTLE_MS)), dock)
      frame = setTimeout(step, 16)
      return
    }
    pose.value = to
    flowing.value = false
  }
  step()
}

function stopFrame() {
  if (!frame)
    return
  clearTimeout(frame)
  frame = undefined
}

function unitBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0)
      return 0
    if (x >= 1)
      return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x
      if (Math.abs(dx) < 1e-4)
        return sampleY(t)
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-4)
        break
      t -= dx / slope
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 12; i++) {
      const dx = sampleX(t) - x
      if (Math.abs(dx) < 1e-4)
        break
      if (dx > 0)
        hi = t
      else
        lo = t
      t = (lo + hi) / 2
    }
    return sampleY(Math.min(1, Math.max(0, t)))
  }
}

function open(key: string) {
  if (props.leaving || key === props.current)
    return
  emit('pick', key)
}
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view class="fixed bottom-0 left-0 right-0 z-20 px-32rpx pb-[calc(32rpx+env(safe-area-inset-bottom))] pt-32rpx">
    <view class="relative" :class="shellClass" @animationend="onMotionEnd">
      <view
        class="pointer-events-none absolute rounded-60rpx bg-shade-28"
        :class="shadowClass"
        style="top: 6rpx; right: -4rpx; bottom: -6rpx; left: 4rpx;"
      />
      <view class="relative box-border h-120rpx border-4rpx border-accent rounded-60rpx border-solid bg-cream p-10rpx">
        <view class="relative h-full">
          <view class="h-full flex items-stretch gap-8rpx">
            <view
              v-for="item in items"
              :key="item.key"
              class="flex flex-1 items-center justify-center gap-8rpx"
              @tap="open(item.key)"
            >
              <view class="text-34rpx text-ink leading-[1.15] font-display">
                {{ item.label }}
              </view>
              <view v-if="item.count" class="text-30rpx text-accent leading-[1.15] font-display">
                {{ item.count }}
              </view>
            </view>
          </view>
          <view
            class="tab-dock-slot pointer-events-none absolute left-0 z-1"
            :style="pillStyle"
          >
            <view
              class="tab-dock-pill overflow-hidden rounded-48rpx bg-accent"
              :class="pillMotion"
            >
              <view
                class="tab-dock-ink absolute left-0 top-0 h-full flex items-stretch gap-8rpx"
                :style="inkStyle"
              >
                <view
                  v-for="item in items"
                  :key="item.key"
                  class="flex flex-1 items-center justify-center gap-8rpx"
                >
                  <view class="text-40rpx text-on-accent leading-[1.15] font-display">
                    {{ item.label }}
                  </view>
                  <view v-if="item.count" class="text-30rpx text-wash leading-[1.15] font-display">
                    {{ item.count }}
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
@import "../../styles/font-util.css";

.tab-dock-hold {
  opacity: 0;
  transform: translate3d(0, 48rpx, 0);
}

.tab-dock-enter {
  animation: tab-dock-enter 320ms cubic-bezier(0.22, 1.08, 0.36, 1) both;
}

.tab-dock-leave {
  animation: tab-dock-leave 240ms cubic-bezier(0.4, 0, 1, 1) both;
  pointer-events: none;
}

.tab-dock-shadow-hold {
  opacity: 0;
  transform: translate3d(0, 12rpx, 0);
}

.tab-dock-shadow-in {
  animation: tab-dock-shadow-in 320ms cubic-bezier(0.22, 1.08, 0.36, 1) 48ms both;
}

.tab-dock-shadow-out {
  animation: tab-dock-shadow-out 180ms cubic-bezier(0.4, 0, 1, 1) both;
}

.tab-dock-slot {
  top: 0;
  height: 100%;
}

.tab-dock-pill {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 100%;
  transform-origin: center;
}

.tab-dock-pill-hold {
  opacity: 0;
  transform: scale(0.88);
}

.tab-dock-ink-in {
  animation: tab-dock-ink-in 240ms cubic-bezier(0.22, 1.16, 0.36, 1) 90ms both;
}

.tab-dock-ink {
  will-change: transform;
}

.tab-dock-pill.tab-dock-flow {
  animation: tab-dock-squash 400ms linear both;
}

@keyframes tab-dock-squash {
  0% {
    top: 0;
    height: 100%;
  }

  24% {
    top: 2.5%;
    height: 95%;
  }

  50% {
    top: 4%;
    height: 92%;
  }

  68% {
    top: 1.5%;
    height: 97%;
  }

  84% {
    top: -2.5%;
    height: 105%;
  }

  100% {
    top: 0;
    height: 100%;
  }
}

@keyframes tab-dock-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 48rpx, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes tab-dock-leave {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

  to {
    opacity: 0;
    transform: translate3d(0, 48rpx, 0);
  }
}

@keyframes tab-dock-shadow-in {
  from {
    opacity: 0;
    transform: translate3d(0, 12rpx, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes tab-dock-shadow-out {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }

  to {
    opacity: 0;
    transform: translate3d(0, 16rpx, 0);
  }
}

@keyframes tab-dock-ink-in {
  from {
    opacity: 0;
    transform: scale(0.88);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tab-dock-hold,
  .tab-dock-shadow-hold,
  .tab-dock-pill-hold {
    opacity: 1;
    transform: none;
  }

  .tab-dock-enter,
  .tab-dock-leave,
  .tab-dock-shadow-in,
  .tab-dock-shadow-out,
  .tab-dock-ink-in {
    animation: none;
  }
}
</style>
