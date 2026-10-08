<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import type { Badges, Role } from '@/api/eat'
import { beginTabSwitch, clearTabMotion, readTabOrigin } from '@/utils/tab-motion'

const props = defineProps<{
  role: Role
  current: string
  badges: Badges
}>()

const items = computed(() => {
  const settings = { key: 'settings', label: '设置', url: '/pages/settings/index', count: 0 }
  if (props.role === 'cooker') {
    return [
      { key: 'todo', label: '待做', url: '/pages/cook/todo', count: props.badges.todo },
      { key: 'dishes', label: '菜品', url: '/pages/cook/dishes', count: 0 },
      { key: 'records', label: '记录', url: '/pages/cook/records', count: props.badges.records },
      settings,
    ]
  }
  return [
    { key: 'menu', label: '菜单', url: '/pages/eat/menu', count: 0 },
    { key: 'orders', label: '订单', url: '/pages/eat/orders', count: props.badges.orders },
    { key: 'records', label: '记录', url: '/pages/eat/records', count: props.badges.records },
    settings,
  ]
})

const activeIndex = computed(() => {
  const index = items.value.findIndex(item => item.key === props.current)
  return index < 0 ? 0 : index
})

const originIndex = items.value.findIndex(item => item.key === readTabOrigin())
const slideIndex = ref(originIndex >= 0 && originIndex !== activeIndex.value ? originIndex : activeIndex.value)
const moving = ref(false)
const timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  clearTabMotion()
  if (slideIndex.value === activeIndex.value)
    return
  later(() => {
    moving.value = true
    later(() => {
      slideIndex.value = activeIndex.value
    }, 32)
  }, 32)
})

onUnmounted(() => {
  for (const id of timers)
    clearTimeout(id)
})

const pillStyle = computed(() => {
  const { pill } = track()
  return {
    width: `${pill}px`,
    transform: `translate3d(${travel(slideIndex.value)}px, 0, 0)`,
  }
})

const inkStyle = computed(() => {
  const { width } = track()
  return {
    width: `${width}px`,
    transform: `translate3d(${-travel(slideIndex.value)}px, 0, 0)`,
  }
})

function track() {
  const count = Math.max(items.value.length, 1)
  const gap = uni.upx2px(8)
  const width = uni.getWindowInfo().windowWidth - uni.upx2px(32) * 2 - uni.upx2px(4) * 2 - uni.upx2px(10) * 2
  const pill = (width - gap * (count - 1)) / count
  return { gap, width, pill }
}

function travel(index: number) {
  const { pill, gap } = track()
  return index * (pill + gap)
}

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}

let leaving = false

function open(url: string, key: string) {
  if (leaving || key === props.current)
    return
  const from = items.value.findIndex(item => item.key === props.current)
  const to = items.value.findIndex(item => item.key === key)
  if (from < 0 || to < 0)
    return
  leaving = true
  beginTabSwitch(props.current, from, to)
  uni.redirectTo({
    url,
    fail: () => {
      leaving = false
      clearTabMotion()
    },
  })
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
            @tap="open(item.url, item.key)"
          >
            <text class="text-34rpx text-#3c2428 font-display leading-[1.15]">
              {{ item.label }}
            </text>
            <text v-if="item.count" class="text-30rpx text-#792b3e font-display leading-[1.15]">
              {{ item.count }}
            </text>
          </view>
        </view>
        <view
          class="pointer-events-none absolute bottom-0 left-0 top-0 z-1 overflow-hidden rounded-48rpx bg-#792b3e"
          :class="moving ? 'tab-dock-slide' : ''"
          :style="pillStyle"
        >
          <view
            class="absolute left-0 top-0 h-full flex items-stretch gap-8rpx"
            :class="moving ? 'tab-dock-slide' : ''"
            :style="inkStyle"
          >
            <view
              v-for="item in items"
              :key="item.key"
              class="flex flex-1 items-center justify-center gap-8rpx"
            >
              <text class="text-40rpx text-#fff9f4 font-display leading-[1.15]">
                {{ item.label }}
              </text>
              <text v-if="item.count" class="text-30rpx text-#f6e4de font-display leading-[1.15]">
                {{ item.count }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.tab-dock-slide {
  transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}
</style>
