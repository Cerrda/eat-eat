import type { Ref } from 'vue'
import { computed, ref } from 'vue'

const PAGE_SIZE = 10

export function usePaged<T>(source: Ref<T[]>) {
  const page = ref(1)
  const loading = ref(false)
  let token = 0

  const shown = computed(() => source.value.slice(0, page.value * PAGE_SIZE))
  const total = computed(() => source.value.length)
  const finished = computed(() => shown.value.length >= source.value.length)

  function reset() {
    token += 1
    page.value = 1
    loading.value = false
  }

  async function more() {
    if (loading.value || finished.value)
      return
    const id = ++token
    loading.value = true
    await new Promise(resolve => setTimeout(resolve, 280))
    if (id !== token)
      return
    page.value += 1
    loading.value = false
  }

  return { shown, total, finished, loading, reset, more }
}
