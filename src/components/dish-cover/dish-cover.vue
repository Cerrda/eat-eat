<script setup lang="ts">
import { faceOf } from '@/utils/face'
import { resolveFileUrl } from '@/utils/files'

const props = defineProps<{
  fileId?: string
  src?: string
  name?: string
}>()

const shown = ref('')

watch(() => [props.src, props.fileId] as const, async ([src, fileId]) => {
  if (src) {
    shown.value = src
    return
  }
  shown.value = await resolveFileUrl(fileId)
}, { immediate: true })

const mark = computed(() => Array.from(props.name || '菜')[0] || '菜')
</script>

<style>
@import "../../styles/font-util.css";
</style>

<template>
  <view class="relative overflow-hidden bg-#f6e4de">
    <image v-if="shown" class="h-full w-full" :src="shown" mode="aspectFill" />
    <view v-else class="h-full w-full flex items-center justify-center">
      <text class="text-40rpx text-#792b3e" :class="faceOf(mark, 'serif')">
        {{ mark }}
      </text>
    </view>
  </view>
</template>
