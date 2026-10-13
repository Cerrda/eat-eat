import { execSync } from 'node:child_process'

const fn = `function() { const menu = getCurrentPages().slice(-1)[0].selectComponent('.r'); return new Promise(function(resolve) { wx.createSelectorQuery().in(menu).select('.eat-press').boundingClientRect().select('.plus-count').boundingClientRect().exec(function(res) { resolve(res) }) }) }`
const command = `wechatide -c Cursor automation_evaluate --project "C:\\project\\eat-eat\\dist\\dev\\mp-weixin" --fn-source "${fn}"`
process.stdout.write(execSync(command, { encoding: 'utf8' }))
