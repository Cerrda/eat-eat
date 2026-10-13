import { createHash, createHmac, randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import process, { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import JSON5 from 'json5'

const root = fileURLToPath(new URL('../..', import.meta.url))
const dishesDir = fileURLToPath(new URL('.', import.meta.url))
const envFile = resolve(root, '.env.unicloud.local')

const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

function textLen(value) {
  return Array.from(value).length
}

function fail(message) {
  throw new Error(message)
}

function readDotEnv(file) {
  const env = {}
  const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\'')))
      value = value.slice(1, -1)
    env[trimmed.slice(0, eq).trim()] = value
  }
  return env
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function signHeaders(path, query, method, headers, body, accessKey, secretKey, signedHeaderKeys) {
  const timestamp = headers['x-client-timestamp']
  const signed = [...signedHeaderKeys].sort()
  const canonicalHeaders = signed.map(key => `${key.toLowerCase()}:${headers[key]}\n`).join('')
  const signedNames = signed.join(';')
  const canonical = `${method.toUpperCase()}\n${path}\n${query}\n${canonicalHeaders}\n${signedNames}\n${sha256(body)}\n`
  const stringToSign = `HMAC-SHA256\n${timestamp}\n${sha256(canonical)}\n`
  const signature = createHmac('sha256', secretKey).update(stringToSign, 'utf8').digest('hex')
  return `HMAC-SHA256 Credential=${accessKey}, SignedHeaders=${signedNames}, Signature=${signature}`
}

function loadSpace() {
  let env
  try {
    env = readDotEnv(envFile)
  }
  catch {
    fail('还没有 .env.unicloud.local。复制 .env.unicloud.example 并填上服务空间凭证。')
  }
  const spaceId = env.UNICLOUD_SPACE_ID?.trim()
  const spaceAppId = env.UNICLOUD_SPACE_APP_ID?.trim()
  const accessKey = env.UNICLOUD_ACCESS_KEY?.trim()
  const secretKey = env.UNICLOUD_SECRET_KEY?.trim()
  if (!spaceId || !spaceAppId || !accessKey || !secretKey)
    fail('.env.unicloud.local 里的服务空间凭证不完整。')
  return {
    spaceId,
    spaceAppId,
    accessKey,
    secretKey,
    endpoint: `https://${spaceId}.api-hz.cloudbasefunction.cn`,
  }
}

async function signedFetch(space, pathWithQuery, { method = 'POST', data, headers = {}, functionName = '', signHeaderKeys = [] } = {}) {
  const [path, query = ''] = pathWithQuery.split('?')
  const body = data === undefined ? '' : JSON.stringify(data)
  const timestamp = String(Date.now())
  const requestId = randomUUID()
  const allHeaders = {
    ...headers,
    'x-from-app-id': space.spaceAppId,
    'x-from-env-id': space.spaceId,
    'x-to-env-id': space.spaceId,
    'x-from-instance-id': timestamp,
    'x-from-function-name': functionName,
    'x-client-timestamp': timestamp,
    'x-alipay-source': 'client',
    'x-request-id': requestId,
    'x-alipay-callid': requestId,
    'x-trace-id': requestId,
  }
  const signed = [
    'x-from-app-id',
    'x-from-env-id',
    'x-to-env-id',
    'x-from-instance-id',
    'x-from-function-name',
    'x-client-timestamp',
    ...signHeaderKeys,
  ]
  allHeaders.authorization = signHeaders(path, query, method, allHeaders, body, space.accessKey, space.secretKey, signed)
  if (body)
    allHeaders['content-type'] = 'application/json'
  const response = await fetch(`${space.endpoint}${pathWithQuery}`, {
    method,
    headers: allHeaders,
    body: body || undefined,
  })
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  }
  catch {
    json = null
  }
  return { status: response.status, json }
}

async function callBatch(space, params) {
  const res = await signedFetch(space, '/functions/invokeFunction', {
    functionName: 'eat',
    headers: { 'x-to-function-name': 'eat' },
    signHeaderKeys: ['x-to-function-name'],
    data: { method: 'batchDishes', params: [params] },
  })
  const body = res.json || {}
  if (res.status >= 400)
    fail(body.message || body.errMsg || `云函数请求失败（${res.status}）`)
  if (body.errCode) {
    const message = body.errMsg || '这次没有完成'
    const code = String(body.errCode)
    if (code === 'METHOD_NOT_FOUND' || /not a function|method.*not found|不存在/i.test(`${code} ${message}`))
      fail('云函数 eat 里还没有批量新增。上传云函数之后再运行。')
    fail(message)
  }
  return body.data
}

