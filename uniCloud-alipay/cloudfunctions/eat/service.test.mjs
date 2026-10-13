/**
 * @vitest-environment node
 */
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { EatError } = require('./lib/errors')
const { createEatService } = require('./lib/service')
const { createMemoryStore } = require('./lib/store')

const HOUR = 60 * 60 * 1000

function setup() {
  const store = createMemoryStore()
  let clock = Date.parse('2026-10-04T02:00:00.000Z')
  const session = { token: '' }
  const eat = createEatService({
    store,
    now: () => clock,
    readToken: () => session.token,
    async exchangeCode(code) {
      const text = String(code || '')
      if (!text.startsWith('wx:'))
        throw new EatError('WX_LOGIN_FAILED', '微信登录没有成功，再试一次')
      return { openid: text.slice(3), unionid: '' }
    },
  })

  return {
    eat,
    store,
    session,
    advance(ms) {
      clock += ms
    },
    async use(openid) {
      const entered = await eat.enter({ code: `wx:${openid}` })
      session.token = entered.token
      return entered
    },
  }
}

describe('邀请码绑定微信 openid', () => {
  it('生成邀请时用登录码换 openid，不接受调用方自己传的 openid', async () => {
    const { eat, store } = setup()
    const created = await eat.createInvite({
      code: 'wx:openid-cooker',
      role: 'cooker',
      openid: 'hacker',
    })

    expect(created.role).toBe('cooker')
    expect(created.nickname).toBe('厨神')
    expect(created.next).toBe('invite')
    expect(created.shareTitle).toBe('来 EatEat，我来做饭，等你点餐。')
    expect(created.inviteCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    expect(JSON.stringify(created)).not.toContain('openid-cooker')

    const kitchens = await store.find('eat-kitchens', {}, 10)
    expect(kitchens).toHaveLength(1)
    expect(kitchens[0].cookerOpenid).toBe('openid-cooker')
    expect(kitchens[0].eaterOpenid).toBe('')
    expect(kitchens[0].status).toBe('pending')
  })

  it('同一个人再选同一边时沿用还有效的邀请码', async () => {
    const { eat } = setup()
    const first = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    const second = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    expect(second.inviteCode).toBe(first.inviteCode)
  })

  it('还没人加入时改选另一边，会放弃原来的空厨房', async () => {
    const { eat } = setup()
    const first = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    const second = await eat.createInvite({ code: 'wx:openid-cooker', role: 'eater' })
    expect(second.role).toBe('eater')
    expect(second.nickname).toBe('食神')
    expect(second.inviteCode).not.toBe(first.inviteCode)
    await expect(eat.previewInvite({
      code: 'wx:openid-eater',
      inviteCode: first.inviteCode,
    })).rejects.toMatchObject({ errCode: 'INVITE_INVALID' })
  })

  it('自己的码回到等待，不会把自己绑成两个人', async () => {
    const { eat, store } = setup()
    const created = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    const preview = await eat.previewInvite({
      code: 'wx:openid-cooker',
      inviteCode: created.inviteCode,
    })
    expect(preview.next).toBe('waiting')
    const accepted = await eat.acceptInvite({
      code: 'wx:openid-cooker',
      inviteCode: created.inviteCode,
    })
    expect(accepted.next).toBe('waiting')
    const kitchens = await store.find('eat-kitchens', { status: 'pending' }, 10)
    expect(kitchens[0].eaterOpenid).toBe('')
  })

  it('使用邀请码时把两个微信 openid 绑到同一间厨房', async () => {
    const { eat, store } = setup()
    const created = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    const preview = await eat.previewInvite({
      code: 'wx:openid-eater',
      inviteCode: created.inviteCode,
    })
    expect(preview.next).toBe('confirm')
    expect(preview.role).toBe('eater')
    expect(preview.partnerRole).toBe('cooker')
    expect(preview.partnerNickname).toBe('厨神')
    expect(preview.needsAbandon).toBe(false)

    const pending = await store.find('eat-kitchens', { status: 'pending' }, 10)
    expect(pending[0].eaterOpenid).toBe('')

    const joined = await eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: created.inviteCode,
    })
    expect(joined.next).toBe('home')
    expect(joined.role).toBe('eater')
    expect(joined.nickname).toBe('食神')
    expect(joined.partnerNickname).toBe('厨神')
    expect(JSON.stringify(joined)).not.toContain('openid-eater')

    const kitchens = await store.find('eat-kitchens', { status: 'active' }, 10)
    expect(kitchens).toHaveLength(1)
    expect(kitchens[0].cookerOpenid).toBe('openid-cooker')
    expect(kitchens[0].eaterOpenid).toBe('openid-eater')

    const invite = await store.find('eat-invites', { code: created.inviteCode }, 1)
    expect(invite[0].status).toBe('used')
    expect(invite[0].usedByOpenid).toBe('openid-eater')
  })

  it('码写错、过期或已刷新时不给对方建厨房', async () => {
    const { eat, store, advance } = setup()
    const created = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await expect(eat.previewInvite({
      code: 'wx:openid-eater',
      inviteCode: 'ZZZZZZ',
    })).rejects.toMatchObject({ errCode: 'INVITE_INVALID' })

    advance(48 * HOUR + 1)
    await expect(eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: created.inviteCode,
    })).rejects.toMatchObject({ errCode: 'INVITE_INVALID' })
    expect(await store.find('eat-kitchens', {}, 10)).toHaveLength(1)

    const refreshed = await eat.refreshInvite({ code: 'wx:openid-cooker' })
    expect(refreshed.inviteCode).not.toBe(created.inviteCode)
    await expect(eat.previewInvite({
      code: 'wx:openid-eater',
      inviteCode: created.inviteCode,
    })).rejects.toMatchObject({ errCode: 'INVITE_INVALID' })
    const joined = await eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: refreshed.inviteCode,
    })
    expect(joined.role).toBe('eater')
  })

  it('已经有厨房时不能改绑；自己还有空厨房时要先确认放弃', async () => {
    const { eat } = setup()
    const created = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await eat.acceptInvite({ code: 'wx:openid-eater', inviteCode: created.inviteCode })
    const other = await eat.createInvite({ code: 'wx:openid-other', role: 'cooker' })
    await expect(eat.previewInvite({
      code: 'wx:openid-cooker',
      inviteCode: other.inviteCode,
    })).rejects.toMatchObject({ errCode: 'ALREADY_BOUND' })

    const fresh = setup()
    const host = await fresh.eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await fresh.eat.createInvite({ code: 'wx:openid-eater', role: 'eater' })
    const preview = await fresh.eat.previewInvite({
      code: 'wx:openid-eater',
      inviteCode: host.inviteCode,
    })
    expect(preview.next).toBe('confirm')
    expect(preview.role).toBe('eater')
    expect(preview.needsAbandon).toBe(true)
    await expect(fresh.eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: host.inviteCode,
    })).rejects.toMatchObject({ errCode: 'NEED_ABANDON' })
    const joined = await fresh.eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: host.inviteCode,
      abandonPending: true,
    })
    expect(joined.next).toBe('home')
    expect(joined.role).toBe('eater')
    expect(joined.partnerNickname).toBe('厨神')
    const dissolved = await fresh.store.find('eat-kitchens', { status: 'dissolved' }, 10)
    expect(dissolved).toHaveLength(1)
    const active = await fresh.store.find('eat-kitchens', { status: 'active' }, 10)
    expect(active).toHaveLength(1)
    expect(active[0].cookerOpenid).toBe('openid-cooker')
    expect(active[0].eaterOpenid).toBe('openid-eater')
  })

  it('谁填邀请码，没改过的称呼都按自己的角色', async () => {
    const cookerHosts = setup()
    const cookerInvite = await cookerHosts.eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    const eaterJoined = await cookerHosts.eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: cookerInvite.inviteCode,
    })
    expect(eaterJoined.nickname).toBe('食神')
    expect(eaterJoined.partnerNickname).toBe('厨神')
    await cookerHosts.use('openid-cooker')
    const cooker = await cookerHosts.eat.me()
    expect(cooker.nickname).toBe('厨神')
    expect(cooker.partnerNickname).toBe('食神')

    const eaterHosts = setup()
    const eaterInvite = await eaterHosts.eat.createInvite({ code: 'wx:openid-eater', role: 'eater' })
    const cookerJoined = await eaterHosts.eat.acceptInvite({
      code: 'wx:openid-cooker',
      inviteCode: eaterInvite.inviteCode,
    })
    expect(cookerJoined.role).toBe('cooker')
    expect(cookerJoined.nickname).toBe('厨神')
    expect(cookerJoined.partnerNickname).toBe('食神')
    await eaterHosts.use('openid-eater')
    const eater = await eaterHosts.eat.me()
    expect(eater.nickname).toBe('食神')
    expect(eater.partnerNickname).toBe('厨神')
  })

  it('填码的人先前选过同一边，加入后仍改成自己这一边', async () => {
    const { eat, use } = setup()
    const host = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await eat.createInvite({ code: 'wx:openid-eater', role: 'cooker' })
    const joined = await eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: host.inviteCode,
      abandonPending: true,
    })
    expect(joined.role).toBe('eater')
    expect(joined.nickname).toBe('食神')
    expect(joined.partnerNickname).toBe('厨神')
    await use('openid-cooker')
    const cooker = await eat.me()
    expect(cooker.nickname).toBe('厨神')
    expect(cooker.partnerNickname).toBe('食神')
  })

  it('两边都被写成同一个人的称呼时，按角色改回来', async () => {
    const { eat, store, use } = setup()
    const created = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await eat.acceptInvite({ code: 'wx:openid-eater', inviteCode: created.inviteCode })
    await store.update('eat-users', { openid: 'openid-cooker' }, { nickname: '食神', nicknameCustom: false })
    await store.update('eat-users', { openid: 'openid-eater' }, { nickname: '食神', nicknameCustom: false })

    await use('openid-cooker')
    const cooker = await eat.me()
    expect(cooker.nickname).toBe('厨神')
    expect(cooker.partnerNickname).toBe('食神')
    await use('openid-eater')
    const eater = await eat.me()
    expect(eater.nickname).toBe('食神')
    expect(eater.partnerNickname).toBe('厨神')

    const users = await store.find('eat-users', {}, 10)
    expect(users.find(user => user.openid === 'openid-cooker').nickname).toBe('厨神')
    expect(users.find(user => user.openid === 'openid-eater').nickname).toBe('食神')
  })

  it('自己改过的称呼不会被角色默认值盖掉', async () => {
    const { eat, use } = setup()
    const created = await eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await eat.acceptInvite({ code: 'wx:openid-eater', inviteCode: created.inviteCode })
    await use('openid-cooker')
    await eat.updateNickname({ nickname: '阿明' })
    await use('openid-eater')
    const eater = await eat.me()
    expect(eater.nickname).toBe('食神')
    expect(eater.partnerNickname).toBe('阿明')
  })
})

