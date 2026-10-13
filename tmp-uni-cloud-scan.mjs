import { readFileSync, writeFileSync } from 'node:fs'

const s = readFileSync('node_modules/@dcloudio/uni-cloud/dist/uni-cloud.cjs.js', 'utf8')
const i = s.indexOf('importObject')
console.log('first importObject', i)
const j = s.indexOf('function Bs(')
console.log('Bs', j)
const k = s.indexOf('Bs=function')
console.log('Bs=', k)
const m = s.lastIndexOf('importObject=function')
console.log('importObject=function', m)
writeFileSync('tmp-slice-obj.txt', s.slice(s.indexOf('e.importObject=Bs'), s.indexOf('e.importObject=Bs') + 200))

const needle = '.importObject=function'
let p = 0
let n = 0
while ((p = s.indexOf('importObject', p)) !== -1 && n < 15) {
  console.log('at', p, s.slice(p, p + 80).replace(/\n/g, ' '))
  p += 12
  n++
}
