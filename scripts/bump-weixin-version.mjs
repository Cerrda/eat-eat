import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

const file = new URL('../.minicirc', import.meta.url)
const config = JSON.parse(readFileSync(file, 'utf8'))
const current = typeof config.version === 'string' ? config.version : '0.0.0'
const parts = current.split('.')

if (parts.length !== 3 || parts.some(part => !/^\d+$/.test(part))) {
  console.error(`版本号须为 x.y.z，当前为 ${current}`)
  process.exit(1)
}

const next = `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`
config.version = next
config.desc = `EatEat ${next}`
writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
console.log(`本次上传版本号 ${next}`)
