<script lang="ts">
import { hooksOf } from './pull-bridge'

export default {
  options: {
    virtualHost: false,
  },
  methods: {
    onHold() {
      hooksOf(this)?.hold()
    },
    onDone() {
      hooksOf(this)?.done()
    },
    markMoved() {
      hooksOf(this)?.moved()
    },
  },
}
</script>

<script setup lang="ts">
import { pullHandlers } from './pull-bridge'
import { faceOf } from '@/utils/face'

const props = withDefaults(defineProps<{
  refreshing: boolean
  loading: boolean
  finished: boolean
  total: number
  insetTop?: number
}>(), {
  insetTop: 0,
})

const emit = defineEmits<{
  refresh: []
  more: []
}>()

const instance = getCurrentInstance()
const heightPx = ref('')
const scrollable = ref(true)
const scrollStyle = computed(() => {
  const style: Record<string, string> = { backgroundColor: 'transparent' }
  if (heightPx.value)
    style.height = heightPx.value
  return style
})
const cuePad = computed(() => {
  const inset = uni.upx2px(props.insetTop)
  return `${Math.max(4, 18 - inset / 2)}px`
})
let moved = false

function measure() {
  const proxy = instance?.proxy
  if (!proxy)
    return
  uni.createSelectorQuery().in(proxy).select('.list-scroll').boundingClientRect((rect) => {
    const box = rect && !Array.isArray(rect) ? rect : null
    if (!box)
      return
    if (box.height > 40) {
      heightPx.value = `${box.height}px`
      return
    }
    if (box.top <= 0)
      return
    const info = uni.getWindowInfo()
    const inset = Math.max(0, (info.screenHeight || info.windowHeight) - (info.safeArea?.bottom || info.windowHeight))
    const next = info.windowHeight - uni.upx2px(184) - inset - box.top
    if (next > 40)
      heightPx.value = `${next}px`
  }).exec()
}

function finish() {
  scrollable.value = true
}

function onHold() {
  scrollable.value = false
  moved = false
  emit('refresh')
}

function onDone() {
  finish()
}

function markMoved() {
  moved = true
}

if (instance) {
  const hooks = {
    hold: onHold,
    done: onDone,
    moved: markMoved,
  }
  pullHandlers.set(instance.uid, hooks)
  ;(instance as { pullHooks?: typeof hooks }).pullHooks = hooks
  const proxy = instance.proxy as { pullHooks?: typeof hooks } | null
  if (proxy)
    proxy.pullHooks = hooks
}

onMounted(() => {
  nextTick(() => measure())
})

onUnmounted(() => {
  if (instance)
    pullHandlers.delete(instance.uid)
})

watch(() => props.refreshing, (on) => {
  if (on)
    moved = false
})

function onLower() {
  if (!moved)
    return
  emit('more')
}
</script>

<script module="pull" lang="wxs">
var RANGE = 180
var TRIGGER = 70
var HOLD = 60
var SETTLE_MS = 440
var HOLD_MS = 1200
var HOME_MS = 520
var SPRING = 'transform 520ms cubic-bezier(0.34, 1.45, 0.36, 1)'
var SPRING_HOLD = 'transform 440ms cubic-bezier(0.34, 1.45, 0.36, 1)'

function damp(dy) {
  var drag = 0.586
  var offset = RANGE * (1 - Math.exp(-dy * drag / RANGE))
  if (offset < 0)
    return 0
  if (offset > RANGE)
    return RANGE
  return offset
}

function trackOf(owner, event) {
  var state = owner.getState()
  if (state.track)
    return state.track
  var node = event && event.instance
  if (node && node.getDataset) {
    var data = node.getDataset()
    if (data && data.pull === 'track') {
      state.track = node
      return node
    }
  }
  var found = null
  if (node && node.selectComponent)
    found = node.selectComponent('.pull-track')
  if (!found && owner.selectComponent)
    found = owner.selectComponent('.pull-track')
  if (!found)
    return null
  state.track = found
  return found
}

function place(track, offset, transition) {
  track.setStyle({
    transition: transition,
    transform: 'translate3d(0,' + offset + 'px,0)'
  })
}

function aim(track, state, offset) {
  var p = offset / TRIGGER
  if (p < 0)
    p = 0
  if (p > 1)
    p = 1
  var step = Math.round(p * p * 18)
  if (step !== state.step) {
    if (state.step)
      track.removeClass('pull-a' + state.step)
    state.step = step
    if (step)
      track.addClass('pull-a' + step)
  }
  var ready = offset >= TRIGGER
  if (ready !== !!state.ready) {
    state.ready = ready
    if (ready)
      track.addClass('is-ready')
    else
      track.removeClass('is-ready')
  }
}

