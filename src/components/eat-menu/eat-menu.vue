<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import type { Category, MealBoard, MenuDish, MenuName, OrderDetail, Slot } from '@/api/eat'
import { dateLabel, getOrder, listCategories, listMenu, listMenuNames, mealBoard, SLOT_LABEL } from '@/api/eat'
import { LIST_PAGE_SIZE, usePaged } from '@/composables/usePaged'
import { ensureAccount } from '@/utils/account'
import { menuIntent, orderDraft } from '@/utils/draft'
import { primeFileUrls } from '@/utils/files'
import { keepOneLine, monthDay } from '@/utils/format'
import { showHint } from '@/utils/hint'
import { markTabFresh, menuPanePose } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const props = defineProps<{
  active?: boolean
}>()

const instance = getCurrentInstance()
let leftPage = false

const slots: Slot[] = ['morning', 'noon', 'evening']
const slotShort: Record<Slot, string> = { morning: '早', noon: '中', evening: '晚' }

const board = ref<MealBoard | null>(null)
const menuTotal = ref(0)
const names = ref<MenuName[]>([])
const categories = ref<Category[]>([])
const keyword = ref('')
keepOneLine(keyword)
const categoryId = ref('')
const date = ref('')
const slot = ref<Slot>('morning')
interface TrayItem {
  key: string
  dish: MenuDish
  rolled: boolean
}

const tray = ref<TrayItem[]>([])
let traySerial = 0
const picked = computed(() => tray.value.map(item => item.dish))

function trayKey() {
  traySerial += 1
  return `t${traySerial}`
}

function pushTray(dishes: MenuDish[], rolled = false) {
  if (!dishes.length)
    return
  tray.value = [
    ...tray.value,
    ...dishes.map(dish => ({ key: trayKey(), dish, rolled })),
  ]
}
const wishCount = ref(2)
const roundOn = ref(false)
const roundIds = ref<string[]>([])
const keptIds = ref<string[]>([])
const freshIds = ref<string[]>([])
const rolling = ref(false)
const intoView = ref('')
const tadaId = ref('')
const scroller = ref<{
  readFrame: () => Promise<{ scrollTop: number, scrollHeight: number, height: number } | null>
  scrollTo: (top: number) => void
} | null>(null)
let focusToken = 0
let tadaTimer: ReturnType<typeof setTimeout> | undefined
const activeOrder = ref<OrderDetail | null>(null)
const pulling = ref(false)
let spin = 0
let rollTimer: ReturnType<typeof setTimeout> | undefined
let rollToken = 0
const ROLL_MS = 680

function absorb(rows: MenuDish[]) {
  if (!rows.length || !tray.value.length)
    return
  const byId = new Map(rows.map(dish => [dish.dishId, dish]))
  let changed = false
  const next = tray.value.map((item) => {
    const dish = byId.get(item.dish.dishId)
    if (!dish)
      return item
    if (
      dish.name === item.dish.name
      && dish.coverFileId === item.dish.coverFileId
      && dish.categoryId === item.dish.categoryId
      && dish.categoryName === item.dish.categoryName
    ) {
      return item
    }
    changed = true
    return { ...item, dish }
  })
  if (changed)
    tray.value = next
}

const { shown, total, finished, loading, reset, more, extend } = usePaged(async (page) => {
  const menu = await listMenu({
    page,
    keyword: keyword.value.trim(),
    categoryId: categoryId.value,
  })
  menuTotal.value = typeof menu.menuTotal === 'number' ? menu.menuTotal : menu.dishes.length
  await primeFileUrls(menu.dishes.map(dish => dish.coverFileId))
  absorb(menu.dishes)
  return { rows: menu.dishes, total: menu.total }
})
const bareEmpty = computed(() => Boolean(board.value) && menuTotal.value === 0 && !keyword.value.trim() && !categoryId.value)

const selectedBusy = computed(() => {
  if (!board.value)
    return null
  return board.value.busy.find(item => item.date === date.value && item.slot === slot.value) || null
})

onMounted(() => {
  void refresh()
})

let filterTimer: ReturnType<typeof setTimeout> | undefined

function reloadList(wait = 0) {
  if (filterTimer)
    clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    filterTimer = undefined
    void reset().catch(err => showError(err))
  }, wait)
}

function cancelReload() {
  if (!filterTimer)
    return
  clearTimeout(filterTimer)
  filterTimer = undefined
}

watch(keyword, () => {
  reloadList(280)
})

watch(categoryId, () => {
  reloadList(0)
})

function forgetMissing(ids: string[]) {
  const alive = new Set(ids)
  for (const dish of [...picked.value]) {
    if (!alive.has(dish.dishId))
      beginLeave(dish.dishId)
  }
  roundIds.value = roundIds.value.filter(id => alive.has(id))
  keptIds.value = keptIds.value.filter(id => roundIds.value.includes(id))
  freshIds.value = freshIds.value.filter(id => roundIds.value.includes(id))
  if (roundOn.value && roundIds.value.length === 0)
    endRound()
  fitWish()
}

watch(menuTotal, (total, prev) => {
  if (total !== prev && names.value.length !== total)
    names.value = []
  if (total === 0)
    forgetMissing([])
})

const randomRoom = computed(() => Math.max(menuTotal.value - picked.value.length, 0))
const openIds = computed(() => roundIds.value.filter(id => !keptIds.value.includes(id)))
const rollSealed = computed(() => roundOn.value && !rolling.value && keptIds.value.length >= wishCount.value)

function fitWish() {
  if (roundOn.value)
    return
  const room = randomRoom.value
  if (room < 1)
    return
  if (wishCount.value > room)
    wishCount.value = room
}

watch(randomRoom, () => {
  fitWish()
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view || id !== spin)
      return
    cancelReload()
    const [cats, meal] = await Promise.all([
      listCategories(),
      mealBoard(),
      reset(),
    ])
    if (id !== spin)
      return
    categories.value = cats.categories
    board.value = meal
    ensureSelection()
    markTabFresh('menu')
  }
  catch (err) {
    if (id === spin)
      showError(err)
  }
}

async function onPull() {
  if (pulling.value)
    return
  pulling.value = true
  try {
    await refresh()
  }
  finally {
    pulling.value = false
  }
}

function busyOf(day: string, meal: Slot) {
  return board.value?.busy.find(item => item.date === day && item.slot === meal) || null
}

function ensureSelection() {
  if (!board.value)
    return
  if (menuIntent.date && menuIntent.slot) {
    const nextDate = menuIntent.date
    const nextSlot = menuIntent.slot
    menuIntent.date = ''
    menuIntent.slot = ''
    void selectSlot(nextDate, nextSlot)
    return
  }
  if (date.value) {
    void selectSlot(date.value, slot.value)
    return
  }
  for (const day of board.value.dates) {
    for (const meal of slots) {
      if (!busyOf(day.date, meal)) {
        date.value = day.date
        slot.value = meal
        return
      }
    }
  }
  const first = board.value.dates[0]
  if (first)
    void selectSlot(first.date, 'morning')
}

