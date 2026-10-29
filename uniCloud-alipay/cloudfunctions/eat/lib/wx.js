const fs = require('node:fs')
const path = require('node:path')
const { EatError } = require('./errors')

// 客户端 src/utils/subscribe.ts 使用同样的模板 ID。
// 待办事项提醒（备忘录 / 2983）：新订单发给做饭端。
const ORDER_REMIND_TEMPLATE = 'mPUGhqYqc14rFMlWoUplbbKPxmoOnhAj8SVRTIb5gwc'
// 回家吃饭提醒：接单后发给点餐端。
const EATER_MEAL_TEMPLATE = 'pkY6F08kud8HZI6GPZfRH-X9txb_udMdm1CrtDuXA7I'

let accessToken = ''
let accessTokenUntil = 0

function parseBody(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    }
    catch {
      return {}
    }
  }
  return data || {}
}

function readSecretsFile() {
  const file = path.join(__dirname, '../secrets.local.json')
  if (!fs.existsSync(file))
    return {}
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  return json && typeof json === 'object' ? json : {}
}

function normalizeMpState(value) {
  const state = String(value || '').trim()
  if (state === 'developer' || state === 'trial' || state === 'formal')
    return state
  return 'developer'
}

// 密钥放在云函数目录 secrets.local.json（不要提交），或环境变量 WX_APPID / WX_SECRET。
// 订阅消息跳转版本：WX_MP_STATE 或 secrets.local.json 的 miniprogramState。未写时发到开发版。
function readConfig() {
  const file = readSecretsFile()
  const appid = process.env.WX_APPID || (file.appid ? String(file.appid) : '')
  const secret = process.env.WX_SECRET || (file.secret ? String(file.secret) : '')
  const miniprogramState = process.env.WX_MP_STATE || (file.miniprogramState ? String(file.miniprogramState) : '')
  if (!appid || !secret)
    throw new EatError('WX_CONFIG', '暂时没法用微信认出你，稍后再试')
  return { appid, secret, miniprogramState: normalizeMpState(miniprogramState) }
}

async function exchangeWeixinCode(code) {
  const { appid, secret } = readConfig()
  const res = await uniCloud.httpclient.request('https://api.weixin.qq.com/sns/jscode2session', {
    method: 'GET',
    data: {
      appid,
      secret,
      js_code: code,
      grant_type: 'authorization_code',
    },
    dataType: 'json',
    timeout: 8000,
  })

  let body = res.data
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    }
    catch {
      body = {}
    }
  }
  body = body || {}
  if (!body.openid)
    throw new EatError('WX_LOGIN_FAILED', '微信登录没有成功，再试一次')

  return {
    openid: String(body.openid),
    unionid: body.unionid ? String(body.unionid) : '',
  }
}

async function getAccessToken() {
  if (accessToken && Date.now() < accessTokenUntil)
    return accessToken
  const { appid, secret } = readConfig()
  const res = await uniCloud.httpclient.request('https://api.weixin.qq.com/cgi-bin/token', {
    method: 'GET',
    data: {
      grant_type: 'client_credential',
      appid,
      secret,
    },
    dataType: 'json',
    timeout: 8000,
  })
  const body = parseBody(res.data)
  if (!body.access_token)
    throw new EatError('WX_TOKEN', '暂时发不出提醒')
  const ttl = Number(body.expires_in) || 7200
  accessToken = String(body.access_token)
  accessTokenUntil = Date.now() + Math.max(60, ttl - 300) * 1000
  return accessToken
}

async function postSubscribe(payload, token) {
  const res = await uniCloud.httpclient.request(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      data: payload,
      contentType: 'json',
      dataType: 'json',
      timeout: 8000,
    },
  )
  return parseBody(res.data)
}

async function sendSubscribe(templateId, { touser, page, data }) {
  const { miniprogramState } = readConfig()
  const payload = {
    touser,
    template_id: templateId,
    page,
    miniprogram_state: miniprogramState,
    lang: 'zh_CN',
    data,
  }
  let body = await postSubscribe(payload, await getAccessToken())
  if (body.errcode === 40001 || body.errcode === 42001) {
    accessToken = ''
    accessTokenUntil = 0
    body = await postSubscribe(payload, await getAccessToken())
  }
  if (body.errcode !== 0)
    throw new EatError('WX_SUBSCRIBE', `${body.errcode ?? 'empty'}`)
}

async function sendOrderRemind({ touser, page, time, dishes, note }) {
  await sendSubscribe(ORDER_REMIND_TEMPLATE, {
    touser,
    page,
    data: {
      time2: { value: time },
      thing29: { value: dishes },
      thing12: { value: note },
    },
  })
}

async function sendEaterMeal({ touser, page, time, tip }) {
  await sendSubscribe(EATER_MEAL_TEMPLATE, {
    touser,
    page,
    data: {
      time1: { value: time },
      thing2: { value: tip },
    },
  })
}

module.exports = {
  exchangeWeixinCode,
  sendEaterMeal,
  sendOrderRemind,
}
