const HOST = 'https://env-00jy6u6u3cps.normal.cloudstatic.cn'
const FONT_DIR = `${wx.env.USER_DATA_PATH}/eat-fonts`

const FACES = [
  {
    family: 'Ma Shan Zheng',
    weight: '400',
    file: 'ma-shan-zheng.woff2',
    url: `${HOST}/eat/fonts/ma-shan-zheng.woff2`,
  },
  {
    family: 'LXGW WenKai',
    weight: '400',
    file: 'lxgw-wenkai.woff2',
    url: `${HOST}/eat/fonts/lxgw-wenkai.woff2`,
  },
  {
    family: 'LXGW WenKai',
    weight: '500',
    file: 'lxgw-wenkai-medium.woff2',
    url: `${HOST}/eat/fonts/lxgw-wenkai-medium.woff2`,
  },
  {
    family: 'Long Cang',
    weight: '400',
    file: 'long-cang.woff2',
    url: `${HOST}/eat/fonts/long-cang.woff2`,
  },
] as const

type Face = typeof FACES[number]

function fs() {
  return uni.getFileSystemManager()
}

function ensureDir(dirPath: string) {
  return new Promise<void>((resolve, reject) => {
    fs().mkdir({
      dirPath,
      recursive: true,
      success: () => resolve(),
      fail(error) {
        const message = String(error.errMsg || '')
        if (message.includes('exist'))
          resolve()
        else
          reject(error)
      },
    })
  })
}

function hasFile(filePath: string) {
  return new Promise<boolean>((resolve) => {
    fs().getFileInfo({
      filePath,
      success: res => resolve(res.size > 0),
      fail: () => resolve(false),
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

function download(url: string, filePath: string) {
  return new Promise<void>((resolve, reject) => {
    uni.downloadFile({
      url,
      filePath,
      success(res) {
        if (res.statusCode === 200) {
          resolve()
          return
        }
        fs().unlink({
          filePath,
          complete: () => reject(new Error(`[font] download ${res.statusCode}`)),
        })
      },
      fail: reject,
    })
  })
}

function readBase64(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    fs().readFile({
      filePath,
      encoding: 'base64',
      success: res => resolve(String(res.data)),
      fail: reject,
    })
  })
}

function register(face: Face, base64: string, global: boolean) {
  return new Promise<void>((resolve, reject) => {
    uni.loadFontFace({
      global,
      family: face.family,
      source: `url("data:font/woff2;charset=utf-8;base64,${base64}")`,
      desc: { style: 'normal', weight: face.weight },
      scopes: ['webview'],
      success: () => resolve(),
      fail: reject,
    })
  })
}

const fileJobs = new Map<string, Promise<string>>()

function readyFile(face: Face) {
  let job = fileJobs.get(face.file)
  if (!job) {
    job = (async () => {
      const filePath = `${FONT_DIR}/${face.file}`
      if (!(await hasFile(filePath)))
        await download(face.url, filePath)
      return filePath
    })().catch((error) => {
      fileJobs.delete(face.file)
      throw error
    })
    fileJobs.set(face.file, job)
  }
  return job
}

async function applyFace(face: Face, global: boolean) {
  const filePath = `${FONT_DIR}/${face.file}`
  const cached = await hasFile(filePath)
  const path = await readyFile(face)
  try {
    await register(face, await readBase64(path), global)
  }
  catch (error) {
    if (!cached)
      throw error
    fileJobs.delete(face.file)
    await removeFile(filePath)
    await download(face.url, filePath)
    fileJobs.set(face.file, Promise.resolve(filePath))
    await register(face, await readBase64(filePath), global)
  }
}

async function applyAll(global: boolean) {
  await Promise.all(FACES.map(async (face) => {
    try {
      await applyFace(face, global)
    }
    catch (error) {
      console.error(`[font] ${face.family} ${face.weight}`, error)
    }
  }))
}

let dirJob: Promise<void> | null = null
let globalJob: Promise<void> | null = null

function readyDir() {
  dirJob ??= ensureDir(FONT_DIR)
  return dirJob
}

export function bootFonts() {
  globalJob ??= (async () => {
    try {
      await readyDir()
      await applyAll(true)
    }
    catch (error) {
      console.error('[font] mkdir', error)
    }
  })()
  return globalJob
}

export async function ensurePageFonts() {
  try {
    await readyDir()
  }
  catch (error) {
    console.error('[font] mkdir', error)
    return
  }
  await applyAll(false)
}

export function waitFontLayout() {
  return new Promise<void>(resolve => setTimeout(resolve, 32))
}
