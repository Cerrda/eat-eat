function readAnchor() {
  const info = uni.getWindowInfo()
  const statusBar = info.statusBarHeight ?? 20
  let anchor = statusBar + 6
  // #ifdef MP-WEIXIN
  const menu = uni.getMenuButtonBoundingClientRect()
  if (menu.top)
    anchor = menu.top
  // #endif
  return `${anchor}px`
}

export function useTopPadding() {
  const topPadding = ref(readAnchor())

  onMounted(() => {
    const next = readAnchor()
    if (next !== topPadding.value)
      topPadding.value = next
  })

  return topPadding
}