function asCloudId(spaceId, fileId) {
  const id = String(fileId || '').trim()
  if (!id)
    throw new Error('封面没有传上去')
  if (id.startsWith('cloud://'))
    return id
  return `cloud://${spaceId}/${id.replace(/^\/+/, '')}`
}

async function uploadCover(space, filePath) {
  const ext = (filePath.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const cloudPath = `eat/import/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const meta = await signedFetch(space, `/${cloudPath}?post_url`, {
    method: 'GET',
    headers: {
      'x-alipay-cloud-mode': 'oss',
      'x-data-api-type': 'oss',
      'x-expire-timestamp': String(Date.now() + 60_000),
    },
    signHeaderKeys: ['x-data-api-type', 'x-expire-timestamp'],
  })
  const payload = meta.json || {}
  if (!payload.success)
    fail(payload.message || payload.errMsg || '没有拿到封面上传地址')
  const slot = payload.data || {}
  const form = new FormData()
  for (const field of slot.form_data || [])
    form.append(String(field.key), String(field.value ?? ''))
  const bytes = readFileSync(filePath)
  form.append('file', new Blob([bytes], { type: MIME[ext] || 'application/octet-stream' }), cloudPath.split('/').pop())
  const uploaded = await fetch(slot.upload_url, { method: 'POST', body: form })
  if (!uploaded.ok)
    fail(`封面没有传上去（${uploaded.status}）`)
  return asCloudId(space.spaceId, slot.file_id)
}

function resolveCover(cover) {
  const rel = String(cover || '').trim().replace(/\\/g, '/')
  if (!rel)
    return { error: '还缺封面' }
  const full = resolve(dishesDir, rel)
  const fromRoot = relative(dishesDir, full)
  if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot))
    return { error: `封面要放在菜品目录里：${rel}` }
  return { full, rel }
}

function validateDishes(list) {
  if (!Array.isArray(list) || !list.length)
    fail('这份文件里没有菜。最外层要是一个数组。')
  if (list.length > 80)
    fail('一次最多 80 道菜。')
  const errors = []
  const dishes = []
  list.forEach((item, index) => {
    const at = `第 ${index + 1} 道`
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${at}要写成一组字段`)
      return
    }
    const name = String(item.name || '').trim()
    const category = String(item.category || '').trim()
    if (!name)
      errors.push(`${at}还缺菜名`)
    else if (textLen(name) > 20)
      errors.push(`${at}菜名最多 20 个字`)
    if (category && (textLen(category) < 1 || textLen(category) > 6))
      errors.push(`${at}分类要 1 到 6 个字`)
    if (item.ingredients != null && !Array.isArray(item.ingredients))
      errors.push(`${at}食材要写成数组`)
    if (item.steps != null && !Array.isArray(item.steps))
      errors.push(`${at}步骤要写成数组`)
    const ingredients = Array.isArray(item.ingredients) ? item.ingredients : []
    const steps = Array.isArray(item.steps) ? item.steps : []
    if (ingredients.length > 80)
      errors.push(`${at}食材太多了`)
    if (steps.length > 30)
      errors.push(`${at}步骤最多 30 步`)
    for (const line of ingredients) {
      if (textLen(String(line ?? '').trim()) > 200)
        errors.push(`${at}食材太长了`)
    }
    for (const line of steps) {
      if (textLen(String(line ?? '').trim()) > 200)
        errors.push(`${at}每一步最多 200 个字`)
    }
    const sourceUrl = String(item.sourceUrl || '').trim()
    if (textLen(sourceUrl) > 500)
      errors.push(`${at}来源链接太长了`)
    const cover = resolveCover(item.cover)
    if (cover.error) {
      errors.push(`${at}${cover.error}`)
    }
    else {
      try {
        if (!statSync(cover.full).isFile())
          errors.push(`${at}封面不是文件：${cover.rel}`)
      }
      catch {
        errors.push(`${at}找不到封面：${cover.rel}`)
      }
    }
    dishes.push({
      name,
      category,
      ingredients: ingredients.map(line => String(line ?? '').trim()).filter(Boolean),
      steps: steps.map(line => String(line ?? '').trim()).filter(Boolean),
      sourceUrl,
      coverPath: cover.full || '',
      coverRel: cover.rel || String(item.cover || '').trim(),
    })
  })
  if (errors.length)
    fail(errors.join('\n'))
  return dishes
}

