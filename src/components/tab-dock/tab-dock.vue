<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import type { Badges, Role } from '@/api/eat'

const props = defineProps<{
  role: Role
  current: string
  badges: Badges
}>()

const emit = defineEmits<{
  pick: [key: string]
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
const FLOW_MS = 400

interface DockMetrics {
  width: number
  pill: number
  step: number
}

interface DockPose {
  left: number
  width: number
}

const phase = ref<'' | 'stretch' | 'settle'>('')
const metrics = computed(() => measure(Math.max(items.value.length, 1)))
const pose = ref<DockPose>(restPose(activeIndex.value, metrics.value))
const timers: ReturnType<typeof setTimeout>[] = []
let slideToken = 0

watch(activeIndex, (next, prev) => {
  if (prev == null || next === prev)
    return
  const token = ++slideToken
  clearTimers()
  phase.value = ''
  pose.value = restPose(prev, metrics.value)
  nextTick(() => {
    if (token !== slideToken)
      return
    later(() => {
      if (token !== slideToken)
        return
      const dock = metrics.value
      pose.value = stretchPose(prev, next, dock)
      phase.value = 'stretch'
      later(() => {
        if (token !== slideToken)
          return
        pose.value = restPose(next, dock)
        phase.value = 'settle'
      }, LEAD_MS)
      later(() => {
        if (token !== slideToken)
          return
        phase.value = ''
      }, FLOW_MS + 24)
    }, 32)
  })
})

onUnmounted(clearTimers)

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

function stretchPose(from: number, to: number, dock: DockMetrics): DockPose {
  const start = dock.step * from
  const end = dock.step * to
  const trail = 0.12
  if (to > from) {
    const right = end + dock.pill
    const left = start + (end - start) * trail
    return { left, width: right - left }
  }
  const left = end
  const right = start + dock.pill + (end - start) * trail
  return { left, width: right - left }
}

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}

function clearTimers() {
  for (const id of timers)
    clearTimeout(id)
  timers.length = 0
}

function open(key: string) {
  if (key === props.current)
    return
  emit('pick', key)
}
</script>

<template>
  <view class="fixed bottom-0 left-0 right-0 z-20 px-32rpx pt-32rpx pb-[calc(32rpx+env(safe-area-inset-bottom))]">
    <view
      class="box-border h-120rpx border-4rpx border-#792b3e rounded-60rpx border-solid bg-#fff9f4 p-10rpx"
      :style="{ boxShadow: '4rpx 6rpx 0 rgba(78, 34, 45, 0.28)' }"
    >
      <view class="relative h-full">
        <view class="h-full flex items-stretch gap-8rpx">
          <view
            v-for="item in items"
            :key="item.key"
            class="flex flex-1 items-center justify-center gap-8rpx"
            @tap="open(item.key)"
          >
            <view class="text-34rpx text-#3c2428 font-display leading-[1.15]">
              {{ item.label }}
            </view>
            <view v-if="item.count" class="text-30rpx text-#792b3e font-display leading-[1.15]">
              {{ item.count }}
            </view>
          </view>
        </view>
        <view
          class="tab-dock-pill pointer-events-none absolute left-0 z-1 overflow-hidden rounded-48rpx bg-#792b3e"
          :class="phase ? `tab-dock-flow tab-dock-${phase}` : ''"
          :style="pillStyle"
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
              <view class="text-40rpx text-#fff9f4 font-display leading-[1.15]">
                {{ item.label }}
              </view>
              <view v-if="item.count" class="text-30rpx text-#f6e4de font-display leading-[1.15]">
                {{ item.count }}
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

.tab-dock-pill {
  top: 0;
  height: 100%;
  will-change: transform, width, height;
}

.tab-dock-ink {
  will-change: transform;
}

.tab-dock-pill.tab-dock-stretch {
  transition:
    transform 200ms cubic-bezier(0.12, 0.72, 0.18, 1),
    width 200ms cubic-bezier(0.12, 0.72, 0.18, 1);
}

.tab-dock-pill.tab-dock-stretch .tab-dock-ink {
  transition: transform 200ms cubic-bezier(0.12, 0.72, 0.18, 1);
}

.tab-dock-pill.tab-dock-settle {
  transition:
    transform 200ms cubic-bezier(0.22, 1.18, 0.36, 1),
    width 200ms cubic-bezier(0.22, 1.18, 0.36, 1);
}

.tab-dock-pill.tab-dock-settle .tab-dock-ink {
  transition: transform 200ms cubic-bezier(0.22, 1.18, 0.36, 1);
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
</style>
