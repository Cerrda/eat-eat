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

function register(face: Face, base64: string) {
  return new Promise<void>((resolve, reject) => {
    uni.loadFontFace({
      global: true,
      family: face.family,
      source: `url("data:font/woff2;charset=utf-8;base64,${base64}")`,
      desc: { style: 'normal', weight: face.weight },
      scopes: ['webview'],
      success: () => resolve(),
      fail: reject,
    })
  })
}

async function useLocal(face: Face, filePath: string) {
  await register(face, await readBase64(filePath))
}

async function bootFace(face: Face) {
  const filePath = `${FONT_DIR}/${face.file}`
  const cached = await hasFile(filePath)
  if (!cached)
    await download(face.url, filePath)
  try {
    await useLocal(face, filePath)
  }
  catch (error) {
    if (!cached)
      throw error
    await removeFile(filePath)
    await download(face.url, filePath)
    await useLocal(face, filePath)
  }

}

export async function bootFonts() {
  try {
    await ensureDir(FONT_DIR)
    await Promise.all(FACES.map(async (face) => {
      try {
        await bootFace(face)
      }
      catch (error) {
        console.error(`[font] ${face.family} ${face.weight}`, error)
      }
    }))
  }
  catch (error) {
    console.error('[font] mkdir', error)
  }
}
