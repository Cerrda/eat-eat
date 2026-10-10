const HOST = 'https://env-00jy6u6u3cps-static.normal.cloudstatic.cn'

const FACES = [
  {
    family: 'Ma Shan Zheng',
    weight: '400',
    url: `${HOST}/eat/fonts/ma-shan-zheng.woff2`,
  },
  {
    family: 'LXGW WenKai',
    weight: '400',
    url: `${HOST}/eat/fonts/lxgw-wenkai.woff2`,
  },
  {
    family: 'LXGW WenKai',
    weight: '500',
    url: `${HOST}/eat/fonts/lxgw-wenkai-medium.woff2`,
  },
  {
    family: 'Long Cang',
    weight: '400',
    url: `${HOST}/eat/fonts/long-cang.woff2`,
  },
] as const

function loadFace(family: string, url: string, weight: '400' | '500') {
  uni.loadFontFace({
    global: true,
    family,
    source: `url("${url}")`,
    desc: { style: 'normal', weight },
    scopes: ['webview', 'native'],
    fail: (error) => {
      console.error(`[font] ${family} ${weight}`, error)
    },
  })
}

export function bootFonts() {
  // for (const face of FACES)
  //   loadFace(face.family, face.url, face.weight)
}
