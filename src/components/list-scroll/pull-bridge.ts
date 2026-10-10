export interface PullHooks {
  hold: () => void
  done: () => void
  moved: () => void
}

export const pullHandlers = new Map<number, PullHooks>()

export function hooksOf(vm: {
  pullHooks?: PullHooks
  uid?: number
  $?: { uid?: number, pullHooks?: PullHooks }
}) {
  if (vm.pullHooks)
    return vm.pullHooks
  if (vm.$?.pullHooks)
    return vm.$.pullHooks
  const uid = vm.$?.uid ?? vm.uid
  if (uid == null)
    return
  return pullHandlers.get(uid)
}
