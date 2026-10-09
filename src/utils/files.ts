import { EatRequestError } from '@/api/eat'
import { ask } from '@/utils/ui'

const urlCache = new Map<string, string>()

interface TempFileItem {
  fileID: string
  tempFileURL?: string
}

export async function primeFileUrls(ids: string[]) {
  const missing = [...new Set(ids.filter(id => id.startsWith('cloud://') && !urlCache.has(id)))]
  if (!missing.length)
    return
  try {
    const result = await uniCloud.getTempFileURL({ fileList: missing }) as { fileList?: TempFileItem[] }
    const list = result.fileList || []
    list.forEach((item, index) => {
      if (!item.tempFileURL)
        return
      urlCache.set(item.fileID, item.tempFileURL)
      const asked = missing[index]
      if (asked)
        urlCache.set(asked, item.tempFileURL)
    })
  }
  catch {
    // 封面暂时用菜名代替，不打断列表。
  }
}

export async function resolveFileUrl(fileId?: string) {
  if (!fileId)
    return ''
  if (/^https?:\/\//.test(fileId) || fileId.startsWith('wxfile://') || fileId.startsWith('blob:') || fileId.startsWith('/'))
    return fileId
  if (!fileId.startsWith('cloud://'))
    return ''
  const cached = urlCache.get(fileId)
  if (cached)
    return cached
  await primeFileUrls([fileId])
  return urlCache.get(fileId) || ''
}

export function chooseImage(source: 'album' | 'camera') {
  return new Promise<string>((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: [source],
      success(result) {
        const path = result.tempFilePaths[0]
        if (path)
          resolve(path)
        else
          reject(new Error('cancel'))
      },
      fail(error) {
        const message = String((error as { errMsg?: string }).errMsg || '')
        if (message.includes('cancel'))
          reject(new Error('cancel'))
        else
          reject(new EatRequestError('UPLOAD', '没有选到照片'))
      },
    })
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