async function selectSlot(day: string, meal: Slot) {
  const changed = date.value !== day || slot.value !== meal
  if (changed && pillReady.value)
    animateNext = true
  if (changed)
    endRound()
  date.value = day
  slot.value = meal
  const busy = busyOf(day, meal)
  if (!busy) {
    activeOrder.value = null
    return
  }
  clearTray()
  endRound()
  try {
    activeOrder.value = await getOrder(busy.orderId)
  }
  catch (err) {
    showError(err)
  }
}

function pickCategory(id: string) {
  categoryId.value = id
}

function chosen(id: string) {
  return picked.value.some(dish => dish.dishId === id)
}

function inOrder(id: string) {
  return activeOrder.value?.items.some(item => item.dishId === id) || false
}

function toggle(dish: MenuDish) {
  if (selectedBusy.value || rolling.value || roundIds.value.includes(dish.dishId))
    return
  const index = picked.value.findIndex(item => item.dishId === dish.dishId)
  if (index >= 0) {
    beginLeave(dish.dishId)
    return
  }
  pushTray([dish])
}

function endRound() {
  rollToken += 1
  rolling.value = false
  if (rollTimer)
    clearTimeout(rollTimer)
  rollTimer = undefined
  roundOn.value = false
  againMark.value = 1
  roundIds.value = []
  keptIds.value = []
  freshIds.value = []
}

async function ensureNames() {
  if (menuTotal.value > 0 && names.value.length >= menuTotal.value)
    return
  const listed = await listMenuNames()
  menuTotal.value = listed.names.length
  names.value = listed.names
  forgetMissing(names.value.map(item => item.dishId))
}

function dishFromName(item: MenuName): MenuDish {
  const loaded = shown.value.find(dish => dish.dishId === item.dishId)
  if (loaded)
    return loaded
  return {
    dishId: item.dishId,
    name: item.name,
    categoryId: '',
    categoryName: '',
    coverFileId: item.coverFileId,
  }
}

function drawDishes(count: number, exclude: Set<string>) {
  const bag = names.value.filter(dish => !exclude.has(dish.dishId))
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const left = bag[index]
    const right = bag[swap]
    if (!left || !right)
      continue
    bag[index] = right
    bag[swap] = left
  }
  return bag.slice(0, count).map(dishFromName)
}

function afterRoll(apply: () => void) {
  const token = ++rollToken
  rolling.value = true
  if (rollTimer)
    clearTimeout(rollTimer)
  rollTimer = setTimeout(() => {
    rollTimer = undefined
    if (token !== rollToken)
      return
    apply()
    rolling.value = false
  }, ROLL_MS)
}

function dishesFor(open: string[], drawn: MenuDish[]) {
  const nextDish = new Map<string, MenuDish>()
  open.forEach((id, index) => {
    const dish = drawn[index]
    if (dish)
      nextDish.set(id, dish)
  })
  return nextDish
}

function planRenames(open: string[], drawn: MenuDish[]) {
  const nextDish = dishesFor(open, drawn)
  const plans: { key: string, from: string, to: string }[] = []
  for (const item of tray.value) {
    const dish = nextDish.get(item.dish.dishId)
    if (!dish || dish.dishId === item.dish.dishId)
      continue
    plans.push({ key: item.key, from: item.dish.name, to: dish.name })
  }
  return plans
}

function swapOpen(open: string[], drawn: MenuDish[]) {
  const nextDish = dishesFor(open, drawn)
  const fresh: string[] = []
  const applied = new Set<string>()
  const spans = nameSpans
  nameSpans = new Map()
  tray.value = tray.value.map((item) => {
    const dish = nextDish.get(item.dish.dishId)
    if (!dish)
      return item
    applied.add(item.dish.dishId)
    if (dish.dishId === item.dish.dishId)
      return item
    playName(item.key, item.dish.name, spans.get(item.key))
    fresh.push(dish.dishId)
    return { ...item, dish }
  })
  const missing = open.filter(id => !applied.has(id))
  pushTray(missing.flatMap((id) => {
    const dish = nextDish.get(id)
    return dish ? [dish] : []
  }), true)
  roundIds.value = roundIds.value.map(id => nextDish.get(id)?.dishId ?? id)
  freshIds.value = fresh
}

function applyRoll(open: string[], drawn: MenuDish[]) {
  const replacements = drawn.slice(0, open.length)
  const extras = drawn.slice(open.length)
  swapOpen(open, replacements)
  if (!extras.length)
    return
  pushTray(extras, true)
  const extraIds = extras.map(dish => dish.dishId)
  roundIds.value = [...roundIds.value, ...extraIds]
  freshIds.value = [...freshIds.value, ...extraIds]
}

function bumpWish(step: number) {
  if (roundOn.value || rolling.value)
    return
  const next = wishCount.value + step
  if (next < 1 || next > randomRoom.value)
    return
  wishCount.value = next
}

async function beginRound() {
  if (roundOn.value || rolling.value || selectedBusy.value)
    return
  rolling.value = true
  try {
    await ensureNames()
  }
  catch (err) {
    rolling.value = false
    showError(err)
    return
  }
  const exclude = new Set(picked.value.map(dish => dish.dishId))
  const drawn = drawDishes(wishCount.value, exclude)
  if (drawn.length < wishCount.value) {
    rolling.value = false
    showHint(drawn.length ? '没有那么多可以随便的菜' : '菜单上的菜都加上了')
    return
  }
  againMark.value = 1
  roundOn.value = true
  afterRoll(() => {
    pushTray(drawn, true)
    roundIds.value = drawn.map(dish => dish.dishId)
    keptIds.value = []
    freshIds.value = []
  })
}

async function rollAgain() {
  if (!roundOn.value || rolling.value || rollSealed.value)
    return
  const open = openIds.value
  const need = wishCount.value - keptIds.value.length
  if (need < 1)
    return
  rolling.value = true
  try {
    await ensureNames()
  }
  catch (err) {
    rolling.value = false
    showError(err)
    return
  }
  const exclude = new Set(picked.value.map(dish => dish.dishId))
  const drawn = drawDishes(need, exclude)
  if (!drawn.length) {
    rolling.value = false
    showHint('没有别的菜可以换了')
    return
  }
  if (againMark.value < 99)
    againMark.value += 1
  const ready = primeRenames(planRenames(open, drawn.slice(0, open.length)))
  afterRoll(() => {
    void ready.then(() => {
      if (leftPage)
        return
      applyRoll(open, drawn)
    })
  })
}

function toggleKeep(id: string) {
  if (rolling.value || !roundIds.value.includes(id))
    return
  const index = keptIds.value.indexOf(id)
  if (index >= 0)
    keptIds.value.splice(index, 1)
  else
    keptIds.value.push(id)
}

function dropDish(id: string) {
  if (selectedBusy.value || rolling.value)
    return
  beginLeave(id)
}

function dishKey(id: string) {
  return `dish-${id.replace(/[^A-Za-z0-9_-]/g, '')}`
}