describe('绑定后的厨房', () => {
  async function kitchen() {
    const ctx = setup()
    const created = await ctx.eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await ctx.eat.acceptInvite({ code: 'wx:openid-eater', inviteCode: created.inviteCode })
    return ctx
  }

  it('没封面不能上架', async () => {
    const ctx = await kitchen()
    await ctx.use('openid-cooker')
    await expect(ctx.eat.publishDish({
      name: '番茄炒蛋',
    })).rejects.toMatchObject({ errCode: 'VALIDATION' })
    const dish = await ctx.eat.publishDish({
      name: '番茄炒蛋',
      coverFileId: 'cloud://cover',
    })
    expect(dish.name).toBe('番茄炒蛋')
    expect(dish.summary).toBeUndefined()
    await ctx.use('openid-eater')
    await expect(ctx.eat.publishDish({
      name: '番茄炒蛋',
      coverFileId: 'cloud://cover',
    })).rejects.toMatchObject({ errCode: 'FORBIDDEN' })
  })

  it('点餐、接单、拒绝和记录都按角色走', async () => {
    const ctx = await kitchen()
    await ctx.use('openid-cooker')
    const category = await ctx.eat.createCategory({ name: '家常' })
    const dish = await ctx.eat.publishDish({
      name: '番茄炒蛋',
      categoryId: category.categoryId,
      coverFileId: 'cloud://cover',
      ingredients: ['番茄', '蛋'],
      steps: ['先炒蛋'],
      sourceUrl: '3.21 复制打开抖音，看看【番茄炒蛋】https://v.douyin.com/abc/',
    })
    const board = await ctx.eat.mealBoard()
    await ctx.use('openid-eater')
    const menu = await ctx.eat.listMenu({})
    expect(menu.dishes.map(item => item.name)).toEqual(['番茄炒蛋'])
    expect(menu.dishes[0].sourceUrl).toBeUndefined()

    const order = await ctx.eat.createOrder({
      date: board.today,
      slot: 'evening',
      dishIds: [dish.dishId],
      note: '少盐',
    })
    expect(order.status).toBe('pending')
    await expect(ctx.eat.createOrder({
      date: board.today,
      slot: 'evening',
      dishIds: [dish.dishId],
    })).rejects.toMatchObject({ errCode: 'SLOT_TAKEN' })
    await expect(ctx.eat.createOrder({
      date: '2020-01-01',
      slot: 'noon',
      dishIds: [dish.dishId],
    })).rejects.toMatchObject({ errCode: 'VALIDATION' })

    await ctx.use('openid-cooker')
    expect((await ctx.eat.badges()).todo).toBe(1)
    await expect(ctx.eat.rejectOrder({ orderId: order.orderId, note: '' })).rejects.toMatchObject({
      errCode: 'VALIDATION',
    })
    await expect(ctx.eat.deleteDish({ dishId: dish.dishId })).rejects.toMatchObject({
      errCode: 'VALIDATION',
    })
    const cookDish = await ctx.eat.getCookDish({ orderId: order.orderId, dishId: dish.dishId })
    expect(cookDish.sourceUrl).toBe('3.21 复制打开抖音，看看【番茄炒蛋】https://v.douyin.com/abc/')
    expect(cookDish.ingredients).toEqual(['番茄', '蛋'])
    const accepted = await ctx.eat.acceptOrder({ orderId: order.orderId })
    expect(accepted.status).toBe('accepted')

    await ctx.use('openid-eater')
    expect((await ctx.eat.badges()).orders).toBe(1)
    await ctx.eat.listOrders()
    expect((await ctx.eat.badges()).orders).toBe(0)
    await expect(ctx.eat.getCookDish({
      orderId: order.orderId,
      dishId: dish.dishId,
    })).rejects.toMatchObject({ errCode: 'FORBIDDEN' })
    const noted = await ctx.eat.createRecord({
      date: board.today,
      slot: 'noon',
      text: '我也记下',
    })
    expect(noted.text).toBe('我也记下')

    await ctx.use('openid-cooker')
    expect((await ctx.eat.badges()).records).toBe(1)
    await expect(ctx.eat.createRecord({
      date: board.today,
      slot: 'evening',
    })).rejects.toMatchObject({ errCode: 'VALIDATION' })
    const record = await ctx.eat.createRecord({
      orderId: order.orderId,
      text: '吃完了',
      photoFileIds: ['cloud://photo'],
    })
    expect(record.date).toBe(board.today)
    expect(record.slot).toBe('evening')
    await expect(ctx.eat.createRecord({
      orderId: order.orderId,
      text: '再记一次',
    })).rejects.toMatchObject({ errCode: 'VALIDATION' })

    await ctx.use('openid-eater')
    expect((await ctx.eat.badges()).records).toBe(1)
    const records = await ctx.eat.listRecords()
    expect(records.records).toHaveLength(2)
    expect((await ctx.eat.badges()).records).toBe(0)

    await ctx.use('openid-cooker')
    await ctx.eat.unbind()
    await expect(ctx.eat.listDishes({})).rejects.toMatchObject({ errCode: 'NO_KITCHEN' })
    const eater = await ctx.store.find('eat-users', { openid: 'openid-eater' }, 1)
    expect(eater[0].kitchenId).toBe('')
    expect(eater[0].role).toBe('')
    expect(await ctx.store.find('eat-dishes', {}, 10)).toHaveLength(1)
    expect(await ctx.store.find('eat-orders', {}, 10)).toHaveLength(1)
  })

  it('同一对人再次绑定时回到原来的厨房，并带回分开过的内容', async () => {
    const ctx = await kitchen()
    const original = await ctx.store.find('eat-kitchens', { status: 'active' }, 5)
    await ctx.use('openid-cooker')
    const category = await ctx.eat.createCategory({ name: '家常' })
    const dish = await ctx.eat.publishDish({
      name: '番茄炒蛋',
      categoryId: category.categoryId,
      coverFileId: 'cloud://cover',
    })
    const board = await ctx.eat.mealBoard()
    await ctx.use('openid-eater')
    const order = await ctx.eat.createOrder({
      date: board.today,
      slot: 'evening',
      dishIds: [dish.dishId],
    })
    await ctx.eat.createRecord({
      date: board.today,
      slot: 'noon',
      text: '原来的记录',
    })
    await ctx.use('openid-cooker')
    await ctx.eat.unbind()

    const earlier = await ctx.store.find('eat-kitchens', { status: 'dissolved' }, 5)
    const olderId = await ctx.store.insert('eat-kitchens', {
      status: 'dissolved',
      cookerOpenid: 'openid-eater',
      eaterOpenid: 'openid-cooker',
      cookerUserId: '',
      eaterUserId: '',
      createdAt: 1,
      updatedAt: 1,
      boundAt: 1,
      dissolvedAt: earlier[0].dissolvedAt - 1,
    })
    const earlierCategory = await ctx.store.insert('eat-categories', {
      kitchenId: olderId,
      name: '家常',
      createdAt: 1,
    })
    await ctx.store.insert('eat-dishes', {
      kitchenId: olderId,
      name: '更早的汤',
      categoryId: earlierCategory,
      coverFileId: 'cloud://soup',
      status: 'on',
      deleted: false,
      publishedAt: 1,
      updatedAt: 1,
    })

    const side = await ctx.eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await ctx.eat.acceptInvite({ code: 'wx:openid-other', inviteCode: side.inviteCode })
    await ctx.use('openid-cooker')
    await ctx.eat.publishDish({ name: '别人的菜', coverFileId: 'cloud://other' })
    await ctx.eat.unbind()

    const again = await ctx.eat.createInvite({ code: 'wx:openid-eater', role: 'cooker' })
    const rejoined = await ctx.eat.acceptInvite({ code: 'wx:openid-cooker', inviteCode: again.inviteCode })
    expect(rejoined.next).toBe('home')
    expect(rejoined.role).toBe('eater')
    expect(rejoined.nickname).toBe('食神')
    expect(rejoined.partnerNickname).toBe('厨神')

    await ctx.use('openid-eater')
    const dishes = await ctx.eat.listDishes({})
    expect(dishes.dishes.map(item => item.name).sort()).toEqual(['更早的汤', '番茄炒蛋'])
    const categories = await ctx.eat.listCategories()
    expect(categories.categories.map(item => item.name)).toEqual(['家常'])
    const soup = dishes.dishes.find(item => item.name === '更早的汤')
    expect(soup.categoryName).toBe('家常')

    await ctx.use('openid-cooker')
    const orders = await ctx.eat.listOrders()
    expect(orders.orders.map(item => item.orderId)).toContain(order.orderId)
    const records = await ctx.eat.listRecords()
    expect(records.records.some(item => item.text === '原来的记录')).toBe(true)

    const active = await ctx.store.find('eat-kitchens', { status: 'active' }, 10)
    expect(active).toHaveLength(1)
    expect(active[0]._id).toBe(original[0]._id)
    expect(active[0].cookerOpenid).toBe('openid-eater')
    expect(active[0].eaterOpenid).toBe('openid-cooker')
    const otherDishes = await ctx.store.find('eat-dishes', { name: '别人的菜' }, 5)
    expect(otherDishes[0].kitchenId).not.toBe(active[0]._id)
  })

  it('没有菜的分类可以删，有菜时要先换走', async () => {
    const ctx = await kitchen()
    await ctx.use('openid-cooker')
    const category = await ctx.eat.createCategory({ name: '家常' })
    const empty = await ctx.eat.createCategory({ name: '汤羹' })
    await ctx.eat.publishDish({
      name: '番茄炒蛋',
      categoryId: category.categoryId,
      coverFileId: 'cloud://cover',
    })
    await expect(ctx.eat.deleteCategory({ categoryId: category.categoryId })).rejects.toMatchObject({
      errCode: 'VALIDATION',
    })
    await ctx.eat.deleteCategory({ categoryId: empty.categoryId })
    const listed = await ctx.eat.listCategories()
    expect(listed.categories.map(item => item.name)).toEqual(['家常'])
  })
})

