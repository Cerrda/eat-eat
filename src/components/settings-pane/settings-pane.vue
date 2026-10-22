<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { ROLE_LABEL, swapRoles, unbind, updateNickname } from '@/api/eat'
import { ensureAccount, peekAccount, reloadMe, rememberAccount, routeAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { keepOneLine, textLength } from '@/utils/format'
import { showHint } from '@/utils/hint'
import { clearImageCache, formatCacheSize, imageCacheInfo } from '@/utils/imageCache'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { setTheme, theme } from '@/utils/theme'
import { ask, showError } from '@/utils/ui'

const props = defineProps<{
  snapshot?: AccountView | null
  locked?: boolean
  active?: boolean
}>()

const emit = defineEmits<{ swapped: [view: AccountView], cleared: [] }>()
const account = ref<AccountView | null>(peekAccount())
const nickname = ref(account.value?.nickname || '')
const nicknameReady = ref(false)
const ledgerKey = ref(0)
const fieldOn = ref(true)
keepOneLine(nickname)
const pending = ref<'swap' | 'leave' | ''>('')
const inkGo = ref(false)
const cacheBytes = ref(0)
const cacheBusy = ref(false)
let cacheToken = 0
let accountToken = 0
let holdNickname = false
let inkToken = 0
let inkTimer: ReturnType<typeof setTimeout> | undefined
const selfRole = computed(() => {
  const role = account.value?.role
  return role === 'cooker' || role === 'eater' ? ROLE_LABEL[role] : ''
})
const partnerRoleText = computed(() => {
  const role = account.value?.partnerRole
  return role === 'cooker' || role === 'eater' ? ROLE_LABEL[role] : ''
})
function applyAccount(view: AccountView) {
  accountToken += 1
  holdNickname = true
  account.value = view
  nickname.value = view.nickname
  fieldOn.value = false
  ledgerKey.value += 1
  nextTick(() => {
    fieldOn.value = true
    nextTick(() => {
      holdNickname = false
    })
  })
}

async function readCacheInfo() {
  const token = ++cacheToken
  try {
    const info = await imageCacheInfo()
    if (token === cacheToken)
      cacheBytes.value = info.bytes
  }
  catch {
    if (token === cacheToken)
      cacheBytes.value = 0
  }
}

async function clearCache() {
  if (cacheBusy.value)
    return
  cacheBusy.value = true
  cacheToken += 1
  try {
    const freed = await clearImageCache()
    cacheBytes.value = 0
    if (freed > 0) {
      emit('cleared')
      showHint(`已清理 ${formatCacheSize(freed)}`)
    }
    else {
      showHint('还没有图片缓存')
    }
  }
  catch {
    void readCacheInfo()
    showHint('这次没清掉，再试一次')
  }
  finally {
    cacheBusy.value = false
  }
}

async function refresh() {
  void readCacheInfo()
  const token = ++accountToken
  nicknameReady.value = false
  try {
    const view = await ensureAccount({ next: 'home' })
    if (!view || token !== accountToken)
      return
    account.value = view
    nickname.value = view.nickname
    nicknameReady.value = true
    if (!props.locked)
      noteBadges(view.badges)
    markTabFresh('settings')
  }
  catch (err) {
    showError(err)
  }
}

watch(() => props.snapshot, (view) => {
  if (!view)
    return
  nextTick(() => {
    applyAccount(view)
    nicknameReady.value = true
  })
})

onMounted(() => {
  void refresh()
})

watch(() => props.active, (on) => {
  if (on)
    void readCacheInfo()
})

defineExpose({ refresh })

async function saveNickname() {
  if (holdNickname || !nicknameReady.value || !account.value)
    return
  const next = nickname.value.trim()
  if (next === account.value.nickname)
    return
  if (textLength(next) < 2 || textLength(next) > 8) {
    showHint('称呼要 2 到 8 个字')
    nickname.value = account.value.nickname
    return
  }
  try {
    const saved = await updateNickname(next)
    let view = saved
    try {
      view = await reloadMe()
    }
    catch {
      view = saved
    }
    rememberAccount(view)
    account.value = view
    nickname.value = view.nickname
    noteBadges(view.badges)
  }
  catch (err) {
    nickname.value = account.value.nickname
    showError(err)
  }
}

function pickTheme(next: 'light' | 'dark') {
  if (theme.value === next)
    return
  const token = ++inkToken
  if (inkTimer)
    clearTimeout(inkTimer)
  inkGo.value = false
  setTheme(next)
  nextTick(() => {
    if (token !== inkToken)
      return
    inkGo.value = true
    inkTimer = setTimeout(() => {
      if (token !== inkToken)
        return
      inkGo.value = false
      inkTimer = undefined
    }, 300)
  })
}

onUnmounted(() => {
  if (inkTimer)
    clearTimeout(inkTimer)
})

async function swap() {
  if (pending.value || props.locked)
    return
  const agreed = await ask(
    '互换角色',
    '对调之后马上生效。你去做对方现在的事，对方来做你的事。正在进行的订单还留着。',
    '互换',
  )
  if (!agreed || pending.value)
    return
  pending.value = 'swap'
  try {
    const view = await swapRoles()
    rememberAccount(view)
    applyAccount(view)
    nicknameReady.value = true
    if (view.role === 'cooker' || view.role === 'eater')
      emit('swapped', view)
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = ''
  }
}

async function leave() {
  if (pending.value || props.locked)
    return
  const agreed = await ask('解除绑定', '解除后马上生效。', '解除绑定')
  if (!agreed || pending.value)
    return
  pending.value = 'leave'
  try {
    const view = await unbind()
    rememberAccount(view)
    routeAccount(view)
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = ''
  }
}
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <scroll-view scroll-y enhanced class="h-0 min-h-0 w-full flex-1" :show-scrollbar="false">
      <screen-head title="设置" />
      <view v-if="account" class="flex flex-col gap-56rpx pt-48rpx">
        <view class="flex items-center justify-center gap-96rpx">
          <view class="flex flex-col items-center">
            <text class="text-64rpx text-ink leading-[1.15]" :class="faceOf(account.nickname, 'serif')">
              {{ account.nickname }}
            </text>
            <text class="text-32rpx text-muted leading-[1.8]" :class="faceOf(selfRole, 'serif')">
              {{ selfRole }}
            </text>
          </view>
          <view class="h-72rpx w-4rpx shrink-0 bg-accent" />
          <view class="flex flex-col items-center">
            <text class="text-64rpx text-ink leading-[1.15]" :class="faceOf(account.partnerNickname || '', 'serif')">
              {{ account.partnerNickname }}
            </text>
            <text class="text-32rpx text-muted leading-[1.8]" :class="faceOf(partnerRoleText, 'serif')">
              {{ partnerRoleText }}
            </text>
          </view>
        </view>
        <view :key="ledgerKey" class="flex flex-col">
          <view class="flex flex-col gap-12rpx border-0 border-t-4rpx border-rule border-solid py-32rpx">
            <view class="flex items-center justify-between">
              <text class="text-28rpx text-accent leading-[1.15] tracking-[2rpx]" :class="faceOf('称呼', 'mono')">
                称呼
              </text>
              <text class="text-30rpx text-muted" :class="faceOf(`${textLength(nickname)} / 8`, 'mono')">
                {{ textLength(nickname) }} / 8
              </text>
            </view>
            <textarea
              v-if="fieldOn"
              :key="ledgerKey"
              v-model="nickname"
              disable-default-padding
              class="h-64rpx w-full text-52rpx text-ink leading-64rpx"
              :class="faceOf(nickname, 'serif')"
              :maxlength="8"
              confirm-type="done"
              :show-confirm-bar="false"
              @blur="saveNickname"
              @confirm="saveNickname"
            />
          </view>
          <view class="flex flex-col gap-24rpx border-0 border-t-4rpx border-solid py-32rpx border-rule">
            <text class="text-28rpx text-accent leading-[1.15] tracking-[2rpx]" :class="faceOf('外观', 'mono')">
              外观
            </text>
            <view
              class="eat-press relative h-96rpx flex overflow-hidden border-4rpx border-rule rounded-36rpx border-solid"
              hover-class="eat-press-on"
              :hover-stay-time="140"
            >
              <view class="theme-switch-ink" :class="theme === 'dark' ? 'theme-switch-ink-dark' : ''">
                <view class="theme-switch-ink-body" :class="inkGo ? 'theme-switch-ink-go' : ''" />
              </view>
              <view class="relative z-1 flex flex-1 items-center justify-center" @tap="pickTheme('light')">
                <text
                  class="theme-switch-label text-32rpx leading-none"
                  :class="[faceOf('浅色', 'serif'), theme === 'light' ? 'text-on-accent' : 'text-muted']"
                >
                  浅色
                </text>
              </view>
              <view class="relative z-1 flex flex-1 items-center justify-center" @tap="pickTheme('dark')">
                <text
                  class="theme-switch-label text-32rpx leading-none"
                  :class="[faceOf('深色', 'serif'), theme === 'dark' ? 'text-on-accent' : 'text-muted']"
                >
                  深色
                </text>
              </view>
            </view>
          </view>
          <view class="flex flex-col gap-24rpx border-0 border-t-4rpx border-solid pt-32rpx border-rule">
            <text class="text-28rpx leading-[1.15] tracking-[2rpx] text-accent" :class="faceOf('缓存', 'mono')">
              缓存
            </text>
            <view class="flex items-center justify-between">
              <text class="text-30rpx leading-[1.15] text-ink" :class="faceOf('图片缓存', 'serif')">
                图片缓存
              </text>
              <view class="flex items-center gap-16rpx">
                <text class="text-24rpx leading-[1.15] text-muted" :class="faceOf(formatCacheSize(cacheBytes), 'mono')">
                  {{ formatCacheSize(cacheBytes) }}
                </text>
                <view
                  class="eat-press box-border border-3rpx rounded-full border-solid px-28rpx py-12rpx border-line"
                  :hover-class="cacheBusy ? 'none' : 'eat-press-on'"
                  :hover-stay-time="140"
                  @tap="clearCache"
                >
                  <text
                    class="text-26rpx leading-[1.15]"
                    :class="[faceOf(cacheBusy ? '清理中' : '清理', 'serif'), cacheBusy ? 'text-muted' : 'text-accent']"
                  >
                    {{ cacheBusy ? '清理中' : '清理' }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view
          class="eat-press box-border h-100rpx flex items-center justify-center gap-16rpx rounded-36rpx border-solid"
          :class="pending === 'swap' ? 'border-3rpx border-line' : 'border-4rpx border-accent'"
          :hover-class="pending ? 'none' : 'eat-press-on'"
          :hover-stay-time="140"
          @tap="swap"
        >
          <ink-spin v-if="pending === 'swap'" tone="muted" />
          <text
            class="text-30rpx font-medium leading-40rpx"
            :class="[faceOf(pending === 'swap' ? '正在互换' : '互换角色', 'sans'), pending === 'swap' ? 'text-muted' : 'text-accent']"
          >
            {{ pending === 'swap' ? '正在互换' : '互换角色' }}
          </text>
        </view>
        <view
          class="eat-press box-border h-100rpx flex items-center justify-center gap-16rpx rounded-36rpx border-solid"
          :class="pending === 'leave' ? 'border-3rpx border-line' : 'border-4rpx border-danger'"
          :hover-class="pending ? 'none' : 'eat-press-on'"
          :hover-stay-time="140"
          @tap="leave"
        >
          <ink-spin v-if="pending === 'leave'" tone="muted" />
          <text
            class="text-30rpx font-medium leading-40rpx"
            :class="[faceOf(pending === 'leave' ? '正在解除' : '解除绑定', 'sans'), pending === 'leave' ? 'text-muted' : 'text-danger']"
          >
            {{ pending === 'leave' ? '正在解除' : '解除绑定' }}
          </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style>
@import "../../styles/motion.css";
@import "../../styles/scrollbar.css";

.theme-switch-ink {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 50%;
  transition: transform 280ms cubic-bezier(0.22, 1.06, 0.36, 1);
}

.theme-switch-ink-dark {
  transform: translate3d(100%, 0, 0);
}

.theme-switch-ink-body {
  width: 100%;
  height: 100%;
  background-color: var(--accent);
  transform-origin: center;
}

.theme-switch-ink-go {
  animation: theme-switch-squash 280ms linear both;
}

.theme-switch-label {
  transition: color 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes theme-switch-squash {
  0% {
    transform: scale(1, 1);
  }

  42% {
    transform: scale(1.06, 0.9);
  }

  100% {
    transform: scale(1, 1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .theme-switch-ink,
  .theme-switch-label {
    transition: none;
  }

  .theme-switch-ink-go {
    animation: none;
  }
}
</style>
