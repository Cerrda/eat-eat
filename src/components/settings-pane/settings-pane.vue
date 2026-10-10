<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { ROLE_LABEL, unbind, updateNickname } from '@/api/eat'
import { ensureAccount, peekAccount, rememberAccount, routeAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { keepOneLine, textLength } from '@/utils/format'
import { showHint } from '@/utils/hint'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { ask, showError } from '@/utils/ui'

const account = ref<AccountView | null>(peekAccount())
const nickname = ref(account.value?.nickname || '')
keepOneLine(nickname)
const pending = ref(false)
const partnerLine = computed(() => {
  const name = account.value?.partnerNickname || ''
  const role = account.value?.partnerRole
  if (role !== 'cooker' && role !== 'eater')
    return name
  return `${name}  ·  ${ROLE_LABEL[role]}`
})
async function refresh() {
  try {
    const view = await ensureAccount({ next: 'home' })
    if (!view)
      return
    account.value = view
    nickname.value = view.nickname
    noteBadges(view.badges)
    markTabFresh('settings')
  }
  catch (err) {
    showError(err)
  }
}

onMounted(() => {
  void refresh()
})

defineExpose({ refresh })

async function saveNickname() {
  if (!account.value)
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
    const view = await updateNickname(next)
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

async function leave() {
  if (pending.value)
    return
  const agreed = await ask('解除绑定', '解除后马上生效。', '解除绑定')
  if (!agreed)
    return
  pending.value = true
  try {
    const view = await unbind()
    rememberAccount(view)
    routeAccount(view)
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <view class="shrink-0">
      <screen-head title="设置" />
    </view>
    <scroll-view scroll-y class="h-0 min-h-0 w-full flex-1" :show-scrollbar="false">
      <ink-load v-if="!account" label="正在打开设置" />
      <view v-else class="flex flex-col gap-32rpx pt-32rpx">
        <view class="flex flex-col">
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
          class="box-border h-100rpx flex items-center justify-center gap-16rpx rounded-36rpx border-solid"
          :class="pending ? 'border-3rpx border-#c9a297' : 'border-4rpx border-#9c342c'"
          @tap="leave"
        >
          <ink-spin v-if="pending" tone="muted" />
          <text
            class="text-30rpx font-medium leading-40rpx"
            :class="[faceOf(pending ? '正在解除' : '解除绑定', 'sans'), pending ? 'text-#7a534c' : 'text-#9c342c']"
          >
            {{ pending ? '正在解除' : '解除绑定' }}
          </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>
