<script setup lang="ts">
import type { CloudImageSize } from '@/utils/files'
import { faceOf } from '@/utils/face'
import { resolveFileUrl } from '@/utils/files'

const props = withDefaults(defineProps<{
  fileId?: string
  src?: string
  name?: string
  size?: Exclude<CloudImageSize, 'raw'>
}>(), {
  size: 'thumb',
})

const shown = ref('')
let ticket = 0
let usedOriginal = false

watch(() => [props.src, props.fileId, props.size] as const, async ([src, fileId, size]) => {
  const current = ++ticket
  usedOriginal = false
  if (src) {
    shown.value = src
    return
  }
  const url = await resolveFileUrl(fileId, size)
  if (current === ticket)
    shown.value = url
}, { immediate: true })

async function useOriginal() {
  if (usedOriginal || props.src || !props.fileId)
    return
  usedOriginal = true
  const current = ticket
  const url = await resolveFileUrl(props.fileId, 'raw')
  if (current === ticket && url && url !== shown.value)
    shown.value = url
}

const mark = computed(() => Array.from(props.name || '菜')[0] || '菜')
</script>

<template>
  <view class="dish-cover">
    <image v-if="shown" class="dish-cover__img" :src="shown" mode="aspectFill" @error="useOriginal" />
    <view v-else class="dish-cover__mark">
      <text class="text-40rpx text-#792b3e" :class="faceOf(mark, 'serif')">
        {{ mark }}
      </text>
    </view>
  </view>
</template>

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