function nodeBox(selector: string) {
  const proxy = instance?.proxy
  if (!proxy)
    return Promise.resolve(null)
  return new Promise<{ top: number, height: number } | null>((resolve) => {
    uni.createSelectorQuery().in(proxy).select(selector).boundingClientRect((rect) => {
      const box = rect && !Array.isArray(rect) ? rect : null
      resolve(box && box.height ? { top: box.top, height: box.height } : null)
    }).exec()
  })
}

function playTada(id: string, wait: number, token: number) {
  if (tadaTimer)
    clearTimeout(tadaTimer)
  tadaId.value = ''
  tadaTimer = setTimeout(() => {
    tadaTimer = undefined
    if (token !== focusToken || leftPage)
      return
    tadaId.value = id
  }, wait)
}

async function onMore() {
  try {
    await more()
  }
  catch (err) {
    showError(err)
  }
}

function locateOpen() {
  return !keyword.value.trim() && !categoryId.value && !filterTimer
}

function fillSpan(loaded: number, dishId: string) {
  const index = names.value.findIndex(item => item.dishId === dishId)
  if (index < 0 || index < loaded)
    return 0
  const end = Math.ceil((index + 1) / LIST_PAGE_SIZE) * LIST_PAGE_SIZE
  return end - loaded
}

async function pullWindow(offset: number, pageSize: number) {
  const menu = await listMenu({ offset, pageSize })
  menuTotal.value = typeof menu.menuTotal === 'number' ? menu.menuTotal : menu.total
  await primeFileUrls(menu.dishes.map(dish => dish.coverFileId))
  absorb(menu.dishes)
  return { rows: menu.dishes, total: menu.total }
}

async function focusDish(id: string) {
  if (!locateOpen())
    return
  const token = ++focusToken
  if (!picked.value.some(item => item.dishId === id))
    return
  try {
    await ensureNames()
    if (token !== focusToken || leftPage)
      return
    if (!shown.value.some(item => item.dishId === id)) {
      await extend(loaded => fillSpan(loaded, id), pullWindow)
      if (token !== focusToken || leftPage)
        return
      if (!shown.value.some(item => item.dishId === id))
        return
    }
  }
  catch (err) {
    if (token === focusToken)
      showError(err)
    return
  }
  intoView.value = ''
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 32))
  if (token !== focusToken || leftPage)
    return
  let placed = await placeDish(id)
  if (placed === 'miss') {
    await new Promise(resolve => setTimeout(resolve, 48))
    if (token !== focusToken || leftPage)
      return
    placed = await placeDish(id)
  }
  if (token !== focusToken || leftPage)
    return
  if (placed === 'miss') {
    intoView.value = 'dish-focus'
    await nextTick()
    if (token !== focusToken || leftPage)
      return
    intoView.value = dishKey(id)
  }
  playTada(id, placed === 'still' ? 32 : 320, token)
}

async function placeDish(id: string) {
  const list = scroller.value
  if (!list)
    return 'miss'
  const [row, frame] = await Promise.all([
    nodeBox(`#${dishKey(id)}`),
    list.readFrame(),
  ])
  if (!row || !frame)
    return 'miss'
  const mid = uni.getWindowInfo().windowHeight / 2
  const delta = row.top + row.height / 2 - mid
  const max = Math.max(0, frame.scrollHeight - frame.height)
  const target = Math.min(max, Math.max(0, frame.scrollTop + delta))
  if (Math.abs(target - frame.scrollTop) <= 1)
    return 'still'
  list.scrollTo(target)
  return 'moved'
}

const againMark = ref(1)

function goConfirm() {
  if (!picked.value.length || !slot.value) {
    showHint('先加上一道菜')
    return
  }
  orderDraft.date = date.value
  orderDraft.slot = slot.value
  orderDraft.dishes = [...picked.value]
  orderDraft.note = ''
  uni.navigateTo({ url: '/pages/eat/confirm' })
}

function viewOrdered() {
  if (!activeOrder.value)
    return
  uni.navigateTo({ url: `/pages/eat/order?id=${activeOrder.value.orderId}` })
}

const showTray = computed(() => {
  if (!board.value || !menuTotal.value)
    return false
  return Boolean(selectedBusy.value) || picked.value.length > 0
})

const CHIP_IN_MS = 240
const CHIP_OUT_MS = 180
const TRAY_IN_MS = 380
const TRAY_OUT_MS = 200

const trayHold = ref(false)
const trayEnter = ref(false)
const trayLeaving = ref(false)
const trayPortal = computed(() => !!props.active && trayHold.value && !!board.value)
const trayLayerStyle = computed(() => ({
  opacity: menuPanePose.value.opacity,
  transform: menuPanePose.value.transform,
  transition: menuPanePose.value.transition,
}))
const trayFresh = ref(false)
// 托盘浮在列表底上。外间距 16 + 边框 8 + 内边距 40 + 顶栏 68；选菜时再加间距 12 和筹码 72。
const trayClear = computed(() => {
  if (!showTray.value && !trayHold.value)
    return 0
  return selectedBusy.value ? 132 : 216
})
const chipPhase = ref<Record<string, 'in' | 'out'>>({})
const chipDelay = ref<Record<string, number>>({})
const chipTimers = new Map<string, ReturnType<typeof setTimeout>>()
const nameFrom = ref<Record<string, string>>({})
const nameOn = ref<Record<string, boolean>>({})
const nameWidth = ref<Record<string, string>>({})
const nameEase = ref<Record<string, boolean>>({})
const nameProbes = ref<string[]>([])
const nameTimers = new Map<string, ReturnType<typeof setTimeout>>()
const nameTokens = new Map<string, number>()
let nameSerial = 0
let spanToken = 0
let nameSpans = new Map<string, { from: number, to: number }>()
let trayTimer: ReturnType<typeof setTimeout> | undefined
let seenKeys: string[] = []

function clearName(key: string) {
  const timer = nameTimers.get(key)
  if (timer)
    clearTimeout(timer)
  nameTimers.delete(key)
  nameTokens.delete(key)
  if (!(key in nameFrom.value) && !(key in nameOn.value) && !(key in nameWidth.value) && !(key in nameEase.value))
    return
  const froms = { ...nameFrom.value }
  delete froms[key]
  nameFrom.value = froms
  const ons = { ...nameOn.value }
  delete ons[key]
  nameOn.value = ons
  const widths = { ...nameWidth.value }
  delete widths[key]
  nameWidth.value = widths
  const ease = { ...nameEase.value }
  delete ease[key]
  nameEase.value = ease
}

function nameBox(key: string) {
  const width = nameWidth.value[key]
  if (!width)
    return undefined
  return { width }
}

