<script setup lang="ts">
export interface CoverZoomOrigin {
  left: number
  top: number
  width: number
  height: number
  radius: number
}

const emit = defineEmits<{
  idle: []
}>()

interface Box {
  left: number
  top: number
  width: number
  height: number
}

interface Frame extends Box {
  radius: number
}

interface Point {
  x: number
  y: number
}

interface Finger {
  clientX?: number
  pageX?: number
  x?: number
  clientY?: number
  pageY?: number
  y?: number
}

interface TouchBundle {
  touches?: ArrayLike<Finger>
  changedTouches?: ArrayLike<Finger>
}

const OPEN_MS = 460
const CLOSE_MS = 340
const OPEN_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const CLOSE_EASE = 'cubic-bezier(0.4, 0, 1, 1)'
const SCALE_MIN = 1
const SCALE_MAX = 4
const TAP_SLOP = 12
const TAP_MS = 280

const alive = ref(false)
const phase = ref<'closed' | 'opening' | 'open' | 'closing'>('closed')
const moving = ref(false)
const duration = ref(OPEN_MS)
const curve = ref(OPEN_EASE)
const dim = ref(0)
const src = ref('')
const sharp = ref('')
const sharpOn = ref(false)
const keepSrc = ref<(() => void) | null>(null)
const keepSharp = ref<(() => void) | null>(null)
const screen = ref({ width: 1, height: 1 })
const frame = ref<Frame>({ left: 0, top: 0, width: 1, height: 1, radius: 0 })
const photo = ref<Box>({ left: 0, top: 0, width: 1, height: 1 })
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)

let generation = 0
let ratio = 1
let home: CoverZoomOrigin = { left: 0, top: 0, width: 1, height: 1, radius: 0 }
let rest: Box = { left: 0, top: 0, width: 1, height: 1 }
let mode: 'idle' | 'pending' | 'drift' | 'pan' | 'pinch' = 'idle'
let startPoint: Point | null = null
let startStamp = 0
let panPoint: Point | null = null
let panTx = 0
let panTy = 0
let pinchSpan = 1
let pinchScale = 1
let pinchAnchor = { x: 0.5, y: 0.5 }
const waits: Array<{ timer: ReturnType<typeof setTimeout>, resolve: (ok: boolean) => void }> = []

const stageStyle = computed(() => ({
  width: `${screen.value.width}px`,
  height: `${screen.value.height}px`,
}))

const dimStyle = computed(() => ({
  opacity: String(dim.value),
  transition: moving.value ? `opacity ${duration.value}ms ${curve.value}` : 'none',
}))

const frameStyle = computed(() => {
  const box = frame.value
  const time = `${duration.value}ms ${curve.value}`
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    borderRadius: `${box.radius}px`,
    transition: moving.value
      ? `left ${time}, top ${time}, width ${time}, height ${time}, border-radius ${time}`
      : 'none',
  }
})

const photoStyle = computed(() => {
  const box = photo.value
  const time = `${duration.value}ms ${curve.value}`
  const open = phase.value === 'open'
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    transform: open ? `translate3d(${tx.value}px, ${ty.value}px, 0) scale(${scale.value})` : 'none',
    transformOrigin: 'center center',
    transition: moving.value ? `left ${time}, top ${time}, width ${time}, height ${time}` : 'none',
  }
})

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function safeAspect(value: number) {
  if (!Number.isFinite(value) || value <= 0)
    return 1
  return value
}

function fitPhoto(aspect: number, viewW: number, viewH: number): Box {
  let width = viewW
  let height = width / aspect
  if (height > viewH) {
    height = viewH
    width = height * aspect
  }
  return {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    left: (viewW - width) / 2,
    top: (viewH - height) / 2,
  }
}

function coverPhoto(origin: CoverZoomOrigin, aspect: number): Box {
  let width = origin.width
  let height = width / aspect
  if (height < origin.height) {
    height = origin.height
    width = height * aspect
  }
  return {
    width,
    height,
    left: (origin.width - width) / 2,
    top: (origin.height - height) / 2,
  }
}

function readViewport() {
  const info = uni.getWindowInfo()
  return { width: info.windowWidth, height: info.windowHeight }
}

function wait(ms: number, ticket: number) {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      const index = waits.findIndex(item => item.timer === timer)
      if (index >= 0)
        waits.splice(index, 1)
      resolve(ticket === generation)
    }, ms)
    waits.push({ timer, resolve })
  })
}

function cancelWaits() {
  const pending = waits.splice(0, waits.length)
  for (const item of pending) {
    clearTimeout(item.timer)
    item.resolve(false)
  }
}

async function glide(ticket: number, ms: number, ease: string, apply: () => void) {
  moving.value = false
  await nextTick()
  if (!await wait(40, ticket))
    return false
  duration.value = ms
  curve.value = ease
  moving.value = true
  await nextTick()
  if (!await wait(40, ticket))
    return false
  apply()
  return wait(ms + 48, ticket)
}

