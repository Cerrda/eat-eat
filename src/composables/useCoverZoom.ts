import type { CoverZoomOrigin } from '@/components/cover-zoom/cover-zoom.vue'
import type { CloudImageSize } from '@/utils/files'
import { cacheDisplayedImage, resolveFileUrl } from '@/utils/files'

export interface CoverZoomRequest {
  id: string
  fileId?: string
  from?: Exclude<CloudImageSize, 'raw'>
  sharp?: CloudImageSize
  /** 白边厚度，量到的是含边框的盒子时用来对齐照片本身。 */
  inset?: number
  /** 照片可见圆角，单位 rpx。 */
  radius?: number
}

export function useCoverZoom(active?: () => boolean) {
  const instance = getCurrentInstance()
  const coverZoom = ref<{
    open: (payload: {
      src: string
      sharp: string
      aspect: number
      origin: CoverZoomOrigin
      keepSrc?: () => void
      keepSharp?: () => void
    }) => void
    shut: () => void
  } | null>(null)
  const heldId = ref('')
  const aspects = new Map<string, number>()
  let token = 0

  function domId(id: string) {
    return `zoom-${id.replace(/[^\w-]/g, '')}`
  }

  function remember(id: string, aspect: number) {
    if (aspect > 0)
      aspects.set(id, aspect)
  }

  function release() {
    heldId.value = ''
  }

  function shut() {
    token += 1
    coverZoom.value?.shut()
  }

  function imageRatio(src: string) {
    return new Promise<number>((resolve) => {
      uni.getImageInfo({
        src,
        success(result) {
          resolve(result.width > 0 && result.height > 0 ? result.width / result.height : 0)
        },
        fail() {
          resolve(0)
        },
      })
    })
  }

  function coverBox(id: string, insetRpx: number, radiusRpx: number) {
    const proxy = instance?.proxy
    if (!proxy)
      return Promise.resolve(null)
    return new Promise<CoverZoomOrigin | null>((resolve) => {
      uni.createSelectorQuery().in(proxy).select(`#${domId(id)}`).boundingClientRect((rect) => {
        const box = rect && !Array.isArray(rect) ? rect : null
        if (!box || !box.width || !box.height || box.left == null || box.top == null) {
          resolve(null)
          return
        }
        const inset = uni.upx2px(insetRpx)
        resolve({
          left: box.left + inset,
          top: box.top + inset,
          width: Math.max(1, box.width - inset * 2),
          height: Math.max(1, box.height - inset * 2),
          radius: uni.upx2px(radiusRpx),
        })
      }).exec()
    })
  }

  async function open(request: CoverZoomRequest) {
    if ((active && !active()) || !request.fileId || !coverZoom.value)
      return
    const current = ++token
    const inset = request.inset ?? 6
    const radius = request.radius ?? 30
    const from = request.from ?? 'thumb'
    const sharpSize = request.sharp ?? 'cover'
    const origin = await coverBox(request.id, inset, radius)
    if (!origin || current !== token || (active && !active()))
      return
    const [src, sharp] = await Promise.all([
      resolveFileUrl(request.fileId, from, false),
      resolveFileUrl(request.fileId, sharpSize, false),
    ])
    if (!src || current !== token || (active && !active()))
      return
    let aspect = aspects.get(request.id) || 0
    if (aspect <= 0)
      aspect = await imageRatio(src)
    if (current !== token || (active && !active()))
      return
    heldId.value = request.id
    void coverZoom.value.open({
      src,
      sharp: sharp && sharp !== src ? sharp : '',
      aspect: aspect > 0 ? aspect : 1,
      origin,
      keepSrc: () => cacheDisplayedImage(request.fileId, from, src),
      keepSharp: () => cacheDisplayedImage(request.fileId, sharpSize, sharp),
    })
  }

  if (active) {
    watch(active, (on) => {
      if (!on)
        shut()
    })
  }

  onHide(shut)

  return { coverZoom, heldId, domId, remember, release, open, shut }
}