function readProbes() {
  return new Promise<number[] | null>((resolve) => {
    const queries = []
    if (instance?.proxy)
      queries.push(uni.createSelectorQuery().in(instance.proxy))
    queries.push(uni.createSelectorQuery())
    let pending = queries.length
    let settled = false
    const finish = (widths: number[] | null) => {
      if (settled)
        return
      if (widths) {
        settled = true
        resolve(widths)
        return
      }
      pending -= 1
      if (pending <= 0) {
        settled = true
        resolve(null)
      }
    }
    setTimeout(() => {
      if (settled)
        return
      settled = true
      resolve(null)
    }, 150)
    for (const query of queries) {
      query
        .selectAll('.tray-probe')
        .boundingClientRect()
        .exec((res) => {
          const list = (Array.isArray(res?.[0]) ? res[0] : []) as { width?: number }[]
          if (!list.length || list.some(rect => !(rect?.width)))
            finish(null)
          else
            finish(list.map(rect => rect.width || 0))
        })
    }
  })
}

// 骰子转动时量好新旧菜名，落地后从旧宽过渡到新宽。
function primeRenames(plans: { key: string, from: string, to: string }[]) {
  const token = ++spanToken
  nameSpans = new Map()
  if (!plans.length) {
    nameProbes.value = []
    return Promise.resolve()
  }
  nameProbes.value = plans.flatMap(plan => [plan.from, plan.to])
  return new Promise<void>((resolve) => {
    const attempt = (left: number) => {
      void nextTick(() => {
        void readProbes().then((widths) => {
          if (token !== spanToken) {
            resolve()
            return
          }
          if ((!widths || widths.length !== plans.length * 2) && left > 0) {
            setTimeout(() => attempt(left - 1), 32)
            return
          }
          nameProbes.value = []
          if (widths && widths.length === plans.length * 2) {
            const next = new Map<string, { from: number, to: number }>()
            plans.forEach((plan, index) => {
              const from = widths[index * 2]
              const to = widths[index * 2 + 1]
              if (from && to && Math.abs(from - to) >= 0.5)
                next.set(plan.key, { from, to })
            })
            if (token === spanToken)
              nameSpans = next
          }
          resolve()
        })
      })
    }
    attempt(2)
  })
}

const NAME_MS = 320

function playName(key: string, from: string, span?: { from: number, to: number }) {
  clearName(key)
  const token = ++nameSerial
  nameTokens.set(key, token)
  nameFrom.value = { ...nameFrom.value, [key]: from }
  const grow = !!span && span.to > span.from
  const shrink = !!span && span.to < span.from
  if (span && (grow || shrink)) {
    nameWidth.value = { ...nameWidth.value, [key]: `${span.from}px` }
    nameEase.value = { ...nameEase.value, [key]: false }
  }
  const finish = (wait: number) => {
    nameTimers.set(key, setTimeout(() => {
      if (nameTokens.get(key) !== token)
        return
      clearName(key)
    }, wait))
  }
  nameTimers.set(key, setTimeout(() => {
    if (nameTokens.get(key) !== token)
      return
    nameOn.value = { ...nameOn.value, [key]: true }
    if (grow && span) {
      nameWidth.value = { ...nameWidth.value, [key]: `${span.to}px` }
      nameEase.value = { ...nameEase.value, [key]: true }
      finish(NAME_MS + 40)
      return
    }
    if (shrink && span) {
      nameTimers.set(key, setTimeout(() => {
        if (nameTokens.get(key) !== token)
          return
        nameWidth.value = { ...nameWidth.value, [key]: `${span.to}px` }
        nameEase.value = { ...nameEase.value, [key]: true }
        finish(NAME_MS + 40)
      }, NAME_MS))
      return
    }
    finish(NAME_MS + 40)
  }, 32))
}

function clearTray() {
  for (const item of tray.value) {
    clearChipTimer(item.key)
    clearName(item.key)
  }
  tray.value = []
  chipPhase.value = {}
  chipDelay.value = {}
  seenKeys = []
}

function clearChipTimer(id: string) {
  const timer = chipTimers.get(id)
  if (!timer)
    return
  clearTimeout(timer)
  chipTimers.delete(id)
}

function startEnter(id: string, delay: number) {
  clearChipTimer(id)
  chipPhase.value = { ...chipPhase.value, [id]: 'in' }
  chipDelay.value = { ...chipDelay.value, [id]: delay }
  chipTimers.set(id, setTimeout(() => {
    chipTimers.delete(id)
    if (chipPhase.value[id] !== 'in')
      return
    const next = { ...chipPhase.value }
    delete next[id]
    chipPhase.value = next
    const waits = { ...chipDelay.value }
    delete waits[id]
    chipDelay.value = waits
  }, delay + CHIP_IN_MS))
}

function finishLeave(key: string, id: string) {
  const next = { ...chipPhase.value }
  delete next[key]
  chipPhase.value = next
  const waits = { ...chipDelay.value }
  delete waits[key]
  chipDelay.value = waits
  clearName(key)
  tray.value = tray.value.filter(item => item.key !== key)
  if (!tray.value.some(item => item.dish.dishId === id)) {
    roundIds.value = roundIds.value.filter(item => item !== id)
    keptIds.value = keptIds.value.filter(item => item !== id)
    freshIds.value = freshIds.value.filter(item => item !== id)
  }
  if (roundOn.value && roundIds.value.length === 0)
    endRound()
}

function beginLeave(id: string) {
  const item = tray.value.find(chip => chip.dish.dishId === id && chipPhase.value[chip.key] !== 'out')
  if (!item)
    return
  clearName(item.key)
  clearChipTimer(item.key)
  chipPhase.value = { ...chipPhase.value, [item.key]: 'out' }
  chipTimers.set(item.key, setTimeout(() => {
    chipTimers.delete(item.key)
    finishLeave(item.key, id)
  }, CHIP_OUT_MS))
}

function chipWait(id: string) {
  const delay = chipDelay.value[id]
  if (!delay || chipPhase.value[id] !== 'in')
    return undefined
  return { animationDelay: `${delay}ms` }
}

watch(showTray, (on) => {
  if (trayTimer) {
    clearTimeout(trayTimer)
    trayTimer = undefined
  }
  if (on) {
    trayLeaving.value = false
    trayHold.value = true
    trayEnter.value = true
    trayFresh.value = true
    trayTimer = setTimeout(() => {
      trayEnter.value = false
      trayFresh.value = false
      trayTimer = undefined
    }, TRAY_IN_MS)
    return
  }
  trayFresh.value = false
  if (!trayHold.value)
    return
  trayEnter.value = false
  trayLeaving.value = true
  trayTimer = setTimeout(() => {
    trayHold.value = false
    trayLeaving.value = false
    trayTimer = undefined
  }, TRAY_OUT_MS)
})

watch(() => tray.value.map(item => item.key), (keys) => {
  const prev = new Set(seenKeys)
  const added = keys.filter(key => !prev.has(key))
  const lead = trayFresh.value ? 110 : 0
  added.forEach((key, index) => startEnter(key, lead + index * 40))
  seenKeys = [...keys]
})

function mealTone(day: string, meal: Slot) {
  if (busyOf(day, meal))
    return 'text-#9c342c'
  return 'text-#7a534c'
}

