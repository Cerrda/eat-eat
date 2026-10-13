<script setup lang="ts">
import type { TabPanePose } from '@/utils/tabs'
import { useTopPadding } from '@/composables/useTopPadding'
import { menuPanePose } from '@/utils/tabs'

const props = defineProps<{
  active: boolean
  motion: '' | 'left' | 'right'
  publish?: boolean
}>()

const ENTER_MS = 400
const topPadding = useTopPadding()
const instance = getCurrentInstance()
const slide = `${uni.upx2px(32)}px`
const identity = 'translate3d(0, 0, 0)'
const ease = `opacity ${ENTER_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${ENTER_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
const restPose: TabPanePose = { opacity: '1', transform: 'none', transition: 'none' }

const pose = ref<TabPanePose>({ ...restPose })
let token = 0
const pending: ReturnType<typeof setTimeout>[] = []

watch(pose, (value) => {
  if (props.publish)
    menuPanePose.value = value
})

const shellStyle = computed(() => ({
  height: '100vh',
  paddingTop: topPadding.value,
  paddingBottom: 'calc(184rpx + env(safe-area-inset-bottom))',
  visibility: props.active ? 'visible' : 'hidden',
  pointerEvents: props.active ? 'auto' : 'none',
  zIndex: props.active ? 1 : 0,
  opacity: pose.value.opacity,
  transform: pose.value.transform,
  transition: pose.value.transition,
}))

watch(() => props.active, (on) => {
  if (on)
    return
  stop()
  pose.value = { ...restPose }
})

watch(() => props.motion, (value) => {
  if (!props.active || !value)
    return
  stop()
  const current = token
  const offset = value === 'right' ? slide : `-${slide}`
  pose.value = {
    opacity: '0',
    transform: `translate3d(${offset}, 0, 0)`,
    transition: 'none',
  }
  nextTick(() => {
    if (current !== token || !props.active)
      return
    let armed = false
    const run = () => {
      if (armed || current !== token || !props.active)
        return
      armed = true
      pose.value = {
        opacity: '0',
        transform: `translate3d(${offset}, 0, 0)`,
        transition: ease,
      }
      later(() => {
        if (current !== token || !props.active)
          return
        pose.value = { opacity: '1', transform: identity, transition: ease }
        later(() => {
          if (current !== token || !props.active)
            return
          pose.value = { ...restPose }
        }, ENTER_MS + 24)
      }, 32)
    }
    later(run, 48)
    const proxy = instance?.proxy
    if (!proxy)
      return
    uni.createSelectorQuery().in(proxy).select('.tab-pane').boundingClientRect(() => {
      run()
    }).exec()
  })
})

onUnmounted(stop)

function stop() {
  token += 1
  clearPending()
}

function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    const index = pending.indexOf(id)
    if (index >= 0)
      pending.splice(index, 1)
    fn()
  }, ms)
  pending.push(id)
}

function clearPending() {
  for (const id of pending)
    clearTimeout(id)
  pending.length = 0
}
</script>

<template>
  <view
    class="tab-pane fixed left-0 top-0 box-border w-full flex flex-col overflow-hidden"
    :style="shellStyle"
  >
    <view class="h-0 min-h-0 flex flex-1 flex-col px-44rpx">
      <slot />
    </view>
  </view>
</template>
