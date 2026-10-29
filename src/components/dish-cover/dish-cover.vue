<script setup lang="ts">
import type { CloudImageSize } from '@/utils/files'
import { faceOf } from '@/utils/face'
import { cacheDisplayedImage, resolveFileUrl } from '@/utils/files'

const props = withDefaults(defineProps<{
  fileId?: string
  src?: string
  name?: string
  size?: Exclude<CloudImageSize, 'raw'>
  held?: boolean
}>(), {
  size: 'thumb',
  held: false,
})

const emit = defineEmits<{
  size: [aspect: number]
}>()

const shown = ref('')
let ticket = 0
let usedOriginal = false
let shownSize: CloudImageSize = props.size

watch(() => [props.src, props.fileId, props.size] as const, ([src, fileId, size]) => {
  void paint(src, fileId, size)
}, { immediate: true })

async function paint(src: string | undefined, fileId: string | undefined, size: Exclude<CloudImageSize, 'raw'>) {
  const current = ++ticket
  usedOriginal = false
  shownSize = size
  if (src) {
    const next = /^https?:\/\//.test(src) ? await resolveFileUrl(src, size, false) : src
    if (current === ticket)
      shown.value = next
    return
  }
  const url = await resolveFileUrl(fileId, size, false)
  if (current === ticket)
    shown.value = url
}

function onLoaded(event: { detail?: { width?: number | string, height?: number | string } }) {
  const width = Number(event.detail?.width || 0)
  const height = Number(event.detail?.height || 0)
  if (width > 0 && height > 0)
    emit('size', width / height)
  // 屏幕上真的画出来了再落盘，屏幕外的封面不会提前占流量和缓存。
  cacheDisplayedImage(props.src || props.fileId, shownSize, shown.value)
}

async function useOriginal() {
  if (usedOriginal || props.src || !props.fileId)
    return
  usedOriginal = true
  const current = ticket
  const url = await resolveFileUrl(props.fileId, 'raw', false)
  if (current === ticket && url && url !== shown.value) {
    shownSize = 'raw'
    shown.value = url
  }
}

const mark = computed(() => Array.from(props.name || '菜')[0] || '菜')
</script>

<template>
  <view class="dish-cover">
    <image
      v-if="shown"
      class="dish-cover__img"
      :class="held ? 'dish-cover__held' : ''"
      :src="shown"
      mode="aspectFill"
      @load="onLoaded"
      @error="useOriginal"
    />
    <view v-else class="dish-cover__mark">
      <text class="text-40rpx text-accent" :class="faceOf(mark, 'serif')">
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
  background: var(--wash);
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

.dish-cover__held {
  opacity: 0;
}
</style>
