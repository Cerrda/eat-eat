import { spawn } from 'node:child_process'
import process from 'node:process'

const url = 'https://mp.weixin.qq.com/wxamp/wacodepage/getcodepage'

const child = process.platform === 'win32'
  ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true })
  : process.platform === 'darwin'
    ? spawn('open', [url], { detached: true, stdio: 'ignore' })
    : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })

child.unref()