describe('批量新增菜品', () => {
  async function bindPair(eat, cooker, eater) {
    const created = await eat.createInvite({ code: `wx:${cooker}`, role: 'cooker' })
    await eat.acceptInvite({ code: `wx:${eater}`, inviteCode: created.inviteCode })
  }

  it('只列出已绑定的厨房，并用双方现在的称呼', async () => {
    const ctx = setup()
    await bindPair(ctx.eat, 'openid-cooker', 'openid-eater')
    await ctx.eat.createInvite({ code: 'wx:openid-waiting', role: 'cooker' })
    await ctx.use('openid-cooker')
    await ctx.eat.updateNickname({ nickname: '阿明' })
    await ctx.use('openid-eater')
    await ctx.eat.updateNickname({ nickname: '阿花' })

    const listed = await ctx.eat.batchDishes({ action: 'kitchens' })
    expect(listed.kitchens).toHaveLength(1)
    expect(listed.kitchens[0].cookerName).toBe('阿明')
    expect(listed.kitchens[0].eaterName).toBe('阿花')
    expect(JSON.stringify(listed)).not.toContain('openid')
    const kitchens = await ctx.store.find('eat-kitchens', { status: 'active' }, 5)
    expect(listed.kitchens[0].kitchenId).toBe(kitchens[0]._id)
  })

  it('按分类名补分类，同名菜跳过', async () => {
    const ctx = setup()
    await bindPair(ctx.eat, 'openid-cooker', 'openid-eater')
    const kitchenId = (await ctx.store.find('eat-kitchens', { status: 'active' }, 1))[0]._id
    const dish = {
      name: '番茄炒蛋',
      category: '家常',
      ingredients: ['番茄 2 个', '鸡蛋 3 个'],
      steps: ['先炒蛋', '再炒番茄'],
      sourceUrl: 'https://example.com/tomato',
      coverFileId: 'cloud://cover',
    }

    const imported = await ctx.eat.batchDishes({
      action: 'import',
      kitchenIds: [kitchenId],
      dishes: [dish, { ...dish, name: '番茄炒蛋' }, { ...dish, name: '青菜汤', ingredients: ['青菜'], steps: [] }],
    })
    expect(imported.kitchens[0].created).toEqual(['番茄炒蛋', '青菜汤'])
    expect(imported.kitchens[0].skipped).toEqual(['番茄炒蛋'])
    expect(imported.kitchens[0].cookerName).toBe('厨神')
    expect(imported.kitchens[0].eaterName).toBe('食神')

    const categories = await ctx.store.find('eat-categories', { kitchenId }, 10)
    expect(categories.map(item => item.name)).toEqual(['家常'])
    const dishes = await ctx.store.find('eat-dishes', { kitchenId, deleted: false }, 10)
    expect(dishes).toHaveLength(2)
    const egg = dishes.find(item => item.name === '番茄炒蛋')
    expect(egg.categoryId).toBe(categories[0]._id)
    expect(egg.ingredients).toEqual(['番茄 2 个', '鸡蛋 3 个'])
    expect(egg.steps).toEqual(['先炒蛋', '再炒番茄'])
    expect(egg.sourceUrl).toBe('https://example.com/tomato')
    expect(egg.coverFileId).toBe('cloud://cover')
    expect(egg.status).toBe('on')

    const again = await ctx.eat.batchDishes({
      action: 'import',
      kitchenIds: [kitchenId, 'missing'],
      dishes: [{ name: '番茄炒蛋', category: '家常', ingredients: [], steps: [], coverFileId: 'cloud://cover' }],
    })
    expect(again.kitchens[0].created).toEqual([])
    expect(again.kitchens[0].skipped).toEqual(['番茄炒蛋'])
    expect(again.kitchens[1].error).toBe('这间厨房还没有绑定')
    expect(await ctx.store.find('eat-categories', { kitchenId }, 10)).toHaveLength(1)
  })

  it('列表默认一页 10 条，下一页接着给', async () => {
    const ctx = setup()
    await bindPair(ctx.eat, 'openid-cooker', 'openid-eater')
    await ctx.use('openid-cooker')
    const category = await ctx.eat.createCategory({ name: '家常' })
    for (let index = 0; index < 12; index += 1) {
      ctx.advance(1)
      await ctx.eat.publishDish({
        name: `菜${String(index).padStart(2, '0')}`,
        categoryId: index < 2 ? category.categoryId : '',
        coverFileId: 'cloud://cover',
      })
    }

    const first = await ctx.eat.listDishes({})
    expect(first.page).toBe(1)
    expect(first.pageSize).toBe(10)
    expect(first.total).toBe(12)
    expect(first.dishes).toHaveLength(10)
    expect(first.dishes[0].name).toBe('菜11')

    const second = await ctx.eat.listDishes({ page: 2 })
    expect(second.dishes.map(item => item.name)).toEqual(['菜01', '菜00'])
    expect(second.total).toBe(12)

    const named = await ctx.eat.listDishes({ keyword: '菜1' })
    expect(named.total).toBe(2)
    expect(named.dishes.map(item => item.name).sort()).toEqual(['菜10', '菜11'])

    const wide = await ctx.eat.listDishes({ pageSize: 1000 })
    expect(wide.pageSize).toBe(50)
    expect(wide.dishes).toHaveLength(12)

    const categories = await ctx.eat.listCategories()
    expect(categories.categories.find(item => item.name === '家常').count).toBe(2)

    await ctx.use('openid-eater')
    const menu = await ctx.eat.listMenu({})
    expect(menu.total).toBe(12)
    expect(menu.dishes).toHaveLength(10)
    expect(menu.menuTotal).toBe(12)
    const filtered = await ctx.eat.listMenu({ keyword: '菜1', page: 1 })
    expect(filtered.total).toBe(2)
    expect(filtered.menuTotal).toBe(12)

    const board = await ctx.eat.mealBoard()
    await ctx.eat.createOrder({
      date: board.today,
      slot: 'noon',
      dishIds: [menu.dishes[0].dishId],
    })
    for (let index = 0; index < 11; index += 1) {
      await ctx.eat.createRecord({
        date: `2026-01-${String(index + 1).padStart(2, '0')}`,
        slot: 'noon',
        text: `记${String(index).padStart(2, '0')}`,
      })
    }
    const records = await ctx.eat.listRecords({})
    expect(records.total).toBe(11)
    expect(records.records).toHaveLength(10)
    expect(records.records[0].text).toBe('记10')
    const rest = await ctx.eat.listRecords({ page: 2 })
    expect(rest.records).toHaveLength(1)
    const one = await ctx.eat.getRecord({ recordId: rest.records[0].recordId })
    expect(one.text).toBe(rest.records[0].text)

    const kitchenId = (await ctx.store.find('eat-kitchens', { status: 'active' }, 1))[0]._id
    for (let index = 0; index < 12; index += 1) {
      await ctx.store.insert('eat-orders', {
        kitchenId,
        date: `2026-03-${String(index + 1).padStart(2, '0')}`,
        slot: 'evening',
        status: 'pending',
        note: '',
        items: [],
        eaterUnread: false,
      })
    }
    const orders = await ctx.eat.listOrders({ page: 1 })
    expect(orders.total).toBe(13)
    expect(orders.orders).toHaveLength(10)
    const ordersNext = await ctx.eat.listOrders({ page: 2 })
    expect(ordersNext.orders).toHaveLength(3)

    await ctx.use('openid-cooker')
    const todo = await ctx.eat.listTodo({ page: 1 })
    expect(todo.total).toBe(13)
    expect(todo.orders).toHaveLength(10)
    const todoNext = await ctx.eat.listTodo({ page: 2 })
    expect(todoNext.orders).toHaveLength(3)
  })

  it('超过 1000 条时仍能取到后面的页', async () => {
    const ctx = setup()
    await bindPair(ctx.eat, 'openid-cooker', 'openid-eater')
    await ctx.use('openid-cooker')
    const kitchenId = (await ctx.store.find('eat-kitchens', { status: 'active' }, 1))[0]._id
    for (let index = 0; index < 1005; index += 1) {
      await ctx.store.insert('eat-dishes', {
        kitchenId,
        name: `量${String(index).padStart(4, '0')}`,
        categoryId: '',
        coverFileId: 'cloud://cover',
        status: 'on',
        deleted: false,
        publishedAt: index,
        updatedAt: index,
      })
    }
    const page = await ctx.eat.listDishes({ page: 101 })
    expect(page.total).toBe(1005)
    expect(page.dishes.map(item => item.name)).toEqual(['量0004', '量0003', '量0002', '量0001', '量0000'])

    const named = await ctx.eat.listMenuNames()
    expect(named.names).toHaveLength(1005)
    expect(named.names[0].name).toBe('量1004')
    expect(named.names[100].name).toBe('量0904')
    expect(named.names[40].name).toBe('量0964')
    expect(named.names[0]).toEqual({
      dishId: named.names[0].dishId,
      name: '量1004',
      coverFileId: 'cloud://cover',
    })

    const first = await ctx.eat.listMenu({})
    expect(first.pageSize).toBe(10)
    expect(first.dishes.map(item => item.name)).toEqual(named.names.slice(0, 10).map(item => item.name))

    const window = await ctx.eat.listMenu({ offset: 20, pageSize: 30 })
    expect(window.pageSize).toBe(30)
    expect(window.total).toBe(1005)
    expect(window.dishes.map(item => item.name)).toEqual(named.names.slice(20, 50).map(item => item.name))
    expect(window.dishes[20].name).toBe('量0964')
    expect(window.dishes.map(item => item.name)).not.toContain('量1004')

    const capped = await ctx.eat.listMenu({ pageSize: 1000 })
    expect(capped.pageSize).toBe(50)
    expect(capped.dishes).toHaveLength(50)
  })

  it('随机只拿已上架菜名，不含用料、下架和别的厨房', async () => {
    const ctx = setup()
    await bindPair(ctx.eat, 'openid-cooker', 'openid-eater')
    await ctx.use('openid-cooker')
    ctx.advance(1)
    const egg = await ctx.eat.publishDish({
      name: '番茄炒蛋',
      coverFileId: 'cloud://cover',
      ingredients: ['秘密用料XYZ'],
      steps: ['炒一下'],
    })
    ctx.advance(1)
    await ctx.eat.publishDish({
      name: '青菜',
      coverFileId: 'cloud://greens',
    })
    const kitchenId = (await ctx.store.find('eat-kitchens', { status: 'active' }, 1))[0]._id
    await ctx.store.insert('eat-dishes', {
      kitchenId,
      name: '未上架',
      coverFileId: 'cloud://off',
      status: 'off',
      deleted: false,
      publishedAt: 9,
    })
    await ctx.store.insert('eat-dishes', {
      kitchenId,
      name: '已删',
      coverFileId: 'cloud://gone',
      status: 'on',
      deleted: true,
      publishedAt: 8,
    })
    await ctx.store.insert('eat-dishes', {
      kitchenId: 'other',
      name: '别人的',
      coverFileId: 'cloud://other',
      status: 'on',
      deleted: false,
      publishedAt: 99,
    })

    await ctx.use('openid-eater')
    const named = await ctx.eat.listMenuNames()
    expect(named.names).toEqual([
      { dishId: expect.any(String), name: '青菜', coverFileId: 'cloud://greens' },
      { dishId: egg.dishId, name: '番茄炒蛋', coverFileId: 'cloud://cover' },
    ])
    const packed = JSON.stringify(named)
    expect(packed).not.toContain('秘密用料XYZ')
    expect(packed).not.toContain('炒一下')
    expect(packed).not.toContain('未上架')
    expect(packed).not.toContain('已删')
    expect(packed).not.toContain('别人的')
  })
})
