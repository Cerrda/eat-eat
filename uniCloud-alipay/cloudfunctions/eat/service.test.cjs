/**
 * @vitest-environment node
 */
const { describe, expect, it } = require('vitest')
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
    await expect(fresh.eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: host.inviteCode,
    })).rejects.toMatchObject({ errCode: 'NEED_ABANDON' })
    const joined = await fresh.eat.acceptInvite({
      code: 'wx:openid-eater',
      inviteCode: host.inviteCode,
      abandonPending: true,
    })
    expect(joined.role).toBe('eater')
    expect(joined.partnerNickname).toBe('厨神')
    const dissolved = await fresh.store.find('eat-kitchens', { status: 'dissolved' }, 10)
    expect(dissolved).toHaveLength(1)
    const active = await fresh.store.find('eat-kitchens', { status: 'active' }, 10)
    expect(active).toHaveLength(1)
    expect(active[0].cookerOpenid).toBe('openid-cooker')
    expect(active[0].eaterOpenid).toBe('openid-eater')
  })
})

describe('绑定后的厨房', () => {
  async function kitchen() {
    const ctx = setup()
    const created = await ctx.eat.createInvite({ code: 'wx:openid-cooker', role: 'cooker' })
    await ctx.eat.acceptInvite({ code: 'wx:openid-eater', inviteCode: created.inviteCode })
    return ctx
  }

  it('没封面，或简介和步骤都空着，不能上架', async () => {
    const ctx = await kitchen()
    await ctx.use('openid-cooker')
    await expect(ctx.eat.publishDish({
      name: '番茄炒蛋',
      summary: '家常',
    })).rejects.toMatchObject({ errCode: 'VALIDATION' })
    await expect(ctx.eat.publishDish({
      name: '番茄炒蛋',
      coverFileId: 'cloud://cover',
    })).rejects.toMatchObject({ errCode: 'VALIDATION' })
    await ctx.use('openid-eater')
    await expect(ctx.eat.publishDish({
      name: '番茄炒蛋',
      summary: '家常',
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
      summary: '家常',
      coverFileId: 'cloud://cover',
      ingredients: ['番茄', '蛋'],
      steps: ['先炒蛋'],
      sourceUrl: 'https://example.com/tomato',
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
    expect(cookDish.sourceUrl).toBe('https://example.com/tomato')
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

  it('没有菜的分类可以删，有菜时要先换走', async () => {
    const ctx = await kitchen()
    await ctx.use('openid-cooker')
    const category = await ctx.eat.createCategory({ name: '家常' })
    const empty = await ctx.eat.createCategory({ name: '汤羹' })
    await ctx.eat.publishDish({
      name: '番茄炒蛋',
      categoryId: category.categoryId,
      summary: '家常',
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
