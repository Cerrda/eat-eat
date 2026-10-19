export type ThemeName = 'light' | 'dark'


const STORAGE_KEY = 'eat-theme'

const LIGHT = {
  '--paper': '#FBF3EA',
  '--cream': '#FFF9F4',
  '--ink': '#3C2428',
  '--muted': '#7A534C',
  '--line': '#C9A297',
  '--rule': '#C9A297',
  '--accent': '#792B3E',
  '--accent-deep': '#4E222D',
  '--accent-busy': '#A24C5C',
  '--wash': '#F6E4DE',
  '--danger': '#9C342C',
  '--booked': '#9C342C',
  '--on-accent': '#FFF9F4',
  '--photo': '#FFF9F4',
  '--scrim': 'rgba(60, 36, 40, 0.45)',
  '--shade-28': 'rgba(78, 34, 45, 0.28)',
  '--shade-35': 'rgba(78, 34, 45, 0.35)',
  '--stamp-shadow': '#4E222D59',
}

const DARK = {
  '--paper': '#1A211C',
  '--cream': '#262E29',
  '--ink': '#F3E6D4',
  '--muted': '#B5A394',
  '--line': '#5C5348',
  '--rule': '#7A6C5C',
  '--accent': '#C6A36A',
  '--accent-deep': '#8A6E3E',
  '--accent-busy': '#8A7048',
  '--wash': '#314038',
  '--danger': '#E07A6A',
  '--booked': '#C6A36A',
  '--on-accent': '#1A211C',
  '--photo': '#3A4640',
  '--scrim': 'rgba(0, 0, 0, 0.45)',
  '--shade-28': 'rgba(0, 0, 0, 0.28)',
  '--shade-35': 'rgba(0, 0, 0, 0.35)',
  '--stamp-shadow': '#00000059',
}

type TokenMap = typeof LIGHT

const ARTS = {
  'paper': ['/static/paper.jpg', '/static/paper-dark.jpg'],
  'pot': ['/static/pot.png', '/static/pot-dark.png'],
  'house': ['/static/house.png', '/static/house-dark.png'],
  'cook-pot': ['/static/cook-pot.png', '/static/cook-pot-dark.png'],
  'cook-seal': ['/static/cook-seal.png', '/static/cook-seal-dark.png'],
  'cook-tomato': ['/static/cook-tomato.png', '/static/cook-tomato-dark.png'],
} as const

export type ArtName = keyof typeof ARTS

function readTheme(): ThemeName {
  try {
    return uni.getStorageSync(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  }
  catch {
    return 'light'
  }
}

export const theme = ref<ThemeName>(readTheme())

export const themeClass = computed(() => theme.value === 'dark' ? 'theme-dark' : '')

export const themeVars = computed(() => {
  const tokens: TokenMap = theme.value === 'dark' ? DARK : LIGHT
  return Object.entries(tokens).map(([key, value]) => `${key}:${value}`).join(';')
})

export const pageStyle = computed(() => {
  const tokens: TokenMap = theme.value === 'dark' ? DARK : LIGHT
  return `${themeVars.value};background-color:${tokens['--paper']}`
})

export function art(name: ArtName) {
  return ARTS[name][theme.value === 'dark' ? 1 : 0]
}

export function applyChrome() {
  const backgroundColor = theme.value === 'dark' ? DARK['--paper'] : LIGHT['--paper']
  const frontColor = theme.value === 'dark' ? '#ffffff' : '#000000'
  try {
    uni.setNavigationBarColor({ frontColor, backgroundColor })
  }
  catch {
    // 页面还没挂上导航栏时忽略
  }
  try {
    uni.setBackgroundColor({
      backgroundColor,
      backgroundColorTop: backgroundColor,
      backgroundColorBottom: backgroundColor,
    })
  }
  catch {
    // 同上
  }
}

export function setTheme(next: ThemeName) {
  if (theme.value === next)
    return
  theme.value = next
  try {
    uni.setStorageSync(STORAGE_KEY, next)
  }
  catch {
    // 存储失败时这次会话里仍然切换
  }
  applyChrome()
}
