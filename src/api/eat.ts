import type {
  Badges,
  CloudResult,
  CreateRecordInput,
  DishQuery,
  EatCloud,
  MenuQuery,
  PublishDishInput,
  Role,
  Slot,
  UpdateRecordInput,
} from '@/api/types'
import { eatCloud } from '@/utils/cloud'

export type {
  AccountView,
  Badges,
  Category,
  CookDish,
  DishDetail,
  DishQuery,
  MealBoard,
  MenuDish,
  OrderDetail,
  OrderStatus,
  RecordCard,
  Role,
  SessionView,
  Slot,
} from '@/api/types'

export const SLOT_LABEL: Record<Slot, string> = {
  morning: '早上',
  noon: '中午',
  evening: '晚上',
}

export const STATUS_LABEL = {
  pending: '待接单',
  accepted: '已接单',
  rejected: '已拒绝',
  cancelled: '已取消',
} as const

export const ROLE_LABEL: Record<Role, string> = {
  cooker: '做饭的人',
  eater: '点餐的人',
}

const TOKEN_KEY = 'uni_id_token'
const TOKEN_EXPIRED_KEY = 'uni_id_token_expired'

export class EatRequestError extends Error {
  errCode: string | number
  data?: unknown

  constructor(errCode: string | number, message: string, data?: unknown) {
    super(message)
    this.name = 'EatRequestError'
    this.errCode = errCode
    this.data = data
  }
}

export function saveSession(token: string, tokenExpired: number) {
  uni.setStorageSync(TOKEN_KEY, token)
  uni.setStorageSync(TOKEN_EXPIRED_KEY, tokenExpired)
}

function keepSession(data: unknown) {
  if (!data || typeof data !== 'object')
    return
  const row = data as { token?: unknown, tokenExpired?: unknown }
  if (typeof row.token === 'string' && typeof row.tokenExpired === 'number')
    saveSession(row.token, row.tokenExpired)
}

function cloudBody(value: unknown) {
  if (!value || typeof value !== 'object' || value instanceof Error)
    return null
  const row = value as { errCode?: unknown, errMsg?: unknown, data?: unknown }
  if (typeof row.errCode !== 'string' || row.errCode === 'SYSTEM_ERROR' || row.errCode === 'SYS_ERR')
    return null
  if (typeof row.errMsg !== 'string')
    return null
  const errMsg = row.errMsg.trim()
  if (!errMsg || errMsg === 'unknown system error' || errMsg.startsWith('request:fail'))
    return null
  return {
    errCode: row.errCode,
    errMsg,
    data: row.data,
  }
}

function cloudError(err: unknown) {
  if (!err || typeof err !== 'object')
    return null
  const row = err as { errCode?: unknown, errMsg?: unknown, detail?: unknown }
  const fromDetail = cloudBody(row.detail)
  if (fromDetail)
    return fromDetail
  if (typeof row.errCode !== 'string' || row.errCode === 'SYSTEM_ERROR' || row.errCode === 'SYS_ERR')
    return null
  if (typeof row.errMsg !== 'string')
    return null
  const errMsg = row.errMsg.trim()
  if (!errMsg || errMsg === 'unknown system error' || errMsg.startsWith('request:fail'))
    return null
  const detail = row.detail
  const data = detail && typeof detail === 'object' && !(detail instanceof Error)
    ? (detail as { data?: unknown }).data
    : undefined
  return { errCode: row.errCode, errMsg, data }
}

export async function callEat<T>(run: (eat: EatCloud) => Promise<CloudResult<T>>): Promise<T> {
  let res: CloudResult<T>
  try {
    res = await run(eatCloud())
  }
  catch (err) {
    const failed = cloudError(err)
    if (!failed)
      throw new EatRequestError('NETWORK', '网络没连上，再试一次')
    keepSession(failed.data)
    throw new EatRequestError(failed.errCode, failed.errMsg, failed.data)
  }
  if (!res || res.errCode !== 0) {
    keepSession(res?.data)
    throw new EatRequestError(res?.errCode ?? 'INTERNAL', res?.errMsg || '这次没有完成，再试一次', res?.data)
  }
  keepSession(res.data)
  return res.data
}

