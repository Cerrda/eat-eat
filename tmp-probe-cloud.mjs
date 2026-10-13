import { readFileSync } from 'node:fs'

const s = readFileSync('node_modules/@dcloudio/uni-cloud/dist/uni-cloud.cjs.js', 'utf8')
const i = s.indexOf('function Bs(')
console.log(s.slice(i, i + 2200))
