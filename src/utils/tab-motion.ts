export type TabShift = 'left' | 'right' | ''

let originKey = ''
let shift: TabShift = ''
let idleAt = 0

export function beginTabSwitch(fromKey: string, fromIndex: number, toIndex: number) {
  originKey = fromKey
  if (toIndex > fromIndex)
    shift = 'right'
  else if (toIndex < fromIndex)
    shift = 'left'
  else
    shift = ''
}

export function holdTabMotion(ms: number) {
  const next = Date.now() + ms
  if (next > idleAt)
    idleAt = next
}

export function whenTabIdle() {
  return new Promise<void>((resolve) => {
    const check = () => {
      const wait = idleAt - Date.now()
      if (wait <= 0)
        resolve()
      else
        setTimeout(check, wait)
    }
    check()
  })
}

export function readTabOrigin() {
  return originKey
}

export function readTabShift() {
  return shift
}

export function clearTabMotion() {
  originKey = ''
  shift = ''
}
