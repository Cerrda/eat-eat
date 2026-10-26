<script setup lang="ts">
import { faceOf } from '@/utils/face'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  pick: [source: 'album' | 'camera']
  close: []
}>()

const sources = [
  { source: 'album' as const, label: '从相册选', hint: '可多选' },
  { source: 'camera' as const, label: '拍一张', hint: '单张' },
]

const visible = ref(false)
const shown = ref(false)
let leaveTimer: ReturnType<typeof setTimeout> | undefined

watch(() => props.open, (open) => {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = undefined
  }
  if (open) {
    visible.value = true
    shown.value = true
    return
  }
  if (!visible.value)
    return
  shown.value = false
  leaveTimer = setTimeout(() => {
    visible.value = false
    leaveTimer = undefined
  }, 260)
}, { immediate: true })

onUnmounted(() => {
  if (leaveTimer)
    clearTimeout(leaveTimer)
})

function pick(source: 'album' | 'camera') {
  emit('pick', source)
}

function close() {
  emit('close')
}

function freeze() {}
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view
    v-if="visible"
    class="fixed bottom-0 left-0 right-0 top-0"
    style="z-index: 36;"
    @touchmove.stop.prevent="freeze"
  >
    <view
      class="absolute bottom-0 left-0 right-0 top-0 bg-scrim"
      :class="shown ? 'photo-mask-in' : 'photo-mask-out'"
      @tap="close"
    />
    <view
      class="photo-sheet box-border absolute bottom-0 left-0 right-0 overflow-hidden border-0 border-t-4rpx border-line border-solid bg-cream px-40rpx pt-28rpx"
      :class="shown ? 'photo-sheet-in' : 'photo-sheet-out'"
      :style="{ paddingBottom: 'calc(60rpx + env(safe-area-inset-bottom))' }"
      @tap.stop="freeze"
    >
      <view class="flex flex-col gap-24rpx" :class="shown ? 'photo-body-in' : ''">
        <view class="flex justify-center">
          <view class="h-8rpx w-80rpx rounded-4rpx bg-line" />
        </view>
        <text class="text-48rpx text-ink leading-[1.15]" :class="faceOf('加照片', 'serif')">
          加照片
        </text>
        <view class="flex gap-28rpx">
          <view
            v-for="item in sources"
            :key="item.source"
            class="eat-press box-border h-224rpx flex flex-1 flex-col items-center justify-center gap-16rpx border-4rpx border-line rounded-36rpx border-solid bg-cream"
            hover-class="eat-press-on"
            :hover-stay-time="120"
            @tap="pick(item.source)"
          >
            <text class="text-52rpx text-ink leading-[1.15]" :class="faceOf(item.label, 'serif')">
              {{ item.label }}
            </text>
            <text class="text-26rpx text-muted leading-[1.15]" :class="faceOf(item.hint, 'mono')">
              {{ item.hint }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.photo-sheet {
  border-radius: 44rpx 44rpx 0 0;
}

.photo-mask-in {
  animation: photo-mask-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.photo-mask-out {
  animation: photo-mask-out 220ms cubic-bezier(0.4, 0, 1, 1) both;
}

.photo-sheet-in {
  animation: photo-sheet-in 340ms cubic-bezier(0.22, 1.06, 0.36, 1) both;
}

.photo-sheet-out {
  animation: photo-sheet-out 260ms cubic-bezier(0.4, 0, 1, 1) both;
}

.photo-body-in {
  animation: photo-body-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both;
}

@keyframes photo-mask-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes photo-mask-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes photo-sheet-in {
  from {
    transform: translate3d(0, 100%, 0);
  }

  to {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes photo-sheet-out {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(0, 100%, 0);
  }
}

@keyframes photo-body-in {
  from {
    opacity: 0;
    transform: translate3d(0, 20rpx, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
</style>
