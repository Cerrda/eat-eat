<script setup lang="ts">
import { faceOf } from '@/utils/face'
import { resolveFileUrl } from '@/utils/files'

const props = defineProps<{
  fileId?: string
  src?: string
  name?: string
}>()

const shown = ref('')
let ticket = 0

watch(() => [props.src, props.fileId] as const, async ([src, fileId]) => {
  const current = ++ticket
  if (src) {
    shown.value = src
    return
  }
  const url = await resolveFileUrl(fileId)
  if (current === ticket)
    shown.value = url
}, { immediate: true })

const mark = computed(() => Array.from(props.name || '菜')[0] || '菜')
</script>

<style>
@import "../../styles/font-util.css";

:host {
  display: block;
  position: relative;
  overflow: hidden;
}

.dish-cover {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  background: #f6e4de;
}

.dish-cover__img,
.dish-cover__mark {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.dish-cover__mark {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<template>
  <view class="dish-cover">
    <image v-if="shown" class="dish-cover__img" :src="shown" mode="aspectFill" />
    <view v-else class="dish-cover__mark">
      <text class="text-40rpx text-#792b3e" :class="faceOf(mark, 'serif')">
        {{ mark }}
      </text>
    </view>
  </view>
</template>
