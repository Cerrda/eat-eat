const fs = require('node:fs')
const path = require('node:path')
const { EatError } = require('./errors')

// 密钥放在云函数目录 secrets.local.json（不要提交），或环境变量 WX_APPID / WX_SECRET。
function readConfig() {
  const appid = process.env.WX_APPID || ''
  const secret = process.env.WX_SECRET || ''
  if (appid && secret)
    return { appid, secret }

  const file = path.join(__dirname, '../secrets.local.json')
  if (fs.existsSync(file)) {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (json.appid && json.secret)
      return { appid: String(json.appid), secret: String(json.secret) }
  }

  throw new EatError('WX_CONFIG', '暂时没法用微信认出你，稍后再试')
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

module.exports = {
  exchangeWeixinCode,
}
