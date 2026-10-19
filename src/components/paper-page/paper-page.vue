<script setup lang="ts">
import { useTopPadding } from '@/composables/useTopPadding'
import { art, themeClass } from '@/utils/theme'

const topPadding = useTopPadding()

onMounted(() => {
  const route = getCurrentPages().slice(-1)[0]?.route || ''
  if (route === 'pages/bind/invite' || route === 'pages/bind/waiting')
    uni.showShareMenu({ menus: ['shareAppMessage'] })
  else
    uni.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
})
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view class="relative w-full bg-paper" :class="themeClass">
    <image
      class="pointer-events-none fixed left-0 top-0 z-0 h-screen w-full"
      :src="art('paper')"
      mode="aspectFill"
    />
    <view
      class="relative z-1 box-border px-44rpx pb-[calc(64rpx+env(safe-area-inset-bottom))]"
      :style="{ paddingTop: topPadding }"
    >
      <slot />
    </view>
    <slot name="dock" />
    <ink-toast />
    <ink-dialog />
  </view>
</template>