interface MealMetrics {
  inner: number
  dayGap: number
  dayW: number
  inset: number
  mealGap: number
  mealW: number
}

interface MealPose {
  left: number
  width: number
}

const phase = ref<'' | 'stretch' | 'settle'>('')
const farSlide = ref(false)
const pose = ref<MealPose>({ left: 0, width: 0 })
const pillReady = ref(false)
const shownDay = ref(-1)
const slideTimers: ReturnType<typeof setTimeout>[] = []
let animateNext = false
let slideToken = 0

const dayIndex = computed(() => {
  const days = board.value?.dates
  if (!days?.length || !date.value)
    return 0
  const index = days.findIndex(item => item.date === date.value)
  return index < 0 ? 0 : index
})

const washStyle = computed(() => {
  const count = board.value?.dates.length || 1
  const metrics = mealMetrics(count)
  return {
    width: `${metrics.dayW}px`,
    transform: `translate3d(${dayIndex.value * (metrics.dayW + metrics.dayGap)}px, 0, 0)`,
  }
})

const pillStyle = computed(() => ({
  width: `${pose.value.width}px`,
  transform: `translate3d(${pose.value.left}px, 0, 0)`,
}))

const inkStyle = computed(() => {
  const count = board.value?.dates.length || 1
  return {
    width: `${mealMetrics(count).inner}px`,
    transform: `translate3d(${-pose.value.left}px, 0, 0)`,
  }
})

watch([date, slot], () => {
  const animate = animateNext
  animateNext = false
  placePill(animate)
})

onUnmounted(() => {
  leftPage = true
  clearSlideTimers()
  if (rollTimer)
    clearTimeout(rollTimer)
  if (trayTimer)
    clearTimeout(trayTimer)
  if (tadaTimer)
    clearTimeout(tadaTimer)
  for (const timer of chipTimers.values())
    clearTimeout(timer)
  for (const timer of nameTimers.values())
    clearTimeout(timer)
})

function mealMetrics(count: number): MealMetrics {
  const safe = Math.max(count, 1)
  const boardW = uni.getWindowInfo().windowWidth - uni.upx2px(44) * 2
  const inner = boardW - uni.upx2px(4) * 2 - uni.upx2px(16) * 2
  const dayGap = uni.upx2px(12)
  const dayW = (inner - dayGap * (safe - 1)) / safe
  const inset = uni.upx2px(8)
  const mealGap = uni.upx2px(8)
  const mealW = (dayW - inset * 2 - mealGap * 2) / slots.length
  return { inner, dayGap, dayW, inset, mealGap, mealW }
}

function mealPose(dayAt: number, mealAt: number, metrics: MealMetrics): MealPose {
  return {
    left: dayAt * (metrics.dayW + metrics.dayGap) + metrics.inset + mealAt * (metrics.mealW + metrics.mealGap),
    width: metrics.mealW,
  }
}

function stretchPose(from: MealPose, to: MealPose): MealPose {
  const trail = 0.12
  if (to.left >= from.left) {
    const right = to.left + to.width
    const left = from.left + (to.left - from.left) * trail
    return { left, width: right - left }
  }
  const left = to.left
  const right = from.left + from.width + (to.left - from.left) * trail
  return { left, width: right - left }
}

function placePill(animate: boolean) {
  const days = board.value?.dates
  if (!days?.length || !date.value)
    return
  const nextDay = days.findIndex(item => item.date === date.value)
  const nextMeal = slots.indexOf(slot.value)
  if (nextDay < 0 || nextMeal < 0)
    return
  const target = mealPose(nextDay, nextMeal, mealMetrics(days.length))
  const far = shownDay.value >= 0 && shownDay.value !== nextDay
  shownDay.value = nextDay
  if (!pillReady.value || !animate) {
    clearSlideTimers()
    slideToken += 1
    phase.value = ''
    pose.value = target
    pillReady.value = true
    return
  }
  if (Math.abs(pose.value.left - target.left) < 0.5 && Math.abs(pose.value.width - target.width) < 0.5)
    return
  slidePill({ ...pose.value }, target, far)
}

function slidePill(from: MealPose, target: MealPose, far: boolean) {
  const token = ++slideToken
  clearSlideTimers()
  phase.value = ''
  farSlide.value = far
  const lead = far ? 200 : 150
  const settle = far ? 200 : 170
  later(() => {
    if (token !== slideToken)
      return
    pose.value = stretchPose(from, target)
    phase.value = 'stretch'
    later(() => {
      if (token !== slideToken)
        return
      pose.value = target
      phase.value = 'settle'
    }, lead)
    later(() => {
      if (token !== slideToken)
        return
      phase.value = ''
    }, lead + settle + 24)
  }, 32)
}

function later(fn: () => void, ms: number) {
  slideTimers.push(setTimeout(fn, ms))
}

function clearSlideTimers() {
  for (const id of slideTimers)
    clearTimeout(id)
  slideTimers.length = 0
}

function onTrayTap() {
  if (selectedBusy.value)
    viewOrdered()
  else
    goConfirm()
}

