import type { AccountView, Badges, Role } from '@/api/eat'
import { EatRequestError, enter, me } from '@/api/eat'
import { noteBadges, resetHomeTab } from '@/utils/tabs'

const CACHE_KEY = 'eat-account-v1'

function readCache(): AccountView | null {
  try {
    const stored = uni.getStorageSync(CACHE_KEY) as { at?: unknown, view?: unknown } | ''
    if (!stored || typeof stored !== 'object')
      return null
    const view = stored.view as AccountView | undefined
    if (!view || typeof view !== 'object' || typeof view.next !== 'string')
      return null
    if (!view.badges || typeof view.badges !== 'object')
      view.badges = { todo: 0, orders: 0, records: 0 }
    return view
  }
  catch {
    return null
  }
}

function saveCache(view: AccountView) {
  try {
    uni.setStorageSync(CACHE_KEY, { at: Date.now(), view })
  }
  catch {
    // 存储写不进去时只影响下次启动的快路径
  }
}

let current: AccountView | null = readCache()
let choosing = false
let showId = 0
let fetchedId = -1
let pending: Promise<AccountView> | null = null
let pendingId = -1

export function beginChoose() {
  choosing = true
}

export function endChoose() {
  choosing = false
}

export function isChoosing() {
  return choosing
}

export function rememberAccount(view: AccountView) {
  current = view
  saveCache(view)
}

export function peekAccount() {
  return current
}

export function cachedHome(role?: Role) {
  if (!current || current.next !== 'home')
    return null
  if (role && current.role !== role)
    return null
  return current
}

export function markAppShow() {
  showId += 1
}

async function fetchMe() {
  const token = uni.getStorageSync('uni_id_token')
  try {
    return token ? await me() : await enter()
  }
  catch (err) {
    const expired = err instanceof EatRequestError && err.errCode === 'NOT_LOGIN'
    if (!expired)
      throw err
    return enter()
  }
}

function keepAccount(view: AccountView, id: number) {
  if (id !== showId)
    return view
  current = view
  fetchedId = id
  noteBadges(view.badges)
  saveCache(view)
  return view
}

function fetchOpen(id: number) {
  return fetchMe().then(view => keepAccount(view, id))
}

export async function loadAccount(fresh = false) {
  if (fresh)
    return reloadMe()
  if (current && fetchedId === showId)
    return current
  if (pending && pendingId === showId)
    return pending
  const id = showId
  const run = fetchOpen(id)
  pending = run
  pendingId = id
  try {
    return await run
  }
  finally {
    if (pending === run)
      pending = null
  }
}

export async function reloadMe() {
  const view = await fetchMe()
  current = view
  fetchedId = showId
  noteBadges(view.badges)
  saveCache(view)
  return view
}

export function patchBadges(partial: Partial<Badges>) {
  const base = current?.badges ?? { todo: 0, orders: 0, records: 0 }
  const next = { ...base, ...partial }
  if (current) {
    current.badges = next
    saveCache(current)
  }
  noteBadges(next)
  return next
}

export function releaseTodo() {
  if (current?.role !== 'cooker')
    return
  patchBadges({ todo: Math.max(0, current.badges.todo - 1) })
}

export function accountPath(view: AccountView) {
  if (view.next === 'invite')
    return '/pages/bind/invite'
  if (view.next === 'waiting')
    return '/pages/bind/waiting'
  if (view.next === 'confirm')
    return `/pages/bind/join?code=${view.inviteCode}`
  if (view.next === 'home')
    return '/pages/home/index'
  return '/pages/index'
}

export function routeAccount(view: AccountView) {
  rememberAccount(view)
  const url = accountPath(view)
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as { route?: string } | undefined
  const route = page?.route ? `/${page.route}` : ''
  if (route === url.split('?')[0])
    return Promise.resolve(false)
  if (view.next === 'home' && (view.role === 'eater' || view.role === 'cooker'))
    resetHomeTab(view.role)
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (ok: boolean) => {
      if (settled)
        return
      settled = true
      resolve(ok)
    }
    uni.reLaunch({
      url,
      success: () => finish(true),
      fail: (err) => {
        console.error('routeAccount', err)
        finish(false)
      },
    })
    setTimeout(() => finish(false), 1600)
  })
}

export async function ensureAccount(expect: {
  next?: AccountView['next'] | AccountView['next'][]
  role?: Role
} = {}) {
  const view = await loadAccount()
  const allowed = expect.next == null
    ? null
    : (Array.isArray(expect.next) ? expect.next : [expect.next])
  const nextOk = !allowed || allowed.includes(view.next)
  const roleOk = !expect.role || view.role === expect.role
  if (!nextOk || !roleOk) {
    await routeAccount(view)
    return null
  }
  return view
}
