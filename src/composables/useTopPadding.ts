let cached = ''

function readStatusAnchor() {
  const info = uni.getWindowInfo()
  return (info.statusBarHeight ?? 20) + 6
}

function readMenuTop() {
  // #ifdef MP-WEIXIN
  const menu = uni.getMenuButtonBoundingClientRect()
  if (menu.top > 0 && menu.height > 0)
    return menu.top
  // #endif
  return 0
}

/** 胶囊位置一旦量到就固定，页面切换时不再改写 padding。 */
export function primeTopPadding() {
  if (cached)
    return cached
  const menuTop = readMenuTop()
  if (!menuTop)
    return ''
  cached = `${menuTop}px`
  return cached
}

export function useTopPadding() {
  const topPadding = ref(primeTopPadding() || `${readStatusAnchor()}px`)
  if (!cached) {
    onMounted(() => {
      const next = primeTopPadding()
      if (next) {
        topPadding.value = next
        return
      }
      cached = topPadding.value
    })
  }
  return topPadding
}
