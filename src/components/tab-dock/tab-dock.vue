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

const slideIndex = ref(activeIndex.value)
const moving = ref(false)
const timers: ReturnType<typeof setTimeout>[] = []
const metrics = computed(() => measure(Math.max(items.value.length, 1)))
let slideToken = 0

watch(activeIndex, (next, prev) => {
  if (prev == null || next === prev)
    return
  const token = ++slideToken
  moving.value = false
  slideIndex.value = prev
  nextTick(() => {
    if (token !== slideToken)
      return
    moving.value = true
    later(() => {
      if (token !== slideToken)
        return
      slideIndex.value = next
    }, 32)
  })
})

onUnmounted(() => {
  for (const id of timers)
    clearTimeout(id)
})

const pillStyle = computed(() => ({
  width: `${metrics.value.pill}px`,
  transform: `translate3d(${metrics.value.step * slideIndex.value}px, 0, 0)`,
}))

const inkStyle = computed(() => ({
  width: `${metrics.value.width}px`,
  transform: `translate3d(${-metrics.value.step * slideIndex.value}px, 0, 0)`,
}))

function measure(count: number) {
  const gap = uni.upx2px(8)
  const width = uni.getWindowInfo().windowWidth - uni.upx2px(32) * 2 - uni.upx2px(4) * 2 - uni.upx2px(10) * 2
  const pill = (width - gap * (count - 1)) / count
  return { width, pill, step: pill + gap }
}

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
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
          class="tab-dock-pill pointer-events-none absolute bottom-0 left-0 top-0 z-1 overflow-hidden rounded-48rpx bg-#792b3e"
          :class="moving ? 'tab-dock-slide' : ''"
          :style="pillStyle"
        >
          <view
            class="tab-dock-ink absolute left-0 top-0 h-full flex items-stretch gap-8rpx"
            :class="moving ? 'tab-dock-slide' : ''"
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

.tab-dock-pill,
.tab-dock-ink {
  will-change: transform;
}

.tab-dock-slide {
  transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
