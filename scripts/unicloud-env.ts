import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

export interface UniCloudSpaceEnv {
  provider: string
  name: string
  id: string
  spaceAppId?: string
  accessKey?: string
  secretKey?: string
  clientSecret?: string
  apiEndpoint?: string
}

const ENV_FILE = '.env.unicloud.local'

export function readDotEnv(file: string): Record<string, string> {
  const env: Record<string, string> = {}
  const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    env[trimmed.slice(0, eq).trim()] = unquote(trimmed.slice(eq + 1))
  }
  return env
}

export function spaceFromEnv(env: Record<string, string>): UniCloudSpaceEnv | null {
  const id = env.UNICLOUD_SPACE_ID?.trim()
  if (!id)
    return null

  const provider = (env.UNICLOUD_PROVIDER || 'alipay').trim()
  const space: UniCloudSpaceEnv = {
    provider: provider === 'tcb' ? 'tencent' : provider,
    name: env.UNICLOUD_SPACE_NAME?.trim() || 'eat-eat',
    id,
  }

  if (space.provider === 'alipay') {
    const spaceAppId = env.UNICLOUD_SPACE_APP_ID?.trim() || ''
    const accessKey = env.UNICLOUD_ACCESS_KEY?.trim() || ''
    const secretKey = env.UNICLOUD_SECRET_KEY?.trim() || ''
    if (!spaceAppId || !accessKey || !secretKey)
      return null
    space.spaceAppId = spaceAppId
    space.accessKey = accessKey
    space.secretKey = secretKey
  }

  if (space.provider === 'aliyun') {
    const clientSecret = env.UNICLOUD_CLIENT_SECRET?.trim() || ''
    if (!clientSecret)
      return null
    space.clientSecret = clientSecret
    const endpoint = env.UNICLOUD_ENDPOINT?.trim()
    if (endpoint)
      space.apiEndpoint = endpoint
  }

  return space
}

function unquote(value: string) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function applyUniCloudEnv() {
  if (process.env.UNI_CLOUD_SPACES)
    return

  const file = resolve(process.cwd(), ENV_FILE)
  if (!existsSync(file)) {
    console.warn(`[uniCloud] 未找到 ${ENV_FILE}，客户端还不能调用云函数。复制 .env.unicloud.example 并填入服务空间凭证后重启 dev。`)
    return
  }

  const space = spaceFromEnv(readDotEnv(file))
  if (!space) {
    console.warn(`[uniCloud] ${ENV_FILE} 里的服务空间凭证不完整，客户端暂未注入 uniCloud。`)
    return
  }

  process.env.UNI_CLOUD_SPACES = JSON.stringify([space])
}

applyUniCloudEnv()