defineExpose({ refresh })
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <view v-if="nameProbes.length" class="tray-probe-host">
      <view v-for="(label, index) in nameProbes" :key="index" class="tray-probe">
        <text class="whitespace-nowrap text-28rpx text-#3c2428 leading-none font-display">
          {{ label }}
        </text>
      </view>
    </view>
    <view class="shrink-0">
      <screen-head title="菜单" :note="bareEmpty ? '还没有上架的菜。' : ''" />
    </view>
    <view v-if="!board" class="min-h-0 w-full flex flex-1 items-center justify-center">
      <ink-load label="正在摆这一餐" />
    </view>
    <list-scroll
      v-else
      ref="scroller"
      :inset-top="bareEmpty ? 28 : 64"
      :inset-bottom="trayClear"
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      :into-view="intoView"
      @refresh="onPull"
      @more="onMore"
    >
      <view v-if="bareEmpty" class="w-full flex flex-col items-center pt-28rpx">
        <image class="relative z-1 h-248rpx w-264rpx" src="/static/cook-tomato.png" mode="aspectFit" />
        <view class="relative z-0 w-456rpx flex items-center justify-center border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-36rpx pt-128rpx -mt-100rpx">
          <text class="text-44rpx text-#3c2428 font-display">
            等对方上架
          </text>
        </view>
      </view>
      <view v-else class="flex flex-col gap-28rpx pt-64rpx">
        <view class="box-border min-w-0 w-full border-4rpx border-#c9a297 rounded-36rpx border-solid bg-#fff9f4 p-16rpx">
          <view class="relative flex items-stretch gap-12rpx">
            <view
              v-if="date"
              class="eat-meal-wash pointer-events-none absolute bottom-0 left-0 top-0 rounded-28rpx bg-#f6e4de"
              :style="washStyle"
            />
            <view
              v-for="day in board.dates"
              :key="day.date"
              class="relative z-1 min-w-0 flex flex-1 flex-col items-center gap-16rpx overflow-hidden rounded-28rpx px-8rpx py-20rpx"
            >
              <text class="text-44rpx text-#3c2428 leading-none font-display">
                {{ dateLabel(day.date, board.today) }}
              </text>
              <text class="text-24rpx text-#7a534c leading-none font-body">
                {{ monthDay(day.date) }}
              </text>
              <view class="w-full flex items-center justify-center gap-8rpx">
                <view
                  v-for="meal in slots"
                  :key="meal"
                  class="h-80rpx min-w-0 flex flex-1 flex-col items-center justify-center gap-2rpx overflow-hidden rounded-24rpx"
                  @tap="selectSlot(day.date, meal)"
                >
                  <text class="text-32rpx leading-none font-display" :class="mealTone(day.date, meal)">
                    {{ slotShort[meal] }}
                  </text>
                  <text v-if="busyOf(day.date, meal)" class="whitespace-nowrap text-22rpx leading-none font-body" :class="mealTone(day.date, meal)">
                    已点
                  </text>
                </view>
              </view>
            </view>
            <view v-if="pillReady" class="pointer-events-none absolute bottom-20rpx left-0 right-0 z-2 h-80rpx">
              <view
                class="eat-meal-pill absolute left-0 top-0 h-full overflow-hidden rounded-24rpx bg-#792b3e"
                :class="phase ? [farSlide ? 'eat-meal-far' : 'eat-meal-near', 'eat-meal-flow', `eat-meal-${phase}`] : ''"
                :style="pillStyle"
              >
                <view class="eat-meal-ink absolute left-0 top-0 h-full flex items-stretch gap-12rpx" :style="inkStyle">
                  <view
                    v-for="day in board.dates"
                    :key="day.date"
                    class="h-full min-w-0 flex flex-1 items-center gap-8rpx px-8rpx"
                  >
                    <view
                      v-for="meal in slots"
                      :key="meal"
                      class="h-full min-w-0 flex flex-1 flex-col items-center justify-center gap-2rpx"
                    >
                      <text class="text-32rpx text-#fbf3ea leading-none font-display">
                        {{ slotShort[meal] }}
                      </text>
                      <text v-if="busyOf(day.date, meal)" class="whitespace-nowrap text-22rpx text-#fbf3ea leading-none font-body">
                        已点
                      </text>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="flex flex-col gap-20rpx">
          <view class="box-border h-84rpx flex items-center gap-16rpx border-2rpx border-#c9a297 rounded-full border-solid bg-#fff9f4 px-28rpx">
            <view class="i-mingcute-search-line shrink-0 text-32rpx text-#7a534c" />
            <textarea
              v-model="keyword"
              disable-default-padding
              class="h-80rpx min-w-0 flex-1 text-30rpx text-#3c2428 leading-80rpx font-body"
              placeholder="搜菜名"
              placeholder-class="ph-sans"
              placeholder-style="font-size: 30rpx; line-height: 80rpx;"
              confirm-type="search"
              :show-confirm-bar="false"
            />
          </view>
          <scroll-view scroll-x enhanced class="w-full whitespace-nowrap" :show-scrollbar="false">
            <view class="inline-flex gap-16rpx">
              <view
                class="inline-flex items-center justify-center border-2rpx rounded-32rpx border-solid px-24rpx py-14rpx"
                :class="categoryId ? 'border-#c9a297 bg-#fff9f4' : 'border-#792b3e bg-#792b3e'"
                @tap="pickCategory('')"
              >
                <text class="text-28rpx leading-none font-body" :class="categoryId ? 'text-#3c2428' : 'text-#fff9f4'">
                  全部
                </text>
              </view>
              <view
                v-for="category in categories"
                :key="category.categoryId"
                class="inline-flex items-center justify-center border-2rpx rounded-32rpx border-solid px-24rpx py-14rpx"
                :class="categoryId === category.categoryId ? 'border-#792b3e bg-#792b3e' : 'border-#c9a297 bg-#fff9f4'"
                @tap="pickCategory(category.categoryId)"
              >
                <text class="text-28rpx leading-none font-body" :class="categoryId === category.categoryId ? 'text-#fff9f4' : 'text-#3c2428'">
                  {{ category.name }}
                </text>
              </view>
            </view>
          </scroll-view>
        </view>
        <view v-if="menuTotal && !selectedBusy" class="box-border flex items-center gap-16rpx border-2rpx border-#c9a297 rounded-36rpx border-solid bg-#fff9f4 px-28rpx py-20rpx">
          <roll-dice :rolling="rolling" />
          <view class="random-copy min-w-0 flex-1">
            <view class="random-title" :class="roundOn ? 'random-title-up' : ''">
              <text class="text-36rpx text-#3c2428 leading-36rpx font-display">
                随便
              </text>
            </view>
            <text
              class="random-note whitespace-nowrap text-24rpx text-#7a534c font-body"
              :class="roundOn ? 'random-note-open' : ''"
            >
              可以留下几道菜，其余继续随机
            </text>
          </view>
          <view v-if="!roundOn" class="flex shrink-0 items-center gap-12rpx">
            <view class="flex items-center gap-8rpx">
              <view
                class="h-48rpx w-48rpx flex items-center justify-center border-2rpx border-#c9a297 rounded-full border-solid"
                :class="wishCount <= 1 ? 'opacity-35' : ''"
                @tap="bumpWish(-1)"
              >
                <text class="text-28rpx text-#3c2428 leading-none font-body">
                  −
                </text>
              </view>
              <text class="min-w-64rpx text-center text-32rpx text-#3c2428 leading-none font-display">
                {{ wishCount }} 道
              </text>
              <view
                class="h-48rpx w-48rpx flex items-center justify-center border-2rpx border-#c9a297 rounded-full border-solid"
                :class="wishCount >= randomRoom ? 'opacity-35' : ''"
                @tap="bumpWish(1)"
              >
                <text class="text-28rpx text-#3c2428 leading-none font-body">
                  +
                </text>
              </view>
            </view>
            <view
              class="eat-press inline-flex h-64rpx w-102rpx shrink-0 items-center justify-center rounded-full bg-#792b3e"
              hover-class="eat-press-on"
              :hover-stay-time="140"
              @tap="beginRound"
            >
              <text class="text-26rpx text-#fbf3ea font-medium leading-none font-body">
                开始
              </text>
            </view>
          </view>
          <view
            v-else
            class="eat-press inline-flex h-64rpx w-102rpx shrink-0 items-center justify-center rounded-full bg-#792b3e"
            :class="rollSealed ? 'opacity-35' : rolling ? 'opacity-60' : ''"
            :hover-class="rollSealed ? 'none' : 'eat-press-on'"
            :hover-stay-time="140"
            @tap="rollAgain"
          >
            <text class="text-26rpx text-#fbf3ea font-medium leading-none font-body">
              +{{ againMark }}
            </text>
          </view>
        </view>
        <view v-if="shown.length" class="flex flex-col">
        <view
          v-for="dish in shown"
          :id="dishKey(dish.dishId)"
          :key="dish.dishId"
          class="flex items-center gap-24rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx"
        >
          <view
            class="h-144rpx w-144rpx shrink-0 rounded-36rpx"
            :class="tadaId === dish.dishId ? 'dish-tada' : ''"
            :style="{ boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.28)' }"
          >
            <dish-cover
              class="box-border h-full w-full border-6rpx border-#fff9f4 rounded-36rpx border-solid"
              :file-id="dish.coverFileId"
              :name="dish.name"
            />
          </view>
          <view class="min-w-0 flex flex-1 flex-col gap-6rpx">
            <text class="text-40rpx text-#3c2428 leading-[1.15] font-display">
              {{ dish.name }}
            </text>
            <text class="text-26rpx text-#7a534c font-body">
              {{ dish.categoryName || '未分类' }}{{ freshIds.includes(dish.dishId) ? ' · 刚换上' : '' }}
            </text>
          </view>
          <text
            v-if="selectedBusy && inOrder(dish.dishId)"
            class="shrink-0 text-28rpx text-#792b3e font-semibold font-body"
          >
            在这一餐
          </text>
          <view v-else-if="roundIds.includes(dish.dishId)" class="flex shrink-0 items-center gap-20rpx">
            <text class="text-28rpx text-#792b3e font-semibold font-body" @tap="dropDish(dish.dishId)">
              已加上
            </text>
            <text
              class="text-28rpx font-semibold font-body"
              :class="keptIds.includes(dish.dishId) ? 'text-#792b3e' : 'text-#7a534c'"
              @tap="toggleKeep(dish.dishId)"
            >
              {{ keptIds.includes(dish.dishId) ? '已留' : '保留' }}
            </text>
          </view>
          <text
            v-else-if="!selectedBusy"
            class="shrink-0 text-28rpx font-body"
            :class="chosen(dish.dishId) ? 'text-#792b3e font-semibold' : 'text-#3c2428'"
            @tap="toggle(dish)"
          >
            {{ chosen(dish.dishId) ? '已加上' : '加上' }}
          </text>
        </view>
        </view>
        <text v-if="!shown.length" class="text-30rpx text-#7a534c font-body">
          没有这道菜。
        </text>
      </view>
    </list-scroll>
    <root-portal v-if="trayPortal">
      <view
        class="fixed bottom-[calc(184rpx+env(safe-area-inset-bottom))] left-0 right-0 z-10 box-border px-32rpx pb-8rpx pt-8rpx"
        :style="trayLayerStyle"
      >
        <view
          class="tray-card flex flex-col gap-12rpx border-4rpx border-#c9a297 rounded-36rpx border-solid bg-#fff9f4 pb-20rpx pl-28rpx pr-24rpx pt-20rpx"
          :class="trayLeaving ? 'tray-out' : trayEnter ? 'tray-in' : ''"
        >
          <view class="flex items-center justify-between gap-24rpx">
            <view v-if="selectedBusy" class="min-w-0 flex flex-1 flex-col gap-8rpx">
              <text class="text-32rpx text-#3c2428 leading-none font-display">
                {{ `${dateLabel(date, board.today)} · ${SLOT_LABEL[slot]}` }}
              </text>
              <text class="text-26rpx text-#7a534c leading-none font-body">
                进行中，不能再开一笔
              </text>
            </view>
            <view v-else class="min-w-0 flex items-center gap-16rpx">
              <text class="text-32rpx text-#3c2428 leading-none font-display">
                已选
              </text>
              <text class="text-26rpx text-#7a534c leading-none font-body">
                {{ `${picked.length} 道` }}
              </text>
            </view>
            <view
              class="eat-press inline-flex shrink-0 items-center justify-center rounded-full bg-#792b3e px-28rpx py-20rpx"
              hover-class="eat-press-on"
              :hover-stay-time="140"
              @tap="onTrayTap"
            >
              <text class="whitespace-nowrap text-28rpx text-#fbf3ea font-medium leading-none font-body">
                {{ selectedBusy ? '查看已点的这一餐' : '去确认' }}
              </text>
            </view>
          </view>
          <scroll-view
            v-if="!selectedBusy"
            scroll-x
            enhanced
            class="h-72rpx w-full whitespace-nowrap"
            :show-scrollbar="false"
          >
            <view class="inline-flex h-72rpx items-center">
              <view
                v-for="item in tray"
                :key="item.key"
                class="tray-chip-slot inline-flex"
                :class="chipPhase[item.key] === 'out' ? 'tray-chip-slot-out' : ''"
              >
                <view
                  class="tray-chip inline-flex items-center border-2rpx border-solid rounded-28rpx bg-#f6e4de py-16rpx pl-20rpx pr-16rpx"
                  :class="[
                    keptIds.includes(item.dish.dishId) ? 'border-#792b3e' : 'border-#c9a297',
                    chipPhase[item.key] === 'in' ? 'tray-chip-in' : '',
                  ]"
                  :style="chipWait(item.key)"
                  @tap="focusDish(item.dish.dishId)"
                >
                  <text
                    class="mr-8rpx whitespace-nowrap text-22rpx font-semibold leading-none font-body"
                    :class="item.rolled ? 'text-#792b3e' : 'text-#7a534c'"
                  >
                    {{ item.rolled ? '随机' : '自选' }}
                  </text>
                  <view
                    class="tray-name"
                    :class="[
                      nameFrom[item.key] ? 'tray-name-move' : '',
                      nameWidth[item.key] ? 'tray-name-lock' : '',
                      nameEase[item.key] ? 'tray-name-ease' : '',
                    ]"
                    :style="nameBox(item.key)"
                  >
                    <view class="tray-name-sizer">
                      <text class="whitespace-nowrap text-28rpx text-#3c2428 leading-none font-display">
                        {{ nameFrom[item.key] || item.dish.name }}
                      </text>
                    </view>
                    <view v-if="nameFrom[item.key]" class="tray-name-reel">
                      <view class="tray-name-strip" :class="nameOn[item.key] ? 'tray-name-strip-on' : ''">
                        <view class="tray-name-line">
                          <text class="whitespace-nowrap text-28rpx text-#3c2428 leading-none font-display">
                            {{ nameFrom[item.key] }}
                          </text>
                        </view>
                        <view class="tray-name-line">
                          <text class="whitespace-nowrap text-28rpx text-#3c2428 leading-none font-display">
                            {{ item.dish.name }}
                          </text>
                        </view>
                      </view>
                    </view>
                  </view>
                  <view
                    class="tray-keep"
                    :class="keptIds.includes(item.dish.dishId) ? 'tray-keep-on' : ''"
                  >
                    <text class="whitespace-nowrap text-24rpx text-#792b3e font-semibold leading-none font-body">
                      留
                    </text>
                  </view>
                  <view class="ml-12rpx h-32rpx w-32rpx flex shrink-0 items-center justify-center" @tap.stop="dropDish(item.dish.dishId)">
                    <text class="text-28rpx text-#7a534c leading-none font-body">
                      ×
                    </text>
                  </view>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
    </root-portal>
  </view>
