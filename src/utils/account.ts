import type { AccountView, Badges, Role } from '@/api/eat'
import { badges, EatRequestError, enter, me } from '@/api/eat'
import { noteBadges, resetHomeTab } from '@/utils/tabs'

let current: AccountView | null = null
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
}

export function peekAccount() {
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
  return view
}

async function fetchOpen(id: number) {
  const view = await fetchMe()
  let nextBadges = view.badges
  try {
    nextBadges = await badges()
  }
  catch {
    // 角标失败时沿用账号里带回的数量，页面仍可打开
  }
  return keepAccount({ ...view, badges: nextBadges }, id)
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
  return view
}

export function patchBadges(partial: Partial<Badges>) {
  const base = current?.badges ?? { todo: 0, orders: 0, records: 0 }
  const next = { ...base, ...partial }
  if (current)
    current.badges = next
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
