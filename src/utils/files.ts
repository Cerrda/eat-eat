import { EatRequestError } from '@/api/eat'

const URL_CACHE_KEY = 'eat-file-urls-v1'
const URL_TTL = 30 * 60 * 1000
const URL_CACHE_MAX = 240

interface TempFileItem {
  fileID: string
  tempFileURL?: string
}

interface UrlEntry {
  url: string
  until: number
}

const urlCache = new Map<string, UrlEntry>()
let cacheReady = false
let saveTimer: ReturnType<typeof setTimeout> | undefined

function readyCache() {
  if (cacheReady)
    return
  cacheReady = true
  try {
    const stored = uni.getStorageSync(URL_CACHE_KEY) as Record<string, UrlEntry> | ''
    if (!stored || typeof stored !== 'object')
      return
    const now = Date.now()
    for (const [id, entry] of Object.entries(stored)) {
      if (entry && typeof entry.url === 'string' && Number(entry.until) > now)
        urlCache.set(id, { url: entry.url, until: Number(entry.until) })
    }
  }
  catch {
    // 缓存坏了就按没缓存走
  }
}

function cachedUrl(fileId: string) {
  readyCache()
  const entry = urlCache.get(fileId)
  return entry && entry.until > Date.now() ? entry.url : ''
}

function scheduleSave() {
  if (saveTimer)
    return
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    try {
      const now = Date.now()
      for (const [id, entry] of urlCache) {
        if (entry.until <= now)
          urlCache.delete(id)
      }
      while (urlCache.size > URL_CACHE_MAX) {
        const oldest = urlCache.keys().next().value
        if (!oldest)
          break
        urlCache.delete(oldest)
      }
      const rows: Record<string, UrlEntry> = {}
      for (const [id, entry] of urlCache)
        rows[id] = entry
      uni.setStorageSync(URL_CACHE_KEY, rows)
    }
    catch {
      // 写不进去只影响下次启动
    }
  }, 0)
}

/** 按屏幕上的实际占用选一档，避免列表和宫格去拉相机原图。 */
export type CloudImageSize = 'thumb' | 'tile' | 'cover' | 'raw'

const IMAGE_FIT = {
  thumb: { w: 400, q: 65 },
  tile: { w: 600, q: 72 },
  cover: { w: 1280, q: 75 },
} as const

export function fitCloudImageUrl(url: string, size: CloudImageSize = 'thumb') {
  if (size === 'raw' || !/^https?:\/\//.test(url) || url.includes('x-oss-process='))
    return url
  const { w, q } = IMAGE_FIT[size]
  const process = `x-oss-process=image/auto-orient,1/resize,m_lfit,w_${w},limit_1/quality,q_${q}/format,avif`
  return `${url}${url.includes('?') ? '&' : '?'}${process}`
}

export async function primeFileUrls(ids: string[]) {
  readyCache()
  const now = Date.now()
  const missing = [...new Set(ids.filter((id) => {
    if (!id.startsWith('cloud://'))
      return false
    const entry = urlCache.get(id)
    return !entry || entry.until <= now
  }))]
  if (!missing.length)
    return
  try {
    const result = await uniCloud.getTempFileURL({ fileList: missing }) as { fileList?: TempFileItem[] }
    const list = result.fileList || []
    const until = now + URL_TTL
    list.forEach((item, index) => {
      if (!item.tempFileURL)
        return
      const entry = { url: item.tempFileURL, until }
      urlCache.set(item.fileID, entry)
      const asked = missing[index]
      if (asked)
        urlCache.set(asked, entry)
    })
    scheduleSave()
  }
  catch {
    // 封面暂时用菜名代替，不打断列表。
  }
}

export async function resolveFileUrl(fileId?: string, size: CloudImageSize = 'thumb') {
  if (!fileId)
    return ''
  if (/^https?:\/\//.test(fileId) || fileId.startsWith('wxfile://') || fileId.startsWith('blob:') || fileId.startsWith('/'))
    return fileId
  if (!fileId.startsWith('cloud://'))
    return ''
  let raw = cachedUrl(fileId)
  if (!raw) {
    await primeFileUrls([fileId])
    raw = cachedUrl(fileId)
  }
  return raw ? fitCloudImageUrl(raw, size) : ''
}

function rejectChoose(error: unknown, reject: (reason: Error) => void) {
  const message = String((error as { errMsg?: string }).errMsg || '')
  if (message.includes('cancel'))
    reject(new Error('cancel'))
  else
    reject(new EatRequestError('UPLOAD', '没有选到照片'))
}

/** 相册按剩余空位一次多选；微信相册单次最多 9 张。拍照仍是一张。 */
export function chooseImages(source: 'album' | 'camera', count = 1) {
  const limited = Math.min(9, Math.max(1, Math.floor(count)))
  return new Promise<string[]>((resolve, reject) => {
    uni.chooseImage({
      count: limited,
      sizeType: ['compressed'],
      sourceType: [source],
      success(result) {
        const raw = result.tempFilePaths
        const paths = (Array.isArray(raw) ? raw : []).filter(Boolean).slice(0, limited)
        if (paths.length)
          resolve(paths)
        else
          reject(new Error('cancel'))
      },
      fail(error) {
        rejectChoose(error, reject)
      },
    })
  })
}

export function chooseImage(source: 'album' | 'camera') {
  return chooseImages(source, 1).then((paths) => {
    const path = paths[0]
    if (!path)
      throw new Error('cancel')
    return path
  })
}

export function uploadImage(filePath: string, folder: string) {
  const rawExt = filePath.split('.').pop() || 'jpg'
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const cloudPath = `eat/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  return new Promise<string>((resolve, reject) => {
    uniCloud.uploadFile({
      filePath,
      cloudPath,
      success(result) {
        if (result.fileID)
          resolve(result.fileID)
        else
          reject(new EatRequestError('UPLOAD', '这张图没有传上来'))
      },
      fail() {
        reject(new EatRequestError('UPLOAD', '这张图没有传上来'))
      },
    })
  })
}

export function ignoredCancel(err: unknown) {
  return err instanceof Error && err.message === 'cancel'
}
