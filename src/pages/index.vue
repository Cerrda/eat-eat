<script setup lang="ts">
import type { Role } from '@/api/eat'
import { createInvite, EatRequestError } from '@/api/eat'
import { useTopPadding } from '@/composables/useTopPadding'
import { loadAccount, routeAccount } from '@/utils/account'
import { normalizeCode } from '@/utils/format'
import { showError } from '@/utils/ui'

definePage({
  type: 'home',
  layout: false,
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const topPadding = useTopPadding()
const ready = ref(false)
const pending = ref<'' | Role>('')
let opened = false

async function boot(query?: Record<string, string | undefined>) {
  const code = normalizeCode(String(query?.code || query?.inviteCode || ''))
  if (code) {
    uni.redirectTo({ url: `/pages/bind/join?code=${code}` })
    return
  }
  try {
    const view = await loadAccount(true)
    if (view.next !== 'choose') {
      const left = await routeAccount(view)
      if (left)
        return
    }
  }
  catch (err) {
    showError(err)
  }
  ready.value = true
}

onLoad(query => boot(query))
onShow(() => {
  if (!opened) {
    opened = true
    return
  }
  boot()
})

async function generate(role: Role) {
  if (pending.value)
    return
  pending.value = role
  try {
    const data = await createInvite(role)
    routeAccount(data)
  }
  catch (err) {
    if (err instanceof EatRequestError && err.errCode === 'ALREADY_BOUND') {
      const view = await loadAccount(true)
      routeAccount(view)
      return
    }
    showError(err)
  }
  finally {
    pending.value = ''
  }
}

function fillCode() {
  uni.navigateTo({
    url: '/pages/bind/join',
  })
}
</script>

<template>
  <view v-if="ready" class="relative min-h-screen w-full bg-#fbf3ea">
    <image class="pointer-events-none fixed left-0 top-0 z-0 h-screen w-full" src="/static/paper.jpg" mode="aspectFill" />
    <view
      class="relative z-1 box-border flex flex-col gap-42rpx px-42rpx pb-[calc(54rpx+env(safe-area-inset-bottom))]"
      :style="{ paddingTop: topPadding }"
    >
      <view class="flex items-center">
        <text class="text-42rpx text-#3c2428 font-normal leading-[1.15] font-display italic">
          EatEat
        </text>
      </view>

      <view class="flex justify-center">
        <image class="w-404rpx" src="/static/pot.png" mode="widthFix" />
      </view>

      <view class="box-border flex flex-col gap-23rpx border-0 border-t-4rpx border-#c9a297 border-solid pb-15rpx pt-42rpx">
        <text class="block text-58rpx text-#3c2428 font-normal leading-[1.15] font-display">
          我来做饭
        </text>
        <stamp-button :disabled="pending !== ''" :busy="pending === 'cooker'" @tap="generate('cooker')">
          {{ pending === 'cooker' ? '正在生成邀请' : '生成邀请，等对方来点餐' }}
        </stamp-button>
      </view>

      <view class="box-border flex flex-col gap-23rpx border-0 border-t-4rpx border-#c9a297 border-solid pb-15rpx pt-42rpx">
        <text class="block text-58rpx text-#3c2428 font-normal leading-[1.15] font-display">
          我来点餐
        </text>
        <stamp-button :disabled="pending !== ''" :busy="pending === 'eater'" @tap="generate('eater')">
          {{ pending === 'eater' ? '正在生成邀请' : '生成邀请，等对方来做饭' }}
        </stamp-button>
      </view>

      <view class="box-border flex flex-col gap-23rpx border-0 border-t-4rpx border-#c9a297 border-solid pb-15rpx pt-42rpx">
        <text class="block text-58rpx text-#3c2428 font-normal leading-[1.15] font-display">
          我有邀请码
        </text>
        <stamp-button :disabled="pending !== ''" @tap="fillCode">
          填上邀请码
        </stamp-button>
      </view>
    </view>
    <ink-toast />
  </view>
  <view v-else class="relative min-h-screen w-full bg-#fbf3ea">
    <image class="pointer-events-none fixed left-0 top-0 z-0 h-screen w-full" src="/static/paper.jpg" mode="aspectFill" />
    <view class="relative z-1 px-44rpx" :style="{ paddingTop: topPadding }">
      <ink-load label="正在打开厨房" />
    </view>
    <ink-toast />
  </view>
</template>
