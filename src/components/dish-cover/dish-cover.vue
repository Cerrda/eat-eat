<script setup lang="ts">
import type { CloudImageSize } from '@/utils/files'
import { faceOf } from '@/utils/face'
import { resolveFileUrl } from '@/utils/files'

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

const instance = getCurrentInstance()
const shown = ref('')
const near = ref(false)
let ticket = 0
let usedOriginal = false
let observer: { disconnect: () => void } | undefined
let probe: ReturnType<typeof setTimeout> | undefined
const probeDelays = [48, 160, 360, 700]

/** 大约提前半屏开始拉图，滚到跟前时封面已经在。 */
function aheadPx() {
  return Math.round((uni.getWindowInfo().windowHeight || 0) * 0.5)
}

function stopWatch() {
  observer?.disconnect()
  observer = undefined
  if (probe) {
    clearTimeout(probe)
    probe = undefined
  }
}

function reveal() {
  if (near.value)
    return
  near.value = true
  stopWatch()
}

function placeOf(box: { top?: number, bottom?: number, height?: number } | null) {
  const height = Number(box?.height || 0)
  if (!box || height <= 0)
    return 'unknown' as const
  const top = Number(box.top || 0)
  const bottom = Number(box.bottom ?? top + height)
  const ahead = aheadPx()
  const windowHeight = uni.getWindowInfo().windowHeight || 0
  if (bottom > -ahead && top < windowHeight + ahead)
    return 'near' as const
  return 'far' as const
}

function measure(proxy: NonNullable<typeof instance>['proxy'], attempt: number) {
  if (!proxy || near.value)
    return
  uni.createSelectorQuery().in(proxy).select('.dish-cover').boundingClientRect((rect) => {
    if (near.value)
      return
    const box = rect && !Array.isArray(rect) ? rect : null
    const place = placeOf(box)
    if (place === 'near') {
      reveal()
      return
    }
    if (place === 'far')
      return
    const next = attempt + 1
    if (next < probeDelays.length)
      probe = setTimeout(() => measure(proxy, next), probeDelays[next] - probeDelays[attempt])
  }).exec()
}

function arm() {
  const proxy = instance?.proxy
  if (!proxy) {
    reveal()
    return
  }
  const ahead = aheadPx()
  const created = uni.createIntersectionObserver(proxy, { thresholds: [0], initialRatio: 0 })
  observer = created
  created.relativeToViewport({ top: ahead, bottom: ahead }).observe('.dish-cover', (result) => {
    if (result.intersectionRatio > 0)
      reveal()
  })
  probe = setTimeout(() => measure(proxy, 0), probeDelays[0])
}

onMounted(() => {
  nextTick(arm)
})

onUnmounted(() => {
  ticket += 1
  stopWatch()
})

watch(() => [props.src, props.fileId, props.size, near.value] as const, ([src, fileId, size, ready]) => {
  if (!ready)
    return
  void paint(src, fileId, size)
})

async function paint(src: string | undefined, fileId: string | undefined, size: Exclude<CloudImageSize, 'raw'>) {
  const current = ++ticket
  usedOriginal = false
  if (src) {
    shown.value = src
    return
  }
  const url = await resolveFileUrl(fileId, size)
  if (current === ticket)
    shown.value = url
}

function noteSize(event: { detail?: { width?: number | string, height?: number | string } }) {
  const width = Number(event.detail?.width || 0)
  const height = Number(event.detail?.height || 0)
  if (width > 0 && height > 0)
    emit('size', width / height)
}

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
    <image
      v-if="shown"
      class="dish-cover__img"
      :class="held ? 'dish-cover__held' : ''"
      :src="shown"
      mode="aspectFill"
      @load="noteSize"
      @error="useOriginal"
    />
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

.dish-cover__held {
  opacity: 0;
}
</style>