</template>

<style>
.eat-meal-wash {
  transition: transform 340ms cubic-bezier(0.22, 1.06, 0.36, 1) 50ms;
}

.eat-meal-pill,
.eat-meal-ink {
  will-change: transform;
}

.eat-meal-near.eat-meal-stretch,
.eat-meal-near.eat-meal-stretch .eat-meal-ink {
  transition: transform 150ms cubic-bezier(0.12, 0.72, 0.18, 1), width 150ms cubic-bezier(0.12, 0.72, 0.18, 1);
}

.eat-meal-near.eat-meal-settle,
.eat-meal-near.eat-meal-settle .eat-meal-ink {
  transition: transform 170ms cubic-bezier(0.22, 1.06, 0.36, 1), width 170ms cubic-bezier(0.22, 1.06, 0.36, 1);
}

.eat-meal-far.eat-meal-stretch,
.eat-meal-far.eat-meal-stretch .eat-meal-ink {
  transition: transform 200ms cubic-bezier(0.12, 0.72, 0.18, 1), width 200ms cubic-bezier(0.12, 0.72, 0.18, 1);
}

.eat-meal-far.eat-meal-settle,
.eat-meal-far.eat-meal-settle .eat-meal-ink {
  transition: transform 200ms cubic-bezier(0.22, 1.06, 0.36, 1), width 200ms cubic-bezier(0.22, 1.06, 0.36, 1);
}

