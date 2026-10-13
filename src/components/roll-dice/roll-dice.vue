<script setup lang="ts">
const props = defineProps<{
  rolling?: boolean
}>()

const face = ref(6)
const spots = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const lit: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
}

// 与下方 680ms 关键帧的三次抛起顶点对齐：20%、50%、78%
const FACE_AT = [136, 340, 530]
let beats: ReturnType<typeof setTimeout>[] = []

function clearBeats() {
  for (const beat of beats)
    clearTimeout(beat)
  beats = []
}

function nextFace(current: number) {
  const step = 1 + Math.floor(Math.random() * 5)
  return ((current - 1 + step) % 6) + 1
}

watch(() => props.rolling, (on) => {
  clearBeats()
  if (!on)
    return
  for (const at of FACE_AT) {
    beats.push(setTimeout(() => {
      face.value = nextFace(face.value)
    }, at))
  }
})

onUnmounted(clearBeats)

function pipOn(index: number) {
  return lit[face.value]?.includes(index) || false
}
</script>

<template>
  <view class="roll-die" :class="rolling ? 'roll-die-on' : ''">
    <view class="roll-die-face">
      <view v-for="spot in spots" :key="spot" class="roll-die-cell">
        <view class="roll-die-pip" :class="pipOn(spot) ? 'roll-die-pip-on' : ''" />
      </view>
    </view>
  </view>
</template>

<style>
.roll-die {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  background: #fff9f4;
  border: 3rpx solid #792b3e;
  border-radius: 14rpx;
  transform-origin: center center;
}

.roll-die-on {
  animation: roll-die-tumble 680ms linear both;
}

.roll-die-face {
  display: flex;
  flex-wrap: wrap;
  width: 36rpx;
  height: 36rpx;
}

.roll-die-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12rpx;
  height: 12rpx;
}

.roll-die-pip {
  width: 8rpx;
  height: 8rpx;
  background: #792b3e;
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.5);
  transform-origin: center center;
}

.roll-die-pip-on {
  opacity: 1;
  transform: scale(1);
}

.roll-die-on .roll-die-pip {
  transition:
    opacity 90ms cubic-bezier(0.2, 0, 0, 1),
    transform 110ms cubic-bezier(0.22, 1.15, 0.36, 1);
}

@keyframes roll-die-tumble {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(1, 1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.7, 0.4);
  }

  7% {
    transform: translate(0, 2rpx) rotate(0deg) scale(1.04, 0.96);
    animation-timing-function: cubic-bezier(0.16, 0.84, 0.3, 1);
  }

  20% {
    transform: translate(-5rpx, -8rpx) rotate(-16deg) scale(1, 1);
    animation-timing-function: cubic-bezier(0.4, 0, 1, 1);
  }

  34% {
    transform: translate(0, 1rpx) rotate(3deg) scale(1.04, 0.96);
    animation-timing-function: cubic-bezier(0.16, 0.84, 0.3, 1);
  }

  50% {
    transform: translate(4rpx, -6rpx) rotate(12deg) scale(1, 1);
    animation-timing-function: cubic-bezier(0.4, 0, 1, 1);
  }

  64% {
    transform: translate(0, 1rpx) rotate(-2deg) scale(1.03, 0.97);
    animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1);
  }

  78% {
    transform: translate(-2rpx, -3rpx) rotate(-6deg) scale(1, 1);
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }

  90% {
    transform: translate(0, 0) rotate(2deg) scale(1, 1);
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }

  100% {
    transform: translate(0, 0) rotate(0deg) scale(1, 1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .roll-die-on {
    animation: none;
  }

  .roll-die-on .roll-die-pip {
    transition: none;
  }
}
</style>
