<script setup lang="ts">
const props = defineProps<{
  label?: string
}>()

const cid = `eat-pot-${Math.random().toString(36).slice(2)}`
const instance = getCurrentInstance()
const boxHeight = ref(0)
let stop = false
let frameId = 0

const VW = 112.81
const VH = 89.72

function addPath(ctx: CanvasRenderingContext2D, d: string) {
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+/g) || []
  let i = 0
  const n = () => Number(tokens[i++])
  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (cmd === 'M')
      ctx.moveTo(n(), n())
    else if (cmd === 'C')
      ctx.bezierCurveTo(n(), n(), n(), n(), n(), n())
    else if (cmd === 'Z')
      ctx.closePath()
  }
}

function trace(ctx: CanvasRenderingContext2D, d: string) {
  ctx.beginPath()
  addPath(ctx, d)
}

function oval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function neck(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  ctx.fill()
}

function paint(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#8A2238'
  trace(ctx, 'M12.9 39.58C4.55 41.21 2 49.1 6.41 53.5C10.35 57.45 16.62 55.36 19.4 51.65C20.1 46.78 19.63 42.83 18.01 40.05C17.08 39.82 14.99 39.58 12.9 39.58Z')
  ctx.fill()
  trace(ctx, 'M99.9 39.58C108.26 41.21 110.81 49.1 106.4 53.5C102.46 57.45 96.19 55.36 93.41 51.65C92.71 46.78 93.18 42.83 94.8 40.05C95.73 39.82 97.82 39.58 99.9 39.58Z')
  ctx.fill()
  trace(ctx, 'M26.24 36.68C24.85 36.68 14.64 45.04 14.64 60.46C14.64 78.44 31.46 87.72 56.4 87.72C81.34 87.72 98.16 78.44 98.16 60.46C98.16 45.04 87.96 36.68 86.56 36.68C78.21 45.27 34.6 45.27 26.24 36.68Z')
  ctx.fill()

  ctx.save()
  ctx.globalAlpha = 0.46 * 0.55
  ctx.strokeStyle = '#572029'
  ctx.lineWidth = 1.62
  ctx.lineCap = 'round'
  trace(ctx, 'M28.56 45.96C37.84 53.16 74.96 53.16 84.24 45.96')
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = '#4E222D'
  oval(ctx, 56.4, 34.36, 38.28, 12.18)
  ctx.fillStyle = '#792B3E'
  oval(ctx, 56.4, 30.3, 35.96, 10.44)
  ctx.fillStyle = '#4E222D'
  neck(ctx, 53.15, 11.16, 6.5, 12.76, 2.55)
  ctx.fillStyle = '#792B3E'
  oval(ctx, 56.4, 8.26, 6.26, 6.26)
  ctx.fillStyle = '#FFEAD7'
  oval(ctx, 54.55, 6.52, 1.57, 1.57)

  ctx.strokeStyle = '#FFEAD7'
  ctx.lineCap = 'round'
  ctx.lineWidth = 2.49
  trace(ctx, 'M39 52.92C38.31 60.46 40.4 66.26 44.11 69.4')
  ctx.stroke()
  ctx.save()
  ctx.globalAlpha = 0.46 * 0.9
  ctx.lineWidth = 1.68
  trace(ctx, 'M42.48 25.66C47.36 23.11 55.48 21.95 63.83 23.81')
  ctx.stroke()
  ctx.restore()
}

interface VueNode {
  $?: { type?: { __name?: string, name?: string }, props?: { dock?: boolean } }
  $props?: { dock?: boolean }
  $children?: VueNode[]
}

function paperChrome(node?: VueNode): { dock: boolean } | null {
  if (!node)
    return null
  const name = node.$?.type?.__name || node.$?.type?.name
  if (name === 'paper-page')
    return { dock: !!(node.$?.props?.dock ?? node.$props?.dock) }
  for (const child of node.$children || []) {
    const found = paperChrome(child)
    if (found)
      return found
  }
  return null
}

function placeBox(attempt = 0, wait = 0) {
  const proxy = instance?.proxy
  if (stop || !proxy)
    return
  uni.createSelectorQuery()
    .in(proxy)
    .select('.eat-load')
    .boundingClientRect()
    .exec((res) => {
      const rect = res?.[0] as { top?: number, height?: number } | undefined
      if (!rect || rect.top == null || (rect.height || 0) < 8) {
        if (wait < 8 && !stop)
          setTimeout(() => placeBox(attempt, wait + 1), 60)
        return
      }
      const info = uni.getWindowInfo()
      const safe = info.safeAreaInsets?.bottom
        ?? (info.safeArea ? Math.max(info.screenHeight - info.safeArea.bottom, 0) : 0)
      const page = getCurrentPages().slice(-1)[0] as { $vm?: VueNode } | undefined
      const paper = paperChrome(page?.$vm)
      const bottom = paper
        ? uni.upx2px(paper.dock ? 184 : 64) + safe
        : safe
      boxHeight.value = Math.max(info.windowHeight - rect.top - bottom, uni.upx2px(160))
      if (attempt < 4 && !stop)
        setTimeout(() => placeBox(attempt + 1), 160)
    })
}

function mountCanvas(attempt = 0) {
  if (stop || !instance)
    return
  uni.createSelectorQuery()
    .in(instance.proxy)
    .select(`#${cid}`)
    .fields({ node: true, size: true })
    .exec((res) => {
      const box = res?.[0] as { node?: HTMLCanvasElement & { requestAnimationFrame?: (cb: () => void) => number, cancelAnimationFrame?: (id: number) => void }, width?: number, height?: number } | undefined
      const canvas = box?.node
      const cssW = box?.width || 0
      const cssH = box?.height || 0
      if (!canvas || cssW < 2 || cssH < 2) {
        if (attempt < 8 && !stop)
          setTimeout(() => mountCanvas(attempt + 1), 60)
        return
      }
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null
      if (!ctx)
        return
      const dpr = uni.getSystemInfoSync().pixelRatio || 1
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
      const started = Date.now()
      const draw = () => {
        if (stop)
          return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, cssW, cssH)
        ctx.save()
        ctx.scale(cssW / VW, cssH / VH)
        ctx.globalAlpha = 0.46
        paint(ctx)
        ctx.restore()
        const t = ((Date.now() - started) % 2200) / 2200
        const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
        const band = cssW * 0.62
        const x = -band + eased * (cssW + band)
        const shine = ctx.createLinearGradient(x, 0, x + band, cssH)
        shine.addColorStop(0, 'rgba(255,246,238,0.02)')
        shine.addColorStop(0.5, 'rgba(255,246,238,0.5)')
        shine.addColorStop(1, 'rgba(255,246,238,0.02)')
        ctx.save()
        ctx.globalCompositeOperation = 'source-atop'
        ctx.fillStyle = shine
        ctx.fillRect(0, 0, cssW, cssH)
        ctx.restore()
        frameId = setTimeout(draw, 32) as unknown as number
      }
      draw()
    })
}

onMounted(() => {
  nextTick(() => {
    if (stop)
      return
    placeBox()
    mountCanvas()
  })
})

onBeforeUnmount(() => {
  stop = true
  clearTimeout(frameId)
})
</script>

<template>
  <view class="eat-load flex shrink-0 items-center justify-center" :style="boxHeight ? { height: `${boxHeight}px` } : undefined" :aria-label="props.label || '加载中'">
    <canvas :id="cid" type="2d" class="eat-pot" style="width: 156rpx; height: 124rpx" />
  </view>
</template>

<style>
.eat-pot {
  width: 156rpx;
  height: 124rpx;
}
</style>