function clearAim(track, state) {
  if (state.step)
    track.removeClass('pull-a' + state.step)
  state.step = 0
  state.ready = false
  track.removeClass('is-ready')
  track.removeClass('is-loading')
}

function paint(owner, event, offset) {
  var track = trackOf(owner, event)
  if (!track)
    return false
  var state = owner.getState()
  state.offset = offset
  place(track, offset, 'none')
  aim(track, state, offset)
  return true
}

function restore(owner) {
  var state = owner.getState()
  var track = state.track
  state.phase = 'idle'
  state.offset = 0
  state.pulling = false
  state.tracking = false
  if (!track)
    return
  clearAim(track, state)
  place(track, 0, 'none')
}

function start(event, owner) {
  var state = owner.getState()
  if (state.phase === 'loading' || state.phase === 'closing')
    return
  var touch = event.touches && event.touches[0]
  if (!touch)
    return
  state.tracking = true
  state.anchor = touch.pageY
  state.pulling = false
}

function move(event, owner) {
  var state = owner.getState()
  if (!state.tracking || state.phase === 'loading' || state.phase === 'closing')
    return
  var touch = event.touches && event.touches[0]
  if (!touch)
    return
  var y = touch.pageY
  if ((state.scrollTop || 0) > 2 && !state.pulling) {
    state.anchor = y
    return
  }
  var dy = y - state.anchor
  if (dy <= 0) {
    if (state.pulling)
      paint(owner, event, 0)
    state.pulling = false
    state.anchor = y
    return
  }
  if (!paint(owner, event, damp(dy)))
    return
  state.pulling = true
}

function end(event, owner) {
  var state = owner.getState()
  if (state.phase === 'loading' || state.phase === 'closing')
    return
  if (!state.tracking && !state.pulling)
    return
  var track = trackOf(owner, event)
  if (!track)
    return
  state.tracking = false
  if (!state.pulling)
    return
  state.pulling = false
  var offset = state.offset || 0
  if (offset >= TRIGGER) {
    var from = offset
    state.phase = 'loading'
    state.offset = HOLD
    state.moved = false
    clearAim(track, state)
    track.addClass('is-loading')
    place(track, from, 'none')
    owner.callMethod('onHold')
    afterFrames(owner, track, 2, function () {
      if (owner.getState().phase !== 'loading')
        return
      place(track, from, 'none')
      afterFrames(owner, track, 1, function () {
        if (owner.getState().phase !== 'loading')
          return
        place(track, HOLD, SPRING_HOLD)
        later(owner, track, SETTLE_MS + HOLD_MS, function () {
          springHome(owner, track)
        })
      })
    })
    return
  }
  state.phase = 'closing'
  clearAim(track, state)
  place(track, 0, SPRING)
  later(owner, track, HOME_MS + 40, function () {
    restore(owner)
    owner.callMethod('onDone')
  })
}

function onScroll(event, owner) {
  var top = 0
  if (event && event.detail && event.detail.scrollTop)
    top = event.detail.scrollTop
  var state = owner.getState()
  state.scrollTop = top
  if (top > 16 && !state.moved) {
    state.moved = true
    owner.callMethod('markMoved')
  }
}

function queue(owner, node, fn) {
  if (node && node.requestAnimationFrame) {
    node.requestAnimationFrame(fn)
    return
  }
  if (owner && owner.requestAnimationFrame) {
    owner.requestAnimationFrame(fn)
    return
  }
  fn()
}

function afterFrames(owner, node, count, fn) {
  if (count <= 0) {
    fn()
    return
  }
  queue(owner, node, function () {
    afterFrames(owner, node, count - 1, fn)
  })
}

function later(owner, node, ms, fn) {
  if (!(node && node.requestAnimationFrame) && !(owner && owner.requestAnimationFrame)) {
    fn()
    return
  }
  var start = getDate().getTime()
  function step() {
    if (getDate().getTime() - start >= ms)
      fn()
    else
      queue(owner, node, step)
  }
  queue(owner, node, step)
}

function springHome(owner, track) {
  var state = owner.getState()
  if (state.phase !== 'loading')
    return
  state.phase = 'closing'
  afterFrames(owner, track, 2, function () {
    if (owner.getState().phase !== 'closing')
      return
    place(track, HOLD, 'none')
    afterFrames(owner, track, 1, function () {
      if (owner.getState().phase !== 'closing')
        return
      place(track, 0, SPRING)
      later(owner, track, HOME_MS + 40, function () {
        restore(owner)
        owner.callMethod('onDone')
      })
    })
  })
}

module.exports = {
  start: start,
  move: move,
  end: end,
  onScroll: onScroll
}
</script>

