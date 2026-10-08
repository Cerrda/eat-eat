<script setup lang="ts">
import type { Badges, Role } from '@/api/eat'

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

function open(url: string, key: string) {
  if (key === props.current)
    return
  uni.redirectTo({ url })
}
</script>

<template>
  <view class="fixed bottom-0 left-0 right-0 z-20 px-32rpx pt-32rpx pb-[calc(32rpx+env(safe-area-inset-bottom))]">
    <view
      class="box-border h-120rpx flex items-stretch gap-8rpx border-4rpx border-#792b3e rounded-60rpx border-solid bg-#fff9f4 p-10rpx"
      :style="{ boxShadow: '4rpx 6rpx 0 rgba(78, 34, 45, 0.28)' }"
    >
      <view
        v-for="item in items"
        :key="item.key"
        class="flex flex-1 items-center justify-center gap-8rpx rounded-48rpx"
        :class="item.key === current ? 'bg-#792b3e' : ''"
        @tap="open(item.url, item.key)"
      >
        <text
          class="font-display leading-[1.15]"
          :class="item.key === current ? 'text-40rpx text-#fff9f4' : 'text-34rpx text-#3c2428'"
        >
          {{ item.label }}
        </text>
        <text
          v-if="item.count"
          class="text-30rpx font-display leading-[1.15]"
          :class="item.key === current ? 'text-#f6e4de' : 'text-#792b3e'"
        >
          {{ item.count }}
        </text>
      </view>
    </view>
  </view>
</template>
