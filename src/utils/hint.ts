import type { Ref } from 'vue'

interface HintState {
  text: Ref<string>
  seq: Ref<number>
  route: Ref<string>
  timer?: ReturnType<typeof setTimeout>
}

function hintState(): HintState {
  const host = globalThis as typeof globalThis & { __eatHint?: HintState }
  if (!host.__eatHint) {
    host.__eatHint = {
      text: ref(''),
      seq: ref(0),
      route: ref(''),
    }
  }
  return host.__eatHint
}

export function currentPage() {
  return getCurrentPages().slice(-1)[0]
}

export function pageRoute(page?: { route?: string, __route__?: string } | null) {
  return page?.route || page?.__route__ || ''
}

export function useHint() {
  const state = hintState()
  return { hintText: state.text, hintSeq: state.seq, hintRoute: state.route }
}

export function showHint(message: string, duration = 1800) {
  if (!message)
    return
  const state = hintState()
  state.text.value = message
  state.route.value = pageRoute(currentPage())
  state.seq.value += 1
  if (state.timer)
    clearTimeout(state.timer)
  const seq = state.seq.value
  state.timer = setTimeout(() => {
    if (state.seq.value === seq)
      state.seq.value = 0
  }, duration)
}

export function dismissHint() {
  const state = hintState()
  if (state.timer)
    clearTimeout(state.timer)
  state.seq.value = 0
}

export function copyHint(data: string, message: string) {
  uni.setClipboardData({
    data,
    success() {
      uni.hideToast()
      showHint(message)
      setTimeout(() => {
        uni.showToast({ title: '', duration: 0, icon: 'none' })
        uni.hideToast()
      }, 0)
    },
  })
}
