const crypto = require('node:crypto')
const { EatError } = require('./errors')

const ROLES = ['cooker', 'eater']
const SLOTS = ['morning', 'noon', 'evening']
const SLOT_ORDER = { morning: 0, noon: 1, evening: 2 }
const DEFAULT_NICKNAME = { cooker: '厨神', eater: '食神' }
const SHARE_TITLE = {
  cooker: '来 EatEat，我来做饭，等你点餐。',
  eater: '来 EatEat，我来点餐，等你做饭。',
}
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITE_TTL = 48 * 60 * 60 * 1000
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000
const INVALID_MSG = '过期了，或写错了。请对方重新转发。这里不会创建一间空厨房。'
const ALREADY_MSG = '你已经有厨房。一个人只能待在一间厨房里。这条邀请不会切换，也不会覆盖现在这间。'
const ABANDON_MSG = '接受后，这间空厨房会被放弃。'

function textLen(value) {
  return Array.from(value).length
}

function input(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params))
    return {}
  return params
}

function otherRole(role) {
  return role === 'cooker' ? 'eater' : 'cooker'
}

function formatShanghai(ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms))
  const pick = type => parts.find(part => part.type === type)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

function addCalendarDays(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isRealDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd))
    return false
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function createInviteCode() {
  const bytes = crypto.randomBytes(6)
  let code = ''
  for (let index = 0; index < 6; index += 1)
    code += INVITE_ALPHABET[bytes[index] % INVITE_ALPHABET.length]
  return code
}

function normalizeInviteCode(value) {
  const code = String(value || '').trim().toUpperCase()
  if (!new RegExp(`^[${INVITE_ALPHABET}]{6}$`).test(code))
    return ''
  return code
}

function issueToken() {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, tokenHash }
}

function emptyBadges() {
  return { todo: 0, orders: 0, records: 0 }
}

function normalizeFileId(value, message) {
  const id = String(value || '').trim()
  if (!id || id.length > 400 || /[\r\n]/.test(id))
    throw new EatError('VALIDATION', message)
  return id
}

function normalizeUrl(value) {
  const url = String(value || '').trim()
  if (!url)
    return ''
  if (textLen(url) > 500)
    throw new EatError('VALIDATION', '来源链接太长了')
  return url
}

function asLines(value, maxLines, maxLen, tooLong, tooMany) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/\r?\n/)
  const lines = []
  for (const item of raw) {
    const text = String(item ?? '').trim()
    if (!text)
      continue
    if (textLen(text) > maxLen)
      throw new EatError('VALIDATION', tooLong)
    lines.push(text)
  }
  if (lines.length > maxLines)
    throw new EatError('VALIDATION', tooMany)
  return lines
}

function requireSentence(value) {
  const text = String(value || '').trim()
  if (!text)
    throw new EatError('VALIDATION', '请留下一句话')
  if (textLen(text) > 40)
    throw new EatError('VALIDATION', '这句话最多 40 个字')
  return text
}

function normalizeCategoryName(value) {
  const name = String(value || '').trim()
  if (textLen(name) < 1 || textLen(name) > 6)
    throw new EatError('VALIDATION', '分类要 1 到 6 个字')
  return name
}

function normalizeDishName(value) {
  const name = String(value || '').trim()
  if (!name)
    throw new EatError('VALIDATION', '还缺菜名')
  if (textLen(name) > 20)
    throw new EatError('VALIDATION', '菜名最多 20 个字')
  return name
}

function normalizeRecordText(value) {
  const text = String(value || '').trim()
  if (textLen(text) > 300)
    throw new EatError('VALIDATION', '文字最多 300 个字')
  return text
}

function normalizePhotos(value) {
  if (value == null)
    return []
  if (!Array.isArray(value) || value.length > 9)
    throw new EatError('VALIDATION', '照片最多 9 张')
  return value.map(item => normalizeFileId(item, '这张图没有传上来'))
}

