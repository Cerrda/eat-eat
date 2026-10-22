const CACHE_DIR = `${wx.env.USER_DATA_PATH}/eat-images-v1`
const DOWNLOAD_SLOTS = 3
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'])

const known = new Map<string, string>()
const pending = new Map<string, Promise<string>>()
const waiting: Array<() => void> = []
let running = 0
let generation = 0 // 清理时自增，让清理前发出的下载不再落盘
let dirJob: Promise<boolean> | null = null

function fs() {
  return uni.getFileSystemManager()
}

function hash(value: string) {
  let first = 0x811C9DC5
  let second = 0x9E3779B1
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85EBCA6B)
  }
  return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0')
}

export function imageFileExt(url: string) {
  if (url.includes('format,avif'))
    return 'avif'
  const path = url.split(/[?#]/)[0] || ''
  const match = /\.([a-z0-9]+)$/i.exec(path)
  const ext = match?.[1]?.toLowerCase() || ''
  return IMAGE_EXTS.has(ext) ? ext : 'jpg'
}

function pathOf(key: string, ext: string) {
  return `${CACHE_DIR}/${hash(key)}.${ext}`
}

function fileSize(filePath: string) {
  return new Promise<number>((resolve) => {
    fs().getFileInfo({
      filePath,
      success: result => resolve(Number(result.size) || 0),
      fail: () => resolve(0),
    })
  })
}

function removeFile(filePath: string) {
  return new Promise<void>((resolve) => {
    fs().unlink({
      filePath,
      complete: () => resolve(),
    })
  })
}

function renameFile(oldPath: string, newPath: string) {
  return new Promise<void>((resolve, reject) => {
    fs().rename({
      oldPath,
      newPath,
      success: () => resolve(),
      fail: reject,
    })
  })
}

function ensureDir() {
  dirJob ??= new Promise<boolean>((resolve) => {
    fs().mkdir({
      dirPath: CACHE_DIR,
      recursive: true,
      success: () => resolve(true),
      fail(error) {
        resolve(String(error.errMsg || '').includes('exist'))
      },
    })
  })
  return dirJob
}

function listFiles() {
  return new Promise<string[]>((resolve) => {
    fs().readdir({
      dirPath: CACHE_DIR,
      success: result => resolve((result.files || []).map(String)),
      fail: () => resolve([]),
    })
  })
}

export async function readCachedImage(key: string, ext: string) {
  const hit = known.get(key)
  if (hit)
    return hit
  const filePath = pathOf(key, ext)
  if (await fileSize(filePath) > 0) {
    known.set(key, filePath)
    return filePath
  }
  return ''
}

function download(url: string, filePath: string) {
  return new Promise<void>((resolve, reject) => {
    uni.downloadFile({
      url,
      filePath,
      timeout: 20000,
      success(result) {
        if (result.statusCode === 200)
          resolve()
        else
          reject(new Error(`[image] ${result.statusCode}`))
      },
      fail: reject,
    })
  })
}

function withSlot(job: () => Promise<string>) {
  return new Promise<string>((resolve, reject) => {
    const start = () => {
      running += 1
      job().then(resolve, reject).finally(() => {
        running -= 1
        waiting.shift()?.()
      })
    }
    if (running < DOWNLOAD_SLOTS)
      start()
    else
      waiting.push(start)
  })
}

async function store(key: string, url: string, ext: string, ticket: number) {
  const filePath = pathOf(key, ext)
  if (await fileSize(filePath) > 0) {
    known.set(key, filePath)
    return filePath
  }
  if (!(await ensureDir()) || ticket !== generation)
    return ''
  const partial = `${filePath}.part`
  try {
    await download(url, partial)
    if (ticket !== generation) {
      await removeFile(partial)
      return ''
    }
    try {
      await renameFile(partial, filePath)
    }
    catch {
      const existing = await fileSize(filePath)
      await removeFile(partial)
      if (existing <= 0)
        return ''
    }
    if (ticket !== generation) {
      await removeFile(filePath)
      return ''
    }
    known.set(key, filePath)
    return filePath
  }
  catch {
    await removeFile(partial)
    return ''
  }
}

export function cacheRemoteImage(key: string, url: string, ext: string) {
  if (!url || known.has(key) || pending.has(key))
    return
  const ticket = generation
  const task = withSlot(() => store(key, url, ext, ticket))
    .catch(() => '')
    .finally(() => {
      if (pending.get(key) === task)
        pending.delete(key)
    })
  pending.set(key, task)
}

export async function imageCacheInfo() {
  const names = await listFiles()
  const sizes = await Promise.all(names
    .filter(name => !name.endsWith('.part'))
    .map(name => fileSize(`${CACHE_DIR}/${name}`)))
  let bytes = 0
  let count = 0
  for (const size of sizes) {
    if (size <= 0)
      continue
    bytes += size
    count += 1
  }
  return { bytes, count }
}

export async function clearImageCache() {
  generation += 1
  known.clear()
  const names = await listFiles()
  const sizes = await Promise.all(names.map(async (name) => {
    const filePath = `${CACHE_DIR}/${name}`
    const size = await fileSize(filePath)
    await removeFile(filePath)
    return size
  }))
  return sizes.reduce((sum, size) => sum + size, 0)
}

export function formatCacheSize(bytes: number) {
  if (bytes <= 0)
    return '0 MB'
  if (bytes < 1024 * 1024)
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
