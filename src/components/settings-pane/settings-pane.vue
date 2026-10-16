<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { ROLE_LABEL, swapRoles, unbind, updateNickname } from '@/api/eat'
import { ensureAccount, peekAccount, reloadMe, rememberAccount, routeAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { keepOneLine, textLength } from '@/utils/format'
import { showHint } from '@/utils/hint'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { ask, showError } from '@/utils/ui'

const props = defineProps<{
  snapshot?: AccountView | null
  locked?: boolean
}>()

const emit = defineEmits<{ swapped: [view: AccountView] }>()
const account = ref<AccountView | null>(peekAccount())
const nickname = ref(account.value?.nickname || '')
const nicknameReady = ref(false)
const ledgerKey = ref(0)
const fieldOn = ref(true)
keepOneLine(nickname)
const pending = ref<'swap' | 'leave' | ''>('')
let accountToken = 0
let holdNickname = false
const partnerLine = computed(() => {
  const name = account.value?.partnerNickname || ''
  const role = account.value?.partnerRole
  if (role !== 'cooker' && role !== 'eater')
    return name
  return `${name}  ·  ${ROLE_LABEL[role]}`
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

async function refresh() {
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
      <view v-if="account" class="flex flex-col gap-32rpx pt-32rpx">
        <view :key="ledgerKey" class="flex flex-col">
          <view class="flex flex-col gap-12rpx border-0 border-t-4rpx border-#c9a297 border-solid py-32rpx">
            <view class="flex items-center justify-between">
              <text class="text-28rpx text-#792b3e leading-[1.15] tracking-[2rpx]" :class="faceOf('称呼', 'mono')">
                称呼
              </text>
              <text class="text-30rpx text-#7a534c" :class="faceOf(`${textLength(nickname)} / 8`, 'mono')">
                {{ textLength(nickname) }} / 8
              </text>
            </view>
            <textarea
              v-if="fieldOn"
              :key="ledgerKey"
              v-model="nickname"
              disable-default-padding
              class="h-64rpx w-full text-52rpx text-#3c2428 leading-64rpx"
              :class="faceOf(nickname, 'serif')"
              :maxlength="8"
              confirm-type="done"
              :show-confirm-bar="false"
              @blur="saveNickname"
              @confirm="saveNickname"
            />
          </view>
          <view class="box-border flex flex-col gap-12rpx border-0 border-b-4rpx border-t-4rpx border-#c9a297 border-solid py-32rpx">
            <text class="text-28rpx text-#792b3e leading-[1.15] tracking-[2rpx]" :class="faceOf('绑定对象', 'mono')">
              绑定对象
            </text>
            <text class="text-52rpx text-#3c2428 leading-[1.15]" :class="faceOf(partnerLine, 'serif')">
              {{ partnerLine }}
            </text>
          </view>
        </view>
        <view
          class="eat-press box-border h-100rpx flex items-center justify-center gap-16rpx rounded-36rpx border-solid"
          :class="pending === 'swap' ? 'border-3rpx border-#c9a297' : 'border-4rpx border-#792b3e'"
          :hover-class="pending ? 'none' : 'eat-press-on'"
          :hover-stay-time="140"
          @tap="swap"
        >
          <ink-spin v-if="pending === 'swap'" tone="muted" />
          <text
            class="text-30rpx font-medium leading-40rpx"
            :class="[faceOf(pending === 'swap' ? '正在互换' : '互换角色', 'sans'), pending === 'swap' ? 'text-#7a534c' : 'text-#792b3e']"
          >
            {{ pending === 'swap' ? '正在互换' : '互换角色' }}
          </text>
        </view>
        <view
          class="eat-press box-border h-100rpx flex items-center justify-center gap-16rpx rounded-36rpx border-solid"
          :class="pending === 'leave' ? 'border-3rpx border-#c9a297' : 'border-4rpx border-#9c342c'"
          :hover-class="pending ? 'none' : 'eat-press-on'"
          :hover-stay-time="140"
          @tap="leave"
        >
          <ink-spin v-if="pending === 'leave'" tone="muted" />
          <text
            class="text-30rpx font-medium leading-40rpx"
            :class="[faceOf(pending === 'leave' ? '正在解除' : '解除绑定', 'sans'), pending === 'leave' ? 'text-#7a534c' : 'text-#9c342c']"
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
</style>
