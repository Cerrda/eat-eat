<script setup lang="ts">
import type { AccountView, Role } from '@/api/eat'
import { ROLE_LABEL, unbind, updateNickname } from '@/api/eat'
import { ensureAccount, peekAccount, rememberAccount, routeAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { textLength } from '@/utils/format'
import { showHint } from '@/utils/hint'
import { ask, showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const account = ref<AccountView | null>(peekAccount())
const nickname = ref(account.value?.nickname || '')
const pending = ref(false)
const dockRole = computed((): Role => account.value?.role === 'eater' ? 'eater' : 'cooker')
const badges = computed(() => account.value?.badges || { todo: 0, orders: 0, records: 0 })
const partnerRoleLabel = computed(() => {
  const role = account.value?.partnerRole
  if (role !== 'cooker' && role !== 'eater')
    return ''
  return ROLE_LABEL[role]
})
onShow(async () => {
  try {
    const view = await ensureAccount({ next: 'home' })
    if (!view)
      return
    account.value = view
    nickname.value = view.nickname
  }
  catch (err) {
    showError(err)
  }
})

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
  <paper-page dock>
    <view class="flex flex-col gap-32rpx">
      <paper-pin reserve="56rpx">
        <text class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf('设置', 'serif')">
          设置
        </text>
      </paper-pin>
      <template v-if="account">
      <view class="flex flex-col items-start">
        <text class="text-72rpx text-#3c2428 leading-[1.15]" :class="faceOf('称呼', 'serif')">
          称呼
        </text>
        <ink-underline class="mt-8rpx" :width="176" />
      </view>
      <view class="flex items-center rounded-28rpx bg-#fff9f4 px-28rpx">
        <input
          v-model="nickname"
          class="h-96rpx min-w-0 flex-1 text-48rpx text-#3c2428 leading-96rpx"
          :class="faceOf(nickname, 'serif')"
          :maxlength="8"
          confirm-type="done"
          @blur="saveNickname"
          @confirm="saveNickname"
        >
        <text class="text-30rpx text-#7a534c" :class="faceOf(`${textLength(nickname)} / 8`, 'mono')">
          {{ textLength(nickname) }} / 8
        </text>
      </view>
      <text class="mt-12rpx text-28rpx text-#792b3e" :class="faceOf('绑定对象', 'mono')">
        绑定对象
      </text>
      <text class="text-52rpx text-#3c2428 leading-[1.15]">
        <text :class="faceOf(account.partnerNickname || '', 'serif')">{{ account.partnerNickname }}</text>
        <text v-if="partnerRoleLabel">  ·  </text>
        <text v-if="partnerRoleLabel" :class="faceOf(partnerRoleLabel, 'serif')">{{ partnerRoleLabel }}</text>
      </text>
      <view
        class="flex items-center justify-center gap-16rpx border-4rpx border-#9c342c rounded-full border-solid px-32rpx py-28rpx"
        @tap="leave"
      >
        <ink-spin v-if="pending" tone="muted" />
        <text class="text-30rpx text-#9c342c font-medium" :class="faceOf(pending ? '正在解除' : '解除绑定', 'sans')">
          {{ pending ? '正在解除' : '解除绑定' }}
        </text>
      </view>
      </template>
      <ink-load v-else label="正在打开设置" />
    </view>
    <template #dock>
      <tab-dock :role="dockRole" current="settings" :badges="badges" />
    </template>
  </paper-page>
</template>