function formatDay(ms) {
  if (!ms)
    return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

function kitchenLabel(kitchen) {
  const day = formatDay(kitchen.boundAt)
  const when = day ? ` · ${day} 绑定` : ''
  return `做饭 ${kitchen.cookerName} · 点餐 ${kitchen.eaterName}${when}`
}

function parseIndexes(text, count) {
  const raw = text.trim().toLowerCase()
  if (!raw)
    return []
  if (raw === 'a' || raw === 'all' || raw === '*' || raw === '全选')
    return Array.from({ length: count }, (_, index) => index)
  const parts = raw.split(/[\s,，]+/).filter(Boolean)
  const indexes = []
  for (const part of parts) {
    if (!/^\d+$/.test(part))
      return null
    const number = Number(part)
    if (number < 1 || number > count)
      return null
    indexes.push(number - 1)
  }
  return [...new Set(indexes)]
}

async function chooseFile(rl) {
  const names = (await readdir(dishesDir))
    .filter(name => name.endsWith('.json5') && name !== 'example.json5')
    .sort((a, b) => a.localeCompare(b, 'zh'))
  if (!names.length)
    fail('scripts/dishes 里还没有可导入的 json5 文件。')
  console.log('选择要导入的菜品文件：')
  names.forEach((name, index) => {
    console.log(`  ${index + 1}. ${name}`)
  })
  while (true) {
    const answer = (await rl.question('输入序号：')).trim()
    const picked = parseIndexes(answer, names.length)
    if (!picked || picked.length !== 1) {
      console.log('输入一个序号。')
      continue
    }
    return names[picked[0]]
  }
}

async function chooseKitchens(rl, kitchens) {
  console.log('')
  console.log('已绑定的厨房，双方名称如下。')
  kitchens.forEach((kitchen, index) => {
    console.log(`  ${index + 1}. ${kitchenLabel(kitchen)}`)
  })
  console.log('输入序号，多个用空格或逗号分开。输入 a 全选。')
  while (true) {
    const picked = parseIndexes(await rl.question('选择厨房：'), kitchens.length)
    if (!picked) {
      console.log('序号不对。输入 a 可以全选。')
      continue
    }
    if (!picked.length) {
      console.log('还没有选择厨房。')
      continue
    }
    return picked.map(index => kitchens[index])
  }
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    const fileName = await chooseFile(rl)
    let parsed
    try {
      parsed = JSON5.parse(readFileSync(resolve(dishesDir, fileName), 'utf8'))
    }
    catch (error) {
      fail(`这份 json5 读不了：${error instanceof Error ? error.message : '格式不对'}`)
    }
    const dishes = validateDishes(parsed)
    const space = loadSpace()
    const listed = await callBatch(space, { action: 'kitchens' })
    const kitchens = Array.isArray(listed?.kitchens) ? listed.kitchens : []
    if (!kitchens.length)
      fail('现在没有已绑定的厨房。')
    while (true) {
      const selected = await chooseKitchens(rl, kitchens)
      console.log('')
      console.log(`将向 ${selected.length} 间厨房新增 ${dishes.length} 道菜。已有同名菜会跳过。`)
      selected.forEach((kitchen) => {
        console.log(`  ${kitchenLabel(kitchen)}`)
      })
      const answer = (await rl.question('输入 y 开始，其他键重新选择：')).trim().toLowerCase()
      if (answer !== 'y')
        continue
      const coverIds = new Map()
      for (const dish of dishes) {
        if (coverIds.has(dish.coverPath))
          continue
        console.log(`上传封面 ${dish.coverRel}`)
        coverIds.set(dish.coverPath, await uploadCover(space, dish.coverPath))
      }
      const imported = await callBatch(space, {
        action: 'import',
        kitchenIds: selected.map(kitchen => kitchen.kitchenId),
        dishes: dishes.map(dish => ({
          name: dish.name,
          category: dish.category,
          ingredients: dish.ingredients,
          steps: dish.steps,
          sourceUrl: dish.sourceUrl,
          coverFileId: coverIds.get(dish.coverPath),
        })),
      })
      console.log('')
      for (const row of imported?.kitchens || []) {
        const title = `做饭 ${row.cookerName} · 点餐 ${row.eaterName}`
        if (row.error) {
          console.log(`${title}：${row.error}`)
          continue
        }
        const created = row.created?.length ? `新增 ${row.created.join('、')}` : '没有新增'
        const skipped = row.skipped?.length ? `，跳过 ${row.skipped.join('、')}` : ''
        console.log(`${title}：${created}${skipped}`)
      }
      return
    }
  }
  finally {
    rl.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : '这次没有完成')
  process.exit(1)
})