function createEatService(deps) {
  const store = deps.store
  const now = deps.now
  const exchangeCode = deps.exchangeCode
  const readToken = deps.readToken

  async function findOne(name, query) {
    const rows = await store.find(name, query, 1)
    return rows[0] || null
  }

  async function reload(userId) {
    const user = await findOne('eat-users', { _id: userId })
    if (!user)
      throw new EatError('NOT_LOGIN', '登录过期了，再试一次')
    return user
  }

  function todayString() {
    return formatShanghai(now())
  }

  function upcomingDates() {
    const today = todayString()
    return [0, 1, 2].map(offset => ({
      date: addCalendarDays(today, offset),
      offset,
    }))
  }

  async function login(code) {
    const wxCode = String(code || '').trim()
    if (!wxCode)
      throw new EatError('WX_LOGIN_FAILED', '微信登录没有成功，再试一次')

    let wx
    try {
      wx = await exchangeCode(wxCode)
    }
    catch (err) {
      if (err && err.eat)
        throw err
      throw new EatError('WX_LOGIN_FAILED', '微信登录没有成功，再试一次')
    }

    const openid = String(wx?.openid || '')
    if (!openid)
      throw new EatError('WX_LOGIN_FAILED', '微信登录没有成功，再试一次')

    let user = await findOne('eat-users', { openid })
    if (!user) {
      const userId = await store.insert('eat-users', {
        openid,
        unionid: wx.unionid || '',
        nickname: '',
        nicknameCustom: false,
        role: '',
        kitchenId: '',
        createdAt: now(),
        updatedAt: now(),
      })
      user = await reload(userId)
    }
    else if (wx.unionid && wx.unionid !== user.unionid) {
      await store.update('eat-users', { _id: user._id }, {
        unionid: wx.unionid,
        updatedAt: now(),
      })
      user = await reload(user._id)
    }

    const { token, tokenHash } = issueToken()
    const tokenExpired = now() + TOKEN_TTL
    await store.insert('eat-sessions', {
      tokenHash,
      userId: user._id,
      expireAt: tokenExpired,
      createdAt: now(),
    })
    return { user, token, tokenExpired }
  }

  async function requireUser() {
    const token = String(readToken() || '')
    if (!token)
      throw new EatError('NOT_LOGIN', '登录过期了，再试一次')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const session = await findOne('eat-sessions', { tokenHash })
    if (!session || session.expireAt <= now())
      throw new EatError('NOT_LOGIN', '登录过期了，再试一次')
    return reload(session.userId)
  }

  async function loadKitchen(user) {
    if (!user.kitchenId)
      return null
    const kitchen = await findOne('eat-kitchens', { _id: user.kitchenId })
    if (!kitchen || kitchen.status === 'dissolved') {
      await store.update('eat-users', { _id: user._id, kitchenId: user.kitchenId }, {
        kitchenId: '',
        role: '',
        updatedAt: now(),
      })
      user.kitchenId = ''
      user.role = ''
      return null
    }
    return kitchen
  }

  async function requireActive(user) {
    const kitchen = await loadKitchen(user)
    if (!kitchen || kitchen.status !== 'active')
      throw new EatError('NO_KITCHEN', '还没有厨房')
    return kitchen
  }

  function requireRole(user, role) {
    if (user.role !== role)
      throw new EatError('FORBIDDEN', '这一边不能做这件事')
  }

  function isMember(kitchen, user) {
    return Boolean(user.openid) && (kitchen.cookerOpenid === user.openid || kitchen.eaterOpenid === user.openid)
  }

  async function latestInvite(kitchenId) {
    const rows = await store.find('eat-invites', { kitchenId, status: 'active' }, 5)
    rows.sort((a, b) => b.createdAt - a.createdAt)
    return rows[0] || null
  }

  async function insertInvite(kitchen, user, role) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = createInviteCode()
      const exists = await findOne('eat-invites', { code })
      if (exists)
        continue
      const expireAt = now() + INVITE_TTL
      await store.insert('eat-invites', {
        code,
        kitchenId: kitchen._id,
        creatorOpenid: user.openid,
        creatorRole: role,
        status: 'active',
        expireAt,
        createdAt: now(),
        usedByOpenid: '',
        usedAt: 0,
      })
      return { code, expireAt }
    }
    throw new EatError('INTERNAL', '这次没有完成，再试一次')
  }

  async function ensureInvite(kitchen, user, role) {
    const current = await latestInvite(kitchen._id)
    if (current && current.expireAt > now())
      return current
    await store.update('eat-invites', { kitchenId: kitchen._id, status: 'active' }, { status: 'revoked' })
    return insertInvite(kitchen, user, role)
  }

  async function partnerOf(kitchen, user) {
    const openid = user.openid === kitchen.cookerOpenid ? kitchen.eaterOpenid : kitchen.cookerOpenid
    if (!openid)
      return null
    return findOne('eat-users', { openid })
  }

  async function badgesFor(user, kitchen) {
    const orders = await store.find('eat-orders', { kitchenId: kitchen._id }, 500)
    const records = await store.find('eat-records', { kitchenId: kitchen._id, deleted: false }, 500)
    return {
      todo: user.role === 'cooker' ? orders.filter(order => order.status === 'pending').length : 0,
      orders: user.role === 'eater' ? orders.filter(order => order.eaterUnread).length : 0,
      records: records.filter(record => user.role === 'cooker' ? record.unreadCooker : record.unreadEater).length,
    }
  }

  async function accountView(user) {
    const today = todayString()
    const kitchen = await loadKitchen(user)
    const fresh = kitchen ? user : await reload(user._id)
    const base = {
      today,
      role: fresh.role || '',
      nickname: fresh.nickname || '',
      partnerNickname: '',
      partnerRole: '',
      inviteCode: '',
      expiresAt: 0,
      inviteExpired: false,
      shareTitle: '',
      badges: emptyBadges(),
    }
    if (!kitchen) {
      return {
        ...base,
        next: 'choose',
        role: '',
        kitchenStatus: 'none',
      }
    }
    if (kitchen.status === 'pending') {
      const invite = await latestInvite(kitchen._id)
      const role = fresh.role === 'eater' ? 'eater' : 'cooker'
      return {
        ...base,
        next: 'invite',
        role,
        nickname: fresh.nickname || DEFAULT_NICKNAME[role],
        kitchenStatus: 'pending',
        inviteCode: invite?.code || '',
        expiresAt: invite?.expireAt || 0,
        inviteExpired: !invite || invite.expireAt <= now(),
        shareTitle: SHARE_TITLE[role],
      }
    }
    const partner = await partnerOf(kitchen, fresh)
    const partnerRole = fresh.role === 'cooker' ? 'eater' : 'cooker'
    return {
      ...base,
      next: 'home',
      kitchenStatus: 'active',
      partnerNickname: partner?.nickname || DEFAULT_NICKNAME[partnerRole],
      partnerRole,
      badges: await badgesFor(fresh, kitchen),
    }
  }

  function sessionPayload(logged, view) {
    return {
      token: logged.token,
      tokenExpired: logged.tokenExpired,
      ...view,
    }
  }

  async function dissolvePending(user, kitchen) {
    if (!kitchen || kitchen.status !== 'pending')
      throw new EatError('NO_KITCHEN', '这间厨房已经不在等待了')
    if (kitchen.cookerOpenid && kitchen.eaterOpenid)
      throw new EatError('ALREADY_BOUND', ALREADY_MSG)
    const changed = await store.update('eat-kitchens', { _id: kitchen._id, status: 'pending' }, {
      status: 'dissolved',
      dissolvedAt: now(),
      updatedAt: now(),
    })
    if (changed !== 1)
      throw new EatError('NO_KITCHEN', '这间厨房已经不在等待了')
    await store.update('eat-invites', { kitchenId: kitchen._id, status: 'active' }, { status: 'revoked' })
    await store.update('eat-users', { _id: user._id, kitchenId: kitchen._id }, {
      kitchenId: '',
      role: '',
      updatedAt: now(),
    })
  }

  async function openKitchen(user, role, logged) {
    const kitchenId = await store.insert('eat-kitchens', {
      status: 'pending',
      cookerOpenid: role === 'cooker' ? user.openid : '',
      eaterOpenid: role === 'eater' ? user.openid : '',
      cookerUserId: role === 'cooker' ? user._id : '',
      eaterUserId: role === 'eater' ? user._id : '',
      createdAt: now(),
      updatedAt: now(),
      boundAt: 0,
      dissolvedAt: 0,
    })
    const kitchen = await findOne('eat-kitchens', { _id: kitchenId })
    await insertInvite(kitchen, user, role)
    const claimed = await store.update('eat-users', { _id: user._id, kitchenId: '' }, {
      kitchenId,
      role,
      nickname: user.nicknameCustom ? user.nickname : DEFAULT_NICKNAME[role],
      updatedAt: now(),
    })
    if (claimed !== 1) {
      await store.update('eat-kitchens', { _id: kitchenId, status: 'pending' }, {
        status: 'dissolved',
        dissolvedAt: now(),
        updatedAt: now(),
      })
      await store.update('eat-invites', { kitchenId, status: 'active' }, { status: 'revoked' })
      throw new EatError('ALREADY_BOUND', ALREADY_MSG, {
        token: logged.token,
        tokenExpired: logged.tokenExpired,
        next: 'home',
      })
    }
  }

  async function resolveInvite(user, inviteCode) {
    const code = normalizeInviteCode(inviteCode)
    if (!code)
      throw new EatError('INVITE_INVALID', INVALID_MSG)
    const invite = await findOne('eat-invites', { code })
    if (!invite || invite.status === 'revoked')
      throw new EatError('INVITE_INVALID', INVALID_MSG)
    const kitchen = await findOne('eat-kitchens', { _id: invite.kitchenId })
    if (!kitchen || kitchen.status === 'dissolved')
      throw new EatError('INVITE_INVALID', INVALID_MSG)
    if (invite.status === 'used' || kitchen.status === 'active') {
      if (kitchen.status === 'active' && isMember(kitchen, user))
        return { kind: 'home', invite, kitchen }
      throw new EatError('INVITE_INVALID', INVALID_MSG)
    }
    if (invite.creatorOpenid === user.openid)
      return { kind: 'self', invite, kitchen }
    if (invite.expireAt <= now())
      throw new EatError('INVITE_INVALID', INVALID_MSG)
    if (user.kitchenId) {
      const mine = await findOne('eat-kitchens', { _id: user.kitchenId })
      if (mine && mine.status === 'active')
        throw new EatError('ALREADY_BOUND', ALREADY_MSG)
      if (mine && mine.status === 'pending' && mine._id !== kitchen._id)
        return { kind: 'abandon', invite, kitchen, mine }
    }
    return { kind: 'join', invite, kitchen }
  }

  async function joinKitchen(user, invite, kitchen) {
    const role = otherRole(invite.creatorRole)
    if (role === 'cooker' && kitchen.cookerOpenid)
      throw new EatError('INVITE_INVALID', INVALID_MSG)
    if (role === 'eater' && kitchen.eaterOpenid)
      throw new EatError('INVITE_INVALID', INVALID_MSG)

    const nickname = user.nicknameCustom ? user.nickname : DEFAULT_NICKNAME[role]
    const claimed = await store.update('eat-users', { _id: user._id, kitchenId: '' }, {
      kitchenId: kitchen._id,
      role,
      nickname,
      updatedAt: now(),
    })
    if (claimed !== 1)
      throw new EatError('ALREADY_BOUND', ALREADY_MSG)

    const patch = {
      status: 'active',
      boundAt: now(),
      updatedAt: now(),
    }
    if (role === 'cooker') {
      patch.cookerOpenid = user.openid
      patch.cookerUserId = user._id
    }
    else {
      patch.eaterOpenid = user.openid
      patch.eaterUserId = user._id
    }
    const bound = await store.update('eat-kitchens', {
      _id: kitchen._id,
      status: 'pending',
      cookerOpenid: kitchen.cookerOpenid,
      eaterOpenid: kitchen.eaterOpenid,
    }, patch)
    if (bound !== 1) {
      await store.update('eat-users', { _id: user._id, kitchenId: kitchen._id }, {
        kitchenId: '',
        role: '',
        updatedAt: now(),
      })
      throw new EatError('INVITE_INVALID', INVALID_MSG)
    }
    await store.update('eat-invites', { _id: invite._id, status: 'active' }, {
      status: 'used',
      usedByOpenid: user.openid,
      usedAt: now(),
    })
    return reload(user._id)
  }

  async function enter(params) {
    const logged = await login(input(params).code)
    const user = await reload(logged.user._id)
    return sessionPayload(logged, await accountView(user))
  }

  async function me() {
    return accountView(await requireUser())
  }

  async function createInvite(params) {
    const body = input(params)
    const role = body.role
    if (!ROLES.includes(role))
      throw new EatError('VALIDATION', '先选做饭，或先选点餐')
    const logged = await login(body.code)
    let user = await reload(logged.user._id)
    const kitchen = await loadKitchen(user)
    user = await reload(user._id)
    if (kitchen && kitchen.status === 'active') {
      throw new EatError('ALREADY_BOUND', ALREADY_MSG, {
        token: logged.token,
        tokenExpired: logged.tokenExpired,
        next: 'home',
      })
    }
    if (kitchen && kitchen.status === 'pending') {
      const sameRole = (role === 'cooker' && kitchen.cookerOpenid === user.openid)
        || (role === 'eater' && kitchen.eaterOpenid === user.openid)
      if (sameRole) {
        await ensureInvite(kitchen, user, role)
        return sessionPayload(logged, await accountView(await reload(user._id)))
      }
      await dissolvePending(user, kitchen)
      user = await reload(user._id)
    }
    await openKitchen(user, role, logged)
    return sessionPayload(logged, await accountView(await reload(user._id)))
  }

  async function refreshInvite(params) {
    const logged = await login(input(params).code)
    let user = await reload(logged.user._id)
    const kitchen = await loadKitchen(user)
    user = await reload(user._id)
    if (!kitchen || kitchen.status !== 'pending' || !isMember(kitchen, user))
      throw new EatError('NO_KITCHEN', '这间厨房已经不在等待了')
    const role = user.role === 'eater' ? 'eater' : 'cooker'
    await store.update('eat-invites', { kitchenId: kitchen._id, status: 'active' }, { status: 'revoked' })
    await insertInvite(kitchen, user, role)
    return sessionPayload(logged, await accountView(await reload(user._id)))
  }

  async function previewInvite(params) {
    const body = input(params)
    const logged = await login(body.code)
    const user = await reload(logged.user._id)
    const resolved = await resolveInvite(user, body.inviteCode)
    if (resolved.kind === 'self')
      return sessionPayload(logged, { ...await accountView(user), next: 'waiting' })
    if (resolved.kind === 'home')
      return sessionPayload(logged, await accountView(user))
    if (resolved.kind === 'abandon') {
      throw new EatError('NEED_ABANDON', ABANDON_MSG, {
        token: logged.token,
        tokenExpired: logged.tokenExpired,
      })
    }
    const role = otherRole(resolved.invite.creatorRole)
    const partner = await findOne('eat-users', { openid: resolved.invite.creatorOpenid })
    return sessionPayload(logged, {
      next: 'confirm',
      today: todayString(),
      role,
      nickname: user.nicknameCustom ? user.nickname : DEFAULT_NICKNAME[role],
      partnerNickname: partner?.nickname || DEFAULT_NICKNAME[resolved.invite.creatorRole],
      partnerRole: resolved.invite.creatorRole,
      kitchenStatus: 'none',
      inviteCode: resolved.invite.code,
      expiresAt: resolved.invite.expireAt,
      inviteExpired: false,
      shareTitle: SHARE_TITLE[resolved.invite.creatorRole],
      badges: emptyBadges(),
    })
  }

  async function acceptInvite(params) {
    const body = input(params)
    const logged = await login(body.code)
    let user = await reload(logged.user._id)
    const resolved = await resolveInvite(user, body.inviteCode)
    if (resolved.kind === 'self')
      return sessionPayload(logged, { ...await accountView(user), next: 'waiting' })
    if (resolved.kind === 'home')
      return sessionPayload(logged, await accountView(user))
    if (resolved.kind === 'abandon') {
      if (!body.abandonPending) {
        throw new EatError('NEED_ABANDON', ABANDON_MSG, {
          token: logged.token,
          tokenExpired: logged.tokenExpired,
        })
      }
      await dissolvePending(user, resolved.mine)
      user = await reload(user._id)
    }
    user = await joinKitchen(user, resolved.invite, resolved.kitchen)
    return sessionPayload(logged, await accountView(user))
  }

  async function updateNickname(params) {
    const user = await requireUser()
    await requireActive(user)
    const nickname = String(input(params).nickname || '').trim()
    if (textLen(nickname) < 2 || textLen(nickname) > 8)
      throw new EatError('VALIDATION', '称呼要 2 到 8 个字')
    await store.update('eat-users', { _id: user._id }, {
      nickname,
      nicknameCustom: true,
      updatedAt: now(),
    })
    return accountView(await reload(user._id))
  }

  async function clearMember(openid, kitchenId) {
    if (!openid)
      return
    const member = await findOne('eat-users', { openid })
    if (!member)
      return
    await store.update('eat-users', { _id: member._id, kitchenId }, {
      kitchenId: '',
      role: '',
      updatedAt: now(),
    })
  }

  async function unbind() {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const changed = await store.update('eat-kitchens', { _id: kitchen._id, status: 'active' }, {
      status: 'dissolved',
      dissolvedAt: now(),
      updatedAt: now(),
    })
    if (changed !== 1)
      throw new EatError('NO_KITCHEN', '还没有厨房')
    await store.update('eat-invites', { kitchenId: kitchen._id, status: 'active' }, { status: 'revoked' })
    await clearMember(kitchen.cookerOpenid, kitchen._id)
    await clearMember(kitchen.eaterOpenid, kitchen._id)
    return accountView(await reload(user._id))
  }

  async function categoryMap(kitchenId) {
    const rows = await store.find('eat-categories', { kitchenId }, 100)
    return new Map(rows.map(category => [category._id, category.name]))
  }

  function dishCard(dish, names) {
    return {
      dishId: dish._id,
      name: dish.name,
      categoryId: dish.categoryId || '',
      categoryName: names.get(dish.categoryId) || '',
      coverFileId: dish.coverFileId || '',
      status: dish.status,
    }
  }

  function dishDetail(dish, names) {
    return {
      ...dishCard(dish, names),
      ingredients: dish.ingredients || [],
      steps: dish.steps || [],
      sourceUrl: dish.sourceUrl || '',
    }
  }

  async function listCategories() {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const rows = await store.find('eat-categories', { kitchenId: kitchen._id }, 100)
    rows.sort((a, b) => a.createdAt - b.createdAt)
    return {
      categories: rows.map(category => ({
        categoryId: category._id,
        name: category.name,
      })),
    }
  }

  async function createCategory(params) {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const name = normalizeCategoryName(input(params).name)
    const rows = await store.find('eat-categories', { kitchenId: kitchen._id }, 100)
    if (rows.some(category => category.name === name))
      throw new EatError('VALIDATION', '已经有这个分类')
    const categoryId = await store.insert('eat-categories', {
      kitchenId: kitchen._id,
      name,
      createdAt: now(),
    })
    return { categoryId, name }
  }

  async function renameCategory(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const name = normalizeCategoryName(body.name)
    const category = await findOne('eat-categories', { _id: String(body.categoryId || ''), kitchenId: kitchen._id })
    if (!category)
      throw new EatError('VALIDATION', '没有这个分类')
    const rows = await store.find('eat-categories', { kitchenId: kitchen._id }, 100)
    if (rows.some(item => item.name === name && item._id !== category._id))
      throw new EatError('VALIDATION', '已经有这个分类')
    await store.update('eat-categories', { _id: category._id, kitchenId: kitchen._id }, { name })
    return { categoryId: category._id, name }
  }

  async function deleteCategory(params) {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const categoryId = String(input(params).categoryId || '')
    const category = await findOne('eat-categories', { _id: categoryId, kitchenId: kitchen._id })
    if (!category)
      throw new EatError('VALIDATION', '没有这个分类')
    const dishes = await store.find('eat-dishes', { kitchenId: kitchen._id, categoryId, deleted: false }, 20)
    if (dishes.length)
      throw new EatError('VALIDATION', '先把菜换到别的分类，再删')
    await store.remove('eat-categories', { _id: categoryId, kitchenId: kitchen._id })
    return { ok: true }
  }

  async function assertCategory(kitchen, categoryId) {
    if (!categoryId)
      return ''
    const category = await findOne('eat-categories', { _id: categoryId, kitchenId: kitchen._id })
    if (!category)
      throw new EatError('VALIDATION', '没有这个分类')
    return category._id
  }

  async function listDishes(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    let rows = await store.find('eat-dishes', { kitchenId: kitchen._id, deleted: false }, 500)
    const keyword = String(body.keyword || '').trim()
    if (keyword)
      rows = rows.filter(dish => dish.name.includes(keyword))
    if (body.categoryId)
      rows = rows.filter(dish => dish.categoryId === body.categoryId)
    if (body.status === 'on' || body.status === 'off')
      rows = rows.filter(dish => dish.status === body.status)
    rows.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0) || b.updatedAt - a.updatedAt)
    const names = await categoryMap(kitchen._id)
    return { dishes: rows.map(dish => dishCard(dish, names)) }
  }

  async function getDish(params) {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const dish = await ownDish(kitchen, input(params).dishId)
    return dishDetail(dish, await categoryMap(kitchen._id))
  }

  async function ownDish(kitchen, dishId) {
    const dish = await findOne('eat-dishes', { _id: String(dishId || ''), kitchenId: kitchen._id })
    if (!dish || dish.deleted)
      throw new EatError('VALIDATION', '没有这道菜')
    return dish
  }

  function readDishInput(body) {
    const name = normalizeDishName(body.name)
    const ingredients = asLines(body.ingredients, 80, 200, '食材太长了', '食材太多了')
    const steps = asLines(body.steps, 30, 200, '每一步最多 200 个字', '步骤最多 30 步')
    const sourceUrl = normalizeUrl(body.sourceUrl)
    const coverFileId = body.coverFileId ? normalizeFileId(body.coverFileId, '还缺封面') : ''
    if (!coverFileId)
      throw new EatError('VALIDATION', '还缺封面')
    return { name, ingredients, steps, sourceUrl, coverFileId }
  }

  async function publishDish(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const fields = readDishInput(body)
    const categoryId = await assertCategory(kitchen, String(body.categoryId || ''))
    const dishId = String(body.dishId || '')
    if (!dishId) {
      const createdAt = now()
      const id = await store.insert('eat-dishes', {
        kitchenId: kitchen._id,
        ...fields,
        categoryId,
        status: 'on',
        publishedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        deleted: false,
      })
      const dish = await ownDish(kitchen, id)
      return dishDetail(dish, await categoryMap(kitchen._id))
    }
    const current = await ownDish(kitchen, dishId)
    const publishedAt = current.status === 'on' ? current.publishedAt : now()
    await store.update('eat-dishes', { _id: current._id, kitchenId: kitchen._id }, {
      ...fields,
      categoryId,
      status: 'on',
      publishedAt,
      updatedAt: now(),
    })
    return dishDetail(await ownDish(kitchen, current._id), await categoryMap(kitchen._id))
  }

  async function unpublishDish(params) {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const dish = await ownDish(kitchen, input(params).dishId)
    if (dish.status === 'on') {
      await store.update('eat-dishes', { _id: dish._id, kitchenId: kitchen._id }, {
        status: 'off',
        updatedAt: now(),
      })
    }
    return dishDetail(await ownDish(kitchen, dish._id), await categoryMap(kitchen._id))
  }

  async function deleteDish(params) {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const dish = await ownDish(kitchen, input(params).dishId)
    const orders = await store.find('eat-orders', { kitchenId: kitchen._id }, 500)
    const blocked = orders.some(order =>
      (order.status === 'pending' || order.status === 'accepted')
      && order.items.some(item => item.dishId === dish._id),
    )
    if (blocked)
      throw new EatError('VALIDATION', '这道菜还在一餐里面，只能先下架')
    await store.update('eat-dishes', { _id: dish._id, kitchenId: kitchen._id }, {
      deleted: true,
      updatedAt: now(),
    })
    return { ok: true }
  }

  async function listMenu(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    let rows = await store.find('eat-dishes', { kitchenId: kitchen._id, deleted: false }, 500)
    rows = rows.filter(dish => dish.status === 'on')
    const keyword = String(body.keyword || '').trim()
    if (keyword)
      rows = rows.filter(dish => dish.name.includes(keyword))
    if (body.categoryId)
      rows = rows.filter(dish => dish.categoryId === body.categoryId)
    rows.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    const names = await categoryMap(kitchen._id)
    return {
      dishes: rows.map(dish => ({
        dishId: dish._id,
        name: dish.name,
        categoryId: dish.categoryId || '',
        categoryName: names.get(dish.categoryId) || '',
        coverFileId: dish.coverFileId || '',
      })),
    }
  }

  async function mealBoard() {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const dates = upcomingDates()
    const orders = await store.find('eat-orders', { kitchenId: kitchen._id }, 500)
    const busy = []
    for (const order of orders) {
      if (order.status !== 'pending' && order.status !== 'accepted')
        continue
      if (!dates.some(item => item.date === order.date))
        continue
      busy.push({
        date: order.date,
        slot: order.slot,
        orderId: order._id,
        status: order.status,
      })
    }
    return {
      today: dates[0].date,
      dates,
      busy,
    }
  }

  async function recordedSet(kitchen) {
    const records = await store.find('eat-records', { kitchenId: kitchen._id, deleted: false }, 500)
    return new Set(records.map(record => record.orderId).filter(Boolean))
  }

  function mapOrder(order, recorded) {
    return {
      orderId: order._id,
      date: order.date,
      slot: order.slot,
      status: order.status,
      note: order.note || '',
      rejectNote: order.rejectNote || '',
      cancelNote: order.cancelNote || '',
      cancelledByRole: order.cancelledByRole || '',
      items: order.items || [],
      recorded: Boolean(recorded),
    }
  }

  async function ownOrder(kitchen, orderId) {
    const order = await findOne('eat-orders', { _id: String(orderId || ''), kitchenId: kitchen._id })
    if (!order)
      throw new EatError('VALIDATION', '没有这一餐')
    return order
  }

  async function createOrder(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'eater')
    const date = String(body.date || '')
    if (!upcomingDates().some(item => item.date === date))
      throw new EatError('VALIDATION', '只能点今天、明天或后天')
    if (!SLOTS.includes(body.slot))
      throw new EatError('VALIDATION', '先选早上、中午或晚上')
    const ids = Array.isArray(body.dishIds) ? body.dishIds.map(id => String(id)) : []
    if (ids.length < 1 || ids.length > 6)
      throw new EatError('VALIDATION', '这一餐要 1 到 6 道菜')
    if (new Set(ids).size !== ids.length)
      throw new EatError('VALIDATION', '同一道菜不用加两次')
    const note = String(body.note || '').trim()
    if (textLen(note) > 100)
      throw new EatError('VALIDATION', '备注最多 100 个字')
    const existing = await store.find('eat-orders', { kitchenId: kitchen._id, date, slot: body.slot }, 20)
    const taken = existing.find(order => order.status === 'pending' || order.status === 'accepted')
    if (taken)
      throw new EatError('SLOT_TAKEN', '这一餐已经点过了', { orderId: taken._id })

    const items = []
    for (const dishId of ids) {
      const dish = await findOne('eat-dishes', { _id: dishId, kitchenId: kitchen._id })
      if (!dish || dish.deleted || dish.status !== 'on')
        throw new EatError('VALIDATION', '菜单里没有这道菜')
      items.push({
        dishId: dish._id,
        name: dish.name,
        coverFileId: dish.coverFileId,
      })
    }
    const createdAt = now()
    const orderId = await store.insert('eat-orders', {
      kitchenId: kitchen._id,
      date,
      slot: body.slot,
      status: 'pending',
      note,
      rejectNote: '',
      cancelNote: '',
      cancelledByRole: '',
      items,
      eaterUnread: false,
      createdAt,
      updatedAt: createdAt,
    })
    const again = await store.find('eat-orders', { kitchenId: kitchen._id, date, slot: body.slot }, 20)
    const inProgress = again
      .filter(order => order.status === 'pending' || order.status === 'accepted')
      .sort((a, b) => a.createdAt - b.createdAt)
    if (inProgress.length > 1 && inProgress[0]._id !== orderId) {
      await store.remove('eat-orders', { _id: orderId })
      throw new EatError('SLOT_TAKEN', '这一餐已经点过了', { orderId: inProgress[0]._id })
    }
    const order = await ownOrder(kitchen, orderId)
    return mapOrder(order, false)
  }

  async function listTodo() {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const orders = await store.find('eat-orders', { kitchenId: kitchen._id }, 500)
    const recorded = await recordedSet(kitchen)
    const rows = orders.filter(order => order.status === 'pending' || order.status === 'accepted')
    rows.sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])
    return { orders: rows.map(order => mapOrder(order, recorded.has(order._id))) }
  }

  async function listOrders() {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const orders = await store.find('eat-orders', { kitchenId: kitchen._id }, 500)
    if (user.role === 'eater') {
      await store.update('eat-orders', { kitchenId: kitchen._id, eaterUnread: true }, { eaterUnread: false })
    }
    const recorded = await recordedSet(kitchen)
    orders.sort((a, b) => b.date.localeCompare(a.date) || SLOT_ORDER[b.slot] - SLOT_ORDER[a.slot])
    return { orders: orders.map(order => mapOrder(order, recorded.has(order._id))) }
  }

  async function getOrder(params) {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const order = await ownOrder(kitchen, input(params).orderId)
    const recorded = await recordedSet(kitchen)
    return mapOrder(order, recorded.has(order._id))
  }

  async function acceptOrder(params) {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const order = await ownOrder(kitchen, input(params).orderId)
    if (order.status !== 'pending')
      throw new EatError('VALIDATION', '这餐已经不能改了')
    const changed = await store.update('eat-orders', { _id: order._id, status: 'pending' }, {
      status: 'accepted',
      eaterUnread: true,
      updatedAt: now(),
    })
    if (changed !== 1)
      throw new EatError('VALIDATION', '这餐已经不能改了')
    const recorded = await recordedSet(kitchen)
    return mapOrder(await ownOrder(kitchen, order._id), recorded.has(order._id))
  }

  async function rejectOrder(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const note = requireSentence(body.note)
    const order = await ownOrder(kitchen, body.orderId)
    if (order.status !== 'pending')
      throw new EatError('VALIDATION', '这餐已经不能改了')
    const changed = await store.update('eat-orders', { _id: order._id, status: 'pending' }, {
      status: 'rejected',
      rejectNote: note,
      eaterUnread: true,
      updatedAt: now(),
    })
    if (changed !== 1)
      throw new EatError('VALIDATION', '这餐已经不能改了')
    return mapOrder(await ownOrder(kitchen, order._id), false)
  }

  async function cancelOrder(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const note = requireSentence(body.note)
    const order = await ownOrder(kitchen, body.orderId)
    if (order.status !== 'pending' && order.status !== 'accepted')
      throw new EatError('VALIDATION', '这餐已经不能改了')
    const changed = await store.update('eat-orders', { _id: order._id, status: order.status }, {
      status: 'cancelled',
      cancelNote: note,
      cancelledByRole: user.role,
      eaterUnread: false,
      updatedAt: now(),
    })
    if (changed !== 1)
      throw new EatError('VALIDATION', '这餐已经不能改了')
    const recorded = await recordedSet(kitchen)
    return mapOrder(await ownOrder(kitchen, order._id), recorded.has(order._id))
  }

  async function getCookDish(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    requireRole(user, 'cooker')
    const order = await ownOrder(kitchen, body.orderId)
    const item = (order.items || []).find(entry => entry.dishId === body.dishId)
    if (!item)
      throw new EatError('VALIDATION', '这一餐里没有这道菜')
    const dish = await findOne('eat-dishes', { _id: String(body.dishId || ''), kitchenId: kitchen._id })
    const live = dish && !dish.deleted ? dish : null
    return {
      dishId: item.dishId,
      name: item.name,
      coverFileId: item.coverFileId,
      ingredients: live ? live.ingredients || [] : [],
      steps: live ? live.steps || [] : [],
      sourceUrl: live ? live.sourceUrl || '' : '',
    }
  }

  function mapRecord(record) {
    return {
      recordId: record._id,
      date: record.date,
      slot: record.slot,
      text: record.text || '',
      photoFileIds: record.photoFileIds || [],
      dishes: record.dishes || [],
      orderId: record.orderId || '',
    }
  }

  async function ownRecord(kitchen, recordId) {
    const record = await findOne('eat-records', { _id: String(recordId || ''), kitchenId: kitchen._id })
    if (!record || record.deleted)
      throw new EatError('VALIDATION', '没有这一餐的记录')
    return record
  }

  async function snapshotDishes(kitchen, dishIds) {
    const dishes = []
    for (const dishId of dishIds) {
      const dish = await findOne('eat-dishes', { _id: dishId, kitchenId: kitchen._id })
      if (!dish || dish.deleted)
        throw new EatError('VALIDATION', '没有这道菜')
      if (dishes.some(item => item.dishId === dish._id))
        continue
      dishes.push({ dishId: dish._id, name: dish.name })
    }
    return dishes
  }

  async function listRecords() {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const rows = await store.find('eat-records', { kitchenId: kitchen._id, deleted: false }, 500)
    const field = user.role === 'cooker' ? 'unreadCooker' : 'unreadEater'
    await store.update('eat-records', { kitchenId: kitchen._id, deleted: false, [field]: true }, { [field]: false })
    rows.sort((a, b) => b.date.localeCompare(a.date) || SLOT_ORDER[b.slot] - SLOT_ORDER[a.slot] || b.createdAt - a.createdAt)
    return { records: rows.map(mapRecord) }
  }

  async function createRecord(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const text = normalizeRecordText(body.text)
    const photoFileIds = normalizePhotos(body.photoFileIds)
    if (!text && photoFileIds.length === 0)
      throw new EatError('VALIDATION', '照片和文字至少留一样')

    let date = String(body.date || '')
    let slot = body.slot
    const orderId = String(body.orderId || '')
    if (orderId) {
      const order = await ownOrder(kitchen, orderId)
      const linked = await store.find('eat-records', { kitchenId: kitchen._id, orderId }, 20)
      if (linked.some(record => !record.deleted))
        throw new EatError('VALIDATION', '这一餐已经记下了')
      date = order.date
      slot = order.slot
    }
    else {
      if (!isRealDate(date))
        throw new EatError('VALIDATION', '先选这一天')
      if (!SLOTS.includes(slot))
        throw new EatError('VALIDATION', '先选早上、中午或晚上')
    }
    const dishIds = Array.isArray(body.dishIds) ? body.dishIds.map(id => String(id)) : []
    const dishes = await snapshotDishes(kitchen, dishIds)
    const createdAt = now()
    const recordId = await store.insert('eat-records', {
      kitchenId: kitchen._id,
      date,
      slot,
      text,
      photoFileIds,
      dishes,
      orderId,
      unreadCooker: user.role !== 'cooker',
      unreadEater: user.role !== 'eater',
      deleted: false,
      createdAt,
      updatedAt: createdAt,
    })
    return mapRecord(await ownRecord(kitchen, recordId))
  }

  async function updateRecord(params) {
    const body = input(params)
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const record = await ownRecord(kitchen, body.recordId)
    const text = body.text === undefined ? record.text : normalizeRecordText(body.text)
    const photoFileIds = body.photoFileIds === undefined ? record.photoFileIds : normalizePhotos(body.photoFileIds)
    if (!text && photoFileIds.length === 0)
      throw new EatError('VALIDATION', '照片和文字至少留一样')
    await store.update('eat-records', { _id: record._id, kitchenId: kitchen._id }, {
      text,
      photoFileIds,
      updatedAt: now(),
    })
    return mapRecord(await ownRecord(kitchen, record._id))
  }

  async function deleteRecord(params) {
    const user = await requireUser()
    const kitchen = await requireActive(user)
    const record = await ownRecord(kitchen, input(params).recordId)
    await store.update('eat-records', { _id: record._id, kitchenId: kitchen._id }, {
      deleted: true,
      updatedAt: now(),
    })
    return { ok: true }
  }

  async function badges() {
    const user = await requireUser()
    const kitchen = await loadKitchen(user)
    if (!kitchen || kitchen.status !== 'active')
      return emptyBadges()
    return badgesFor(await reload(user._id), kitchen)
  }

  return {
    enter,
    me,
    createInvite,
    refreshInvite,
    previewInvite,
    acceptInvite,
    updateNickname,
    unbind,
    listCategories,
    createCategory,
    renameCategory,
    deleteCategory,
    listDishes,
    getDish,
    publishDish,
    unpublishDish,
    deleteDish,
    listMenu,
    mealBoard,
    createOrder,
    listTodo,
    listOrders,
    getOrder,
    acceptOrder,
    rejectOrder,
    cancelOrder,
    getCookDish,
    listRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    badges,
  }
}

module.exports = {
  createEatService,
  INVALID_MSG,
  ALREADY_MSG,
  ABANDON_MSG,
}
