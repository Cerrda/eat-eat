<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import { useTopPadding } from '@/composables/useTopPadding'

const props = withDefaults(defineProps<{
  reserve?: string
}>(), {
  reserve: '112rpx',
})

const topPadding = useTopPadding()
const hold = ref(0)
const instance = getCurrentInstance()

const bleed = computed(() => ({
  top: `-${topPadding.value}`,
  right: '0',
  bottom: '0',
  left: '0',
}))

function measure() {
  const proxy = instance?.proxy
  if (!proxy)
    return
  uni.createSelectorQuery()
    .in(proxy)
    .select('.paper-pin')
    .boundingClientRect((rect) => {
      const node = Array.isArray(rect) ? rect[0] : rect
      if (!node?.height)
        return
      const next = Math.ceil(node.height)
      if (Math.abs(next - hold.value) > 1)
        hold.value = next
    })
    .exec()
}

onMounted(() => {
  measure()
  setTimeout(measure, 80)
  setTimeout(measure, 320)
})
</script>

<template>
  <view class="w-full -mb-28rpx" :style="{ height: hold ? `${hold}px` : props.reserve }">
    <view class="paper-pin fixed left-0 right-0 z-10" :style="{ top: topPadding }">
      <view class="pointer-events-none absolute overflow-hidden bg-#fbf3ea" :style="bleed">
        <image
          class="absolute left-0 top-0 h-screen w-full"
          src="/static/paper.jpg"
          mode="aspectFill"
        />
      </view>
      <view class="relative px-44rpx pb-28rpx">
        <slot />
      </view>
    </view>
  </view>
</template>
