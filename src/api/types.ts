export type Role = 'cooker' | 'eater'
export type Slot = 'morning' | 'noon' | 'evening'
export type OrderStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
export type DishStatus = 'on' | 'off'

export interface CloudOk<T> {
  errCode: 0
  errMsg: string
  data: T
}

export interface CloudFail {
  errCode: string
  errMsg: string
  data?: unknown
}

export type CloudResult<T> = CloudOk<T> | CloudFail

export interface EatPingData {
  ok: true
  now: number
}

export interface Badges {
  todo: number
  orders: number
  records: number
}

export interface AccountView {
  next: 'choose' | 'invite' | 'waiting' | 'confirm' | 'home'
  today: string
  role: Role | ''
  nickname: string
  partnerNickname: string
  partnerRole: Role | ''
  kitchenStatus: 'none' | 'pending' | 'active'
  inviteCode: string
  expiresAt: number
  inviteExpired: boolean
  shareTitle: string
  badges: Badges
}

export interface SessionView extends AccountView {
  token: string
  tokenExpired: number
}

export interface Category {
  categoryId: string
  name: string
}

export interface DishQuery {
  keyword?: string
  categoryId?: string
  status?: DishStatus
}

export interface MenuQuery {
  keyword?: string
  categoryId?: string
}

export interface DishCard {
  dishId: string
  name: string
  categoryId: string
  categoryName: string
  coverFileId: string
  status: DishStatus
}

export interface MenuDish {
  dishId: string
  name: string
  categoryId: string
  categoryName: string
  coverFileId: string
}

export interface DishDetail extends DishCard {
  summary: string
  ingredients: string[]
  steps: string[]
  sourceUrl: string
}

export interface PublishDishInput {
  dishId?: string
  name: string
  categoryId?: string
  summary?: string
  ingredients?: string[] | string
  steps?: string[] | string
  sourceUrl?: string
  coverFileId: string
}

export interface OrderItem {
  dishId: string
  name: string
  coverFileId: string
}

export interface OrderDetail {
  orderId: string
  date: string
  slot: Slot
  status: OrderStatus
  note: string
  rejectNote: string
  cancelNote: string
  cancelledByRole: Role | ''
  items: OrderItem[]
  recorded: boolean
}

export interface MealBoard {
  today: string
  dates: Array<{ date: string, offset: number }>
  busy: Array<{ date: string, slot: Slot, orderId: string, status: 'pending' | 'accepted' }>
}

export interface CookDish {
  dishId: string
  name: string
  coverFileId: string
  ingredients: string[]
  steps: string[]
  sourceUrl: string
}

export interface RecordDish {
  dishId: string
  name: string
}

export interface RecordCard {
  recordId: string
  date: string
  slot: Slot
  text: string
  photoFileIds: string[]
  dishes: RecordDish[]
  orderId: string
}

export interface CreateRecordInput {
  date?: string
  slot?: Slot
  text?: string
  photoFileIds?: string[]
  dishIds?: string[]
  orderId?: string
}

export interface UpdateRecordInput {
  recordId: string
  text?: string
  photoFileIds?: string[]
}

export interface EatCloud {
  ping: () => Promise<CloudResult<EatPingData>>
  enter: (params: { code: string }) => Promise<CloudResult<SessionView>>
  me: () => Promise<CloudResult<AccountView>>
  createInvite: (params: { code: string, role: Role }) => Promise<CloudResult<SessionView>>
  refreshInvite: (params: { code: string }) => Promise<CloudResult<SessionView>>
  previewInvite: (params: { code: string, inviteCode: string }) => Promise<CloudResult<SessionView>>
  acceptInvite: (params: { code: string, inviteCode: string, abandonPending?: boolean }) => Promise<CloudResult<SessionView>>
  updateNickname: (params: { nickname: string }) => Promise<CloudResult<AccountView>>
  unbind: () => Promise<CloudResult<AccountView>>
  listCategories: () => Promise<CloudResult<{ categories: Category[] }>>
  createCategory: (params: { name: string }) => Promise<CloudResult<Category>>
  renameCategory: (params: { categoryId: string, name: string }) => Promise<CloudResult<Category>>
  deleteCategory: (params: { categoryId: string }) => Promise<CloudResult<{ ok: true }>>
  listDishes: (params?: DishQuery) => Promise<CloudResult<{ dishes: DishCard[] }>>
  getDish: (params: { dishId: string }) => Promise<CloudResult<DishDetail>>
  publishDish: (params: PublishDishInput) => Promise<CloudResult<DishDetail>>
  unpublishDish: (params: { dishId: string }) => Promise<CloudResult<DishDetail>>
  deleteDish: (params: { dishId: string }) => Promise<CloudResult<{ ok: true }>>
  listMenu: (params?: MenuQuery) => Promise<CloudResult<{ dishes: MenuDish[] }>>
  mealBoard: () => Promise<CloudResult<MealBoard>>
  createOrder: (params: { date: string, slot: Slot, dishIds: string[], note?: string }) => Promise<CloudResult<OrderDetail>>
  listTodo: () => Promise<CloudResult<{ orders: OrderDetail[] }>>
  listOrders: () => Promise<CloudResult<{ orders: OrderDetail[] }>>
  getOrder: (params: { orderId: string }) => Promise<CloudResult<OrderDetail>>
  acceptOrder: (params: { orderId: string }) => Promise<CloudResult<OrderDetail>>
  rejectOrder: (params: { orderId: string, note: string }) => Promise<CloudResult<OrderDetail>>
  cancelOrder: (params: { orderId: string, note: string }) => Promise<CloudResult<OrderDetail>>
  getCookDish: (params: { orderId: string, dishId: string }) => Promise<CloudResult<CookDish>>
  listRecords: () => Promise<CloudResult<{ records: RecordCard[] }>>
  createRecord: (params: CreateRecordInput) => Promise<CloudResult<RecordCard>>
  updateRecord: (params: UpdateRecordInput) => Promise<CloudResult<RecordCard>>
  deleteRecord: (params: { recordId: string }) => Promise<CloudResult<{ ok: true }>>
  badges: () => Promise<CloudResult<Badges>>
}
