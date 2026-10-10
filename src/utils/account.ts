import type { AccountView, Role } from '@/api/eat'
import { EatRequestError, enter, me } from '@/api/eat'
import { resetHomeTab } from '@/utils/tabs'

let current: AccountView | null = null
let choosing = false

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

export async function loadAccount(fresh = false) {
  if (!fresh && current)
    return current
  const token = uni.getStorageSync('uni_id_token')
  try {
    const view = token ? await me() : await enter()
    current = view
    return view
  }
  catch (err) {
    const expired = err instanceof EatRequestError && err.errCode === 'NOT_LOGIN'
    if (!expired)
      throw err
    const view = await enter()
    current = view
    return view
  }
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
  const view = await loadAccount(true)
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