.eat-meal-near.eat-meal-flow {
  animation: eat-meal-squash 320ms linear both;
}

.eat-meal-far.eat-meal-flow {
  animation: eat-meal-squash 400ms linear both;
}

@keyframes eat-meal-squash {
  0%,
  100% {
    top: 0;
    height: 100%;
  }

  42% {
    top: 4%;
    height: 92%;
  }

  74% {
    top: -3%;
    height: 103%;
  }
}

.random-copy {
  position: relative;
  display: flex;
  align-items: center;
  height: 64rpx;
  overflow: hidden;
}

.random-title {
  display: flex;
  align-items: center;
  height: 36rpx;
  overflow: hidden;
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.random-title-up {
  transform: translateY(-14rpx);
}

.random-note {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 24rpx;
  overflow: hidden;
  line-height: 24rpx;
  opacity: 0;
  transition: opacity 200ms ease;
}

.random-note-open {
  opacity: 1;
}

.tray-card {
  box-shadow: 6rpx 8rpx 0 rgba(78, 34, 45, 0.28);
}

.tray-in {
  animation: tray-in 320ms cubic-bezier(0.22, 1.08, 0.36, 1) both;
}

.tray-out {
  animation: tray-out 200ms cubic-bezier(0.4, 0, 1, 1) forwards;
}

.tray-chip {
  transition: border-color 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tray-chip-slot {
  min-width: 0;
  max-width: 640rpx;
  margin-right: 16rpx;
}

.tray-name {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  max-width: 100%;
}

.tray-probe-host {
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  opacity: 0;
  pointer-events: none;
}

.tray-probe {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
}

.tray-name-lock {
  flex: none;
  min-width: 0;
  max-width: none;
}

.tray-name-lock .tray-name-sizer {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.tray-name-ease {
  will-change: width;
  transition: width 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tray-name-sizer {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
}

.tray-name-move .tray-name-sizer {
  height: 28rpx;
  overflow: hidden;
  opacity: 0;
}

.tray-name-reel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 28rpx;
  overflow: hidden;
  pointer-events: none;
}

.tray-name-strip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.tray-name-strip-on {
  transform: translate3d(0, -28rpx, 0);
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tray-name-line {
  display: flex;
  align-items: flex-start;
  height: 28rpx;
  overflow: hidden;
}

.tray-chip-in {
  transform-origin: center;
  animation: tray-chip-in 240ms cubic-bezier(0.22, 1.12, 0.36, 1) both;
}

.tray-chip-slot-out {
  overflow: hidden;
  animation: tray-chip-slot-out 180ms cubic-bezier(0.4, 0, 1, 1) forwards;
}

.tray-chip-slot-out .tray-chip {
  animation: tray-chip-out 160ms cubic-bezier(0.4, 0, 1, 1) forwards;
}

.tray-keep {
  position: relative;
  flex-shrink: 0;
  width: 0;
  height: 28rpx;
  min-width: 0;
  margin-left: 0;
  overflow: hidden;
  opacity: 0;
  transform: scale(0.72);
  transform-origin: left center;
  transition:
    width 160ms cubic-bezier(0.4, 0, 1, 1),
    margin-left 160ms cubic-bezier(0.4, 0, 1, 1),
    opacity 120ms ease-in,
    transform 160ms cubic-bezier(0.4, 0, 1, 1);
}

.tray-keep text {
  position: absolute;
  left: 0;
  top: 0;
  height: 28rpx;
  line-height: 28rpx;
}

.tray-keep-on {
  width: 28rpx;
  margin-left: 12rpx;
  opacity: 1;
  transform: scale(1);
  transition:
    width 240ms cubic-bezier(0.22, 1.08, 0.36, 1),
    margin-left 240ms cubic-bezier(0.22, 1.08, 0.36, 1),
    opacity 180ms ease-out,
    transform 240ms cubic-bezier(0.22, 1.12, 0.36, 1);
}

.dish-tada {
  transform-origin: center center;
  animation: dish-tada 680ms linear both;
}

@keyframes dish-tada {
  0% {
    transform: scale(1) rotate(0deg);
  }

  10%,
  20% {
    transform: scale(0.98) rotate(-2deg);
  }

  30%,
  50%,
  70%,
  90% {
    transform: scale(1.045) rotate(2deg);
  }

  40%,
  60%,
  80% {
    transform: scale(1.045) rotate(-2deg);
  }

  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes tray-in {
  from {
    opacity: 0;
    transform: translate3d(0, 28rpx, 0) scale(0.94);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes tray-out {
  from {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }

  to {
    opacity: 0;
    transform: translate3d(0, 20rpx, 0) scale(0.97);
  }
}

@keyframes tray-chip-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes tray-chip-out {
  to {
    transform: scale(0.84);
  }
}

@keyframes tray-chip-slot-out {
  0% {
    max-width: 640rpx;
    margin-right: 16rpx;
    opacity: 1;
  }

  45% {
    max-width: 640rpx;
    margin-right: 16rpx;
    opacity: 0;
  }

  100% {
    max-width: 0;
    margin-right: 0;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .eat-meal-wash,
  .eat-meal-pill,
  .eat-meal-ink,
  .random-title,
  .random-note,
  .tray-in,
  .tray-out,
  .tray-chip,
  .tray-chip-in,
  .tray-chip-slot-out,
  .tray-chip-slot-out .tray-chip,
  .tray-name-strip-on,
  .tray-name-ease,
  .tray-keep,
  .tray-keep-on,
  .dish-tada {
    transition: none;
    animation: none;
  }
}
</style>