function resetGesture() {
  mode = 'idle'
  startPoint = null
  panPoint = null
}

function clearPinch() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

function finish(ticket: number) {
  if (ticket !== generation)
    return
  moving.value = false
  phase.value = 'closed'
  alive.value = false
  emit('idle')
}

function visualBox(): Box {
  const width = rest.width * scale.value
  const height = rest.height * scale.value
  return {
    width,
    height,
    left: rest.left + (rest.width - width) / 2 + tx.value,
    top: rest.top + (rest.height - height) / 2 + ty.value,
  }
}

function clampTranslate(nextScale: number, nextTx: number, nextTy: number) {
  const width = rest.width * nextScale
  const height = rest.height * nextScale
  const baseLeft = rest.left + (rest.width - width) / 2
  const baseTop = rest.top + (rest.height - height) / 2
  let left = baseLeft + nextTx
  let top = baseTop + nextTy
  const viewW = screen.value.width
  const viewH = screen.value.height
  if (width <= viewW)
    left = (viewW - width) / 2
  else
    left = clamp(left, viewW - width, 0)
  if (height <= viewH)
    top = (viewH - height) / 2
  else
    top = clamp(top, viewH - height, 0)
  return { tx: left - baseLeft, ty: top - baseTop }
}

function zoomed() {
  return scale.value > 1.01
}

function readPoints(list?: ArrayLike<Finger>) {
  if (!list)
    return [] as Point[]
  const points: Point[] = []
  for (let index = 0; index < list.length; index += 1) {
    const finger = list[index]
    if (!finger)
      continue
    points.push({
      x: Number(finger.clientX ?? finger.pageX ?? finger.x ?? 0),
      y: Number(finger.clientY ?? finger.pageY ?? finger.y ?? 0),
    })
  }
  return points
}