export function weixinLoginCode() {
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success(result) {
        if (result.code)
          resolve(result.code)
        else
          reject(new EatRequestError('WX_LOGIN_FAILED', '微信登录没有成功，再试一次'))
      },
      fail() {
        reject(new EatRequestError('WX_LOGIN_FAILED', '微信登录没有成功，再试一次'))
      },
    })
  })
}

export function dateLabel(date: string, today: string) {
  if (date === today)
    return '今天'
  if (date === shiftDate(today, 1))
    return '明天'
  if (date === shiftDate(today, 2))
    return '后天'
  return date
}

function shiftDate(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function enter() {
  const code = await weixinLoginCode()
  return callEat(eat => eat.enter({ code }))
}

export async function createInvite(role: Role) {
  const code = await weixinLoginCode()
  return callEat(eat => eat.createInvite({ code, role }))
}

export async function refreshInvite() {
  const code = await weixinLoginCode()
  return callEat(eat => eat.refreshInvite({ code }))
}

export async function previewInvite(inviteCode: string) {
  const code = await weixinLoginCode()
  return callEat(eat => eat.previewInvite({ code, inviteCode }))
}

export async function acceptInvite(inviteCode: string, options?: { abandonPending?: boolean }) {
  const code = await weixinLoginCode()
  return callEat(eat => eat.acceptInvite({
    code,
    inviteCode,
    abandonPending: Boolean(options?.abandonPending),
  }))
}

export function me() {
  return callEat(eat => eat.me())
}

export function updateNickname(nickname: string) {
  return callEat(eat => eat.updateNickname({ nickname }))
}

export function unbind() {
  return callEat(eat => eat.unbind())
}

export function listCategories() {
  return callEat(eat => eat.listCategories())
}

export function createCategory(name: string) {
  return callEat(eat => eat.createCategory({ name }))
}

export function renameCategory(categoryId: string, name: string) {
  return callEat(eat => eat.renameCategory({ categoryId, name }))
}

export function deleteCategory(categoryId: string) {
  return callEat(eat => eat.deleteCategory({ categoryId }))
}

export function listDishes(query?: DishQuery) {
  return callEat(eat => eat.listDishes(query))
}

export function getDish(dishId: string) {
  return callEat(eat => eat.getDish({ dishId }))
}

export function publishDish(input: PublishDishInput) {
  return callEat(eat => eat.publishDish(input))
}

export function unpublishDish(dishId: string) {
  return callEat(eat => eat.unpublishDish({ dishId }))
}

export function deleteDish(dishId: string) {
  return callEat(eat => eat.deleteDish({ dishId }))
}

export function listMenu(query?: MenuQuery) {
  return callEat(eat => eat.listMenu(query))
}

export function mealBoard() {
  return callEat(eat => eat.mealBoard())
}

export function createOrder(input: { date: string, slot: Slot, dishIds: string[], note?: string }) {
  return callEat(eat => eat.createOrder(input))
}

export function listTodo() {
  return callEat(eat => eat.listTodo())
}

export function listOrders() {
  return callEat(eat => eat.listOrders())
}

export function getOrder(orderId: string) {
  return callEat(eat => eat.getOrder({ orderId }))
}

export function acceptOrder(orderId: string) {
  return callEat(eat => eat.acceptOrder({ orderId }))
}

export function rejectOrder(orderId: string, note: string) {
  return callEat(eat => eat.rejectOrder({ orderId, note }))
}

export function cancelOrder(orderId: string, note: string) {
  return callEat(eat => eat.cancelOrder({ orderId, note }))
}

export function getCookDish(orderId: string, dishId: string) {
  return callEat(eat => eat.getCookDish({ orderId, dishId }))
}

export function listRecords() {
  return callEat(eat => eat.listRecords())
}

export function createRecord(input: CreateRecordInput) {
  return callEat(eat => eat.createRecord(input))
}

export function updateRecord(input: UpdateRecordInput) {
  return callEat(eat => eat.updateRecord(input))
}

export function deleteRecord(recordId: string) {
  return callEat(eat => eat.deleteRecord({ recordId }))
}

export function badges() {
  return callEat<Badges>(eat => eat.badges())
}
