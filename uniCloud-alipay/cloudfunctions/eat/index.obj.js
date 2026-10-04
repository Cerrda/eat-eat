const { ok, fail } = require('eat-shared')
const { createEatService } = require('./lib/service')
const { createUniStore } = require('./lib/store')
const { exchangeWeixinCode } = require('./lib/wx')

const methods = [
  'enter',
  'me',
  'createInvite',
  'refreshInvite',
  'previewInvite',
  'acceptInvite',
  'updateNickname',
  'unbind',
  'listCategories',
  'createCategory',
  'renameCategory',
  'deleteCategory',
  'listDishes',
  'getDish',
  'publishDish',
  'unpublishDish',
  'deleteDish',
  'listMenu',
  'mealBoard',
  'createOrder',
  'listTodo',
  'listOrders',
  'getOrder',
  'acceptOrder',
  'rejectOrder',
  'cancelOrder',
  'getCookDish',
  'listRecords',
  'createRecord',
  'updateRecord',
  'deleteRecord',
  'badges',
]

function guard(work) {
  return Promise.resolve()
    .then(work)
    .then(data => ok(data))
    .catch((err) => {
      if (err && err.eat)
        return fail(err.errCode, err.errMsg, err.data)
      console.error(err)
      return fail('INTERNAL', '这次没有完成，再试一次')
    })
}

function bind(name) {
  return async function bound(params) {
    return guard(() => this.eat[name](params || {}))
  }
}

const exported = {
  _before() {
    const clientInfo = (typeof this.getClientInfo === 'function' ? this.getClientInfo() : null) || {}
    let token = ''
    if (typeof this.getUniIdToken === 'function')
      token = this.getUniIdToken() || ''
    if (!token)
      token = clientInfo.uniIdToken || ''
    this.eat = createEatService({
      store: createUniStore(uniCloud.database()),
      now: () => Date.now(),
      exchangeCode: exchangeWeixinCode,
      readToken: () => token,
    })
  },
  ping() {
    return guard(() => ({
      ok: true,
      now: Date.now(),
    }))
  },
}

for (const name of methods)
  exported[name] = bind(name)

module.exports = exported
