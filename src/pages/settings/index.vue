<script setup lang="ts">
import type { AccountView, Role } from '@/api/eat'
import { ROLE_LABEL, unbind, updateNickname } from '@/api/eat'
import { ensureAccount, peekAccount, rememberAccount, routeAccount } from '@/utils/account'
import { textLength } from '@/utils/format'
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
const partnerLine = computed(() => {
  if (!account.value?.partnerNickname)
    return ''
  const role = account.value.partnerRole
  const label = role ? ROLE_LABEL[role as Role] : ''
  return label ? `${account.value.partnerNickname}  ·  ${label}` : account.value.partnerNickname
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
    uni.showToast({ title: '称呼要 2 到 8 个字', icon: 'none' })
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
    <view class="flex flex-col gap-28rpx">
      <text class="text-44rpx text-#3c2428 leading-[1.15] font-display">
        设置
      </text>
      <template v-if="account">
      <view class="flex flex-col items-start">
        <text class="text-72rpx text-#3c2428 leading-[1.15] font-display">
          称呼
        </text>
        <image class="mt-8rpx block w-140rpx" src="/static/underline.png" mode="widthFix" />
      </view>
      <view class="flex items-center rounded-28rpx bg-#fff9f4 px-28rpx py-24rpx">
        <input
          v-model="nickname"
          class="flex-1 text-48rpx text-#3c2428 font-display"
          :maxlength="8"
          confirm-type="done"
          @blur="saveNickname"
          @confirm="saveNickname"
        >
        <text class="text-26rpx text-#7a534c font-body">
          {{ textLength(nickname) }} / 8
        </text>
      </view>
      <text class="mt-12rpx text-28rpx text-#7a534c font-body">
        绑定对象
      </text>
      <text class="text-48rpx text-#3c2428 leading-[1.3] font-display">
        {{ partnerLine }}
      </text>
      <stamp-button :variant="account.role === 'eater' ? 'ghost' : 'solid'" :disabled="pending" :busy="pending" @tap="leave">
        {{ pending ? '正在解除' : '解除绑定' }}
      </stamp-button>
      </template>
      <ink-load v-else label="正在打开设置" />
    </view>
    <template #dock>
      <tab-dock :role="dockRole" current="settings" :badges="badges" />
    </template>
  </paper-page>
</template>