<template>
  <scroll-view
    class="list-scroll h-0 min-h-0 w-full flex-1"
    :style="scrollStyle"
    :show-scrollbar="false"
    :bounces="false"
    :scroll-y="scrollable"
    :lower-threshold="120"
    @touchstart="pull.start"
    @touchmove="pull.move"
    @touchend="pull.end"
    @touchcancel="pull.end"
    @scroll="pull.onScroll"
    @scrolltolower="onLower"
  >
    <view
      class="pull-track"
      data-pull="track"
      @touchstart="pull.start"
      @touchmove="pull.move"
      @touchend="pull.end"
      @touchcancel="pull.end"
    >
      <view class="pull-indicator" :style="{ paddingBottom: cuePad }">
        <view class="pull-kit">
          <view class="pull-arrow">
            <view class="pull-ring">
              <view class="pull-chevron" />
            </view>
          </view>
          <view class="pull-spin">
            <ink-spin />
          </view>
          <text class="pull-copy pull-copy-pull" :class="faceOf('下拉刷新', 'sans')">
            下拉刷新
          </text>
          <text class="pull-copy pull-copy-ready" :class="faceOf('松手刷新', 'sans')">
            松手刷新
          </text>
          <text class="pull-copy pull-copy-load" :class="faceOf('正在刷新', 'sans')">
            正在刷新
          </text>
        </view>
      </view>
      <view class="pull-body box-border pr-28rpx">
        <slot />
        <view v-if="loading" class="flex items-center justify-center gap-16rpx py-32rpx">
          <ink-spin />
          <text class="text-26rpx text-#7a534c" :class="faceOf('正在往下翻', 'sans')">
            正在往下翻
          </text>
        </view>
        <view v-else-if="finished && total > 10" class="flex items-center justify-center py-32rpx">
          <text class="text-26rpx text-#7a534c" :class="faceOf('没有更多了', 'sans')">
            没有更多了
          </text>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<style>
:host {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: calc(100% + 28rpx);
  height: 0;
  min-height: 0;
  margin-right: -28rpx;
  overflow: hidden;
}

.list-scroll {
  background-color: transparent;
}

.pull-track {
  position: relative;
}

.pull-indicator {
  position: absolute;
  top: 0;
  right: 28rpx;
  left: 0;
  height: 180px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
  transform: translateY(-100%);
}

.pull-kit {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.pull-a1 .pull-arrow { transform: rotate(10deg); }
.pull-a2 .pull-arrow { transform: rotate(20deg); }
.pull-a3 .pull-arrow { transform: rotate(30deg); }
.pull-a4 .pull-arrow { transform: rotate(40deg); }
.pull-a5 .pull-arrow { transform: rotate(50deg); }
.pull-a6 .pull-arrow { transform: rotate(60deg); }
.pull-a7 .pull-arrow { transform: rotate(70deg); }
.pull-a8 .pull-arrow { transform: rotate(80deg); }
.pull-a9 .pull-arrow { transform: rotate(90deg); }
.pull-a10 .pull-arrow { transform: rotate(100deg); }
.pull-a11 .pull-arrow { transform: rotate(110deg); }
.pull-a12 .pull-arrow { transform: rotate(120deg); }
.pull-a13 .pull-arrow { transform: rotate(130deg); }
.pull-a14 .pull-arrow { transform: rotate(140deg); }
.pull-a15 .pull-arrow { transform: rotate(150deg); }
.pull-a16 .pull-arrow { transform: rotate(160deg); }
.pull-a17 .pull-arrow { transform: rotate(170deg); }
.pull-a18 .pull-arrow { transform: rotate(180deg); }

.pull-arrow {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
}

.pull-ring {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border: 3rpx solid #792b3e;
  border-radius: 50%;
}

.pull-chevron {
  width: 10rpx;
  height: 10rpx;
  margin-top: -6rpx;
  border-right: 3rpx solid #792b3e;
  border-bottom: 3rpx solid #792b3e;
  transform: rotate(45deg);
}

.pull-spin {
  display: none;
  flex-shrink: 0;
}

.pull-copy {
  display: none;
  font-size: 26rpx;
  line-height: 1;
  color: #7a534c;
}

.pull-copy-pull {
  display: block;
}

.is-ready .pull-copy-pull {
  display: none;
}

.is-ready .pull-copy-ready {
  display: block;
}

.is-loading .pull-arrow,
.is-loading .pull-copy-pull,
.is-loading .pull-copy-ready {
  display: none;
}

.is-loading .pull-spin,
.is-loading .pull-copy-load {
  display: flex;
}

.is-loading .pull-copy-load {
  display: block;
}
</style>
