export type TabShift = 'left' | 'right' | ''

let originKey = ''
let shift: TabShift = ''

export function beginTabSwitch(fromKey: string, fromIndex: number, toIndex: number) {
  originKey = fromKey
  if (toIndex > fromIndex)
    shift = 'right'
  else if (toIndex < fromIndex)
    shift = 'left'
  else
    shift = ''
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