function span(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function mid(a: Point, b: Point) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function beginPinch(a: Point, b: Point) {
  const focal = mid(a, b)
  const box = visualBox()
  mode = 'pinch'
  pinchSpan = Math.max(span(a, b), 1)
  pinchScale = scale.value
  pinchAnchor = {
    x: box.width > 0 ? (focal.x - box.left) / box.width : 0.5,
    y: box.height > 0 ? (focal.y - box.top) / box.height : 0.5,
  }
}

function applyPinch(a: Point, b: Point) {
  const nextScale = clamp(pinchScale * (span(a, b) / pinchSpan), SCALE_MIN, SCALE_MAX)
  const width = rest.width * nextScale
  const height = rest.height * nextScale
  const focal = mid(a, b)
  const left = focal.x - pinchAnchor.x * width
  const top = focal.y - pinchAnchor.y * height
  const baseLeft = rest.left + (rest.width - width) / 2
  const baseTop = rest.top + (rest.height - height) / 2
  const clamped = clampTranslate(nextScale, left - baseLeft, top - baseTop)
  scale.value = nextScale
  tx.value = clamped.tx
  ty.value = clamped.ty
}

function beginPan(point: Point) {
  if (!zoomed()) {
    mode = 'drift'
    startPoint = point
    return
  }
  mode = 'pan'
  panPoint = point
  panTx = tx.value
  panTy = ty.value
}

function applyPan(point: Point) {
  if (!panPoint)
    return
  const clamped = clampTranslate(scale.value, panTx + point.x - panPoint.x, panTy + point.y - panPoint.y)
  tx.value = clamped.tx
  ty.value = clamped.ty
}

function onTouchStart(event: TouchBundle) {
  if (phase.value !== 'open')
    return
  const points = readPoints(event.touches)
  const first = points[0]
  const second = points[1]
  if (first && second) {
    beginPinch(first, second)
    return
  }
  if (!first)
    return
  mode = 'pending'
  startPoint = first
  startStamp = Date.now()
}

function onTouchMove(event: TouchBundle) {
  if (phase.value !== 'open')
    return
  const points = readPoints(event.touches)
  const first = points[0]
  const second = points[1]
  if (first && second) {
    if (mode !== 'pinch')
      beginPinch(first, second)
    applyPinch(first, second)
    return
  }
  if (!first)
    return
  if (mode === 'pinch') {
    beginPan(first)
    return
  }
  if (!startPoint)
    return
  if (mode === 'pending' && Math.hypot(first.x - startPoint.x, first.y - startPoint.y) > TAP_SLOP) {
    if (zoomed())
      beginPan(first)
    else
      mode = 'drift'
  }
  if (mode === 'pan')
    applyPan(first)
}

function onTouchEnd(event: TouchBundle) {
  if (phase.value !== 'open')
    return
  const points = readPoints(event.touches)
  const first = points[0]
  const second = points[1]
  if (first && second) {
    beginPinch(first, second)
    return
  }
  if (first) {
    beginPan(first)
    return
  }
  const point = readPoints(event.changedTouches)[0]
  const tap = mode === 'pending'
    && !!point
    && !!startPoint
    && Date.now() - startStamp <= TAP_MS
    && Math.hypot(point.x - startPoint.x, point.y - startPoint.y) <= TAP_SLOP
  resetGesture()
  if (tap)
    void close()
}

function onTouchCancel(event: TouchBundle) {
  if (phase.value !== 'open')
    return
  const points = readPoints(event.touches)
  const first = points[0]
  const second = points[1]
  if (first && second) {
    beginPinch(first, second)
    return
  }
  if (first) {
    beginPan(first)
    return
  }
  resetGesture()
}

async function open(payload: {
  src: string
  sharp: string
  aspect: number
  origin: CoverZoomOrigin
  keepSrc?: () => void
  keepSharp?: () => void
}) {
  const ticket = ++generation
  keepSrc.value = payload.keepSrc || null
  keepSharp.value = payload.keepSharp || null
  cancelWaits()
  resetGesture()
  clearPinch()
  const view = readViewport()
  if (!payload.src || view.width < 2 || view.height < 2 || payload.origin.width < 1 || payload.origin.height < 1) {
    alive.value = false
    phase.value = 'closed'
    emit('idle')
    return
  }
  ratio = safeAspect(payload.aspect)
  home = payload.origin
  const fitted = fitPhoto(ratio, view.width, view.height)
  screen.value = view
  src.value = payload.src
  sharp.value = payload.sharp && payload.sharp !== payload.src ? payload.sharp : ''
  sharpOn.value = false
  frame.value = { ...payload.origin }
  photo.value = coverPhoto(payload.origin, ratio)
  dim.value = 0
  alive.value = true
  phase.value = 'opening'
  const arrived = await glide(ticket, OPEN_MS, OPEN_EASE, () => {
    frame.value = {
      left: fitted.left,
      top: fitted.top,
      width: fitted.width,
      height: fitted.height,
      radius: 0,
    }
    photo.value = { left: 0, top: 0, width: fitted.width, height: fitted.height }
    dim.value = 1
  })
  if (!arrived)
    return
  moving.value = false
  rest = { ...fitted }
  frame.value = { left: 0, top: 0, width: view.width, height: view.height, radius: 0 }
  photo.value = { ...fitted }
  phase.value = 'open'
}

async function close() {
  if (phase.value !== 'open')
    return
  const ticket = generation
  const box = visualBox()
  resetGesture()
  clearPinch()
  moving.value = false
  phase.value = 'closing'
  frame.value = { left: box.left, top: box.top, width: box.width, height: box.height, radius: 0 }
  photo.value = { left: 0, top: 0, width: box.width, height: box.height }
  const arrived = await glide(ticket, CLOSE_MS, CLOSE_EASE, () => {
    frame.value = { ...home }
    photo.value = coverPhoto(home, ratio)
    dim.value = 0
  })
  if (!arrived)
    return
  finish(ticket)
}

function shut() {
  if (!alive.value && phase.value === 'closed')
    return
  generation += 1
  cancelWaits()
  resetGesture()
  clearPinch()
  moving.value = false
  phase.value = 'closed'
  alive.value = false
  emit('idle')
}

function onSrcLoad() {
  keepSrc.value?.()
}

function onSharpLoad() {
  keepSharp.value?.()
  sharpOn.value = true
}

function onSharpError() {
  sharp.value = ''
  sharpOn.value = false
}

onUnmounted(() => {
  generation += 1
  cancelWaits()
})

defineExpose({ open, shut })
</script>

<template>
  <root-portal v-if="alive">
    <view class="cover-zoom-stage fixed left-0 top-0 z-30 overflow-hidden" :style="stageStyle">
      <view class="pointer-events-none absolute inset-0 bg-#1c1012" :style="dimStyle" />
      <view class="pointer-events-none absolute overflow-hidden" :style="frameStyle">
        <view class="absolute" :style="photoStyle">
          <image
            class="absolute left-0 top-0 h-full w-full"
            :src="src"
            mode="aspectFit"
            :style="{ opacity: sharpOn ? 0 : 1 }"
            @load="onSrcLoad"
          />
          <image
            v-if="sharp"
            class="absolute left-0 top-0 h-full w-full"
            :src="sharp"
            mode="aspectFit"
            :style="{ opacity: sharpOn ? 1 : 0 }"
            @load="onSharpLoad"
            @error="onSharpError"
          />
        </view>
      </view>
      <view
        class="absolute inset-0"
        style="background-color: rgba(0,0,0,0.012)"
        @touchstart.stop="onTouchStart"
        @touchmove.stop.prevent="onTouchMove"
        @touchend.stop="onTouchEnd"
        @touchcancel.stop="onTouchCancel"
      />
    </view>
  </root-portal>
</template>
