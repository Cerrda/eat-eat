import { computed, ref, shallowRef } from 'vue'

// 与云函数默认页大小一致。补页时按这个边界把目标菜所在的那一页取整。
export const LIST_PAGE_SIZE = 10

export interface PageResult<T> {
  rows: T[]
  total: number
}

function counted<T>(result: PageResult<T>) {
  return typeof result.total === 'number' && Number.isFinite(result.total)
    ? result.total
    : result.rows.length
}

export function usePaged<T>(load: (page: number) => Promise<PageResult<T>>) {
  const shown = shallowRef<T[]>([])
  const total = ref(0)
  const page = ref(0)
  const loading = ref(false)
  const ended = ref(false)
  const finished = computed(() => ended.value || (page.value > 0 && shown.value.length >= total.value))
  let token = 0
  let queue: Promise<void> = Promise.resolve()

  function occupy<R>(work: () => Promise<R>) {
    const run = queue.then(work, work)
    queue = run.then(() => undefined, () => undefined)
    return run
  }

  function reset() {
    return occupy(async () => {
      const id = ++token
      loading.value = false
      const result = await load(1)
      if (id !== token)
        return
      shown.value = result.rows
      total.value = counted(result)
      page.value = 1
      ended.value = result.rows.length === 0 || shown.value.length >= total.value
    })
  }

  function more() {
    return occupy(async () => {
      if (loading.value || page.value < 1 || finished.value)
        return
      const id = ++token
      const next = page.value + 1
      loading.value = true
      try {
        const result = await load(next)
        if (id !== token)
          return
        if (!result.rows.length || result.rows.length < LIST_PAGE_SIZE) {
          shown.value = [...shown.value, ...result.rows]
          total.value = shown.value.length
          page.value = next
          ended.value = true
          return
        }
        shown.value = [...shown.value, ...result.rows]
        total.value = counted(result)
        page.value = next
        ended.value = shown.value.length >= total.value
      }
      finally {
        if (id === token)
          loading.value = false
      }
    })
  }

  // span 返回从当前列表末尾再取多少条。调用方应按 LIST_PAGE_SIZE 对齐，或一次取到列表尽头。
  function extend(span: (loaded: number) => number, pull: (offset: number, pageSize: number) => Promise<PageResult<T>>) {
    return occupy(async () => {
      if (page.value < 1 || finished.value)
        return false
      const offset = shown.value.length
      const pageSize = span(offset)
      if (pageSize < 1)
        return false
      const id = ++token
      loading.value = true
      try {
        const result = await pull(offset, pageSize)
        if (id !== token)
          return false
        const merged = [...shown.value, ...result.rows]
        shown.value = merged
        total.value = counted(result)
        page.value = Math.max(1, Math.ceil(merged.length / LIST_PAGE_SIZE))
        ended.value = result.rows.length === 0 || merged.length >= total.value
        return true
      }
      finally {
        if (id === token)
          loading.value = false
      }
    })
  }

  return { shown, total, finished, loading, reset, more, extend }
}
