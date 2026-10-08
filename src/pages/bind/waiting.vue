<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const account = ref<AccountView | null>(null)
const title = computed(() => account.value?.role === 'eater' ? '等对方来做饭' : '等对方来点餐')

onShow(async () => {
  try {
    const view = await ensureAccount({ next: ['waiting', 'invite'] })
    if (view)
      account.value = view
  }
  catch (err) {
    showError(err)
  }
})

onShareAppMessage(() => ({
  title: account.value?.shareTitle || '来 EatEat',
  path: `/pages/bind/join?code=${account.value?.inviteCode || ''}`,
}))
</script>

<template>
  <paper-page>
    <view v-if="account" class="flex flex-col gap-36rpx">
      <text class="text-44rpx text-#3c2428 font-display italic">
        EatEat
      </text>
      <view class="flex flex-col items-start gap-8rpx">
        <text class="text-80rpx text-#3c2428 leading-[1.15] font-display">
          {{ title }}
        </text>
        <ink-underline :width="170" />
      </view>
      <image class="w-376rpx self-center" src="/static/house.png" mode="widthFix" />
      <view class="flex flex-col gap-12rpx rounded-36rpx bg-#fff9f4 px-32rpx py-28rpx">
        <text class="text-28rpx text-#792b3e font-body">
          邀请码
        </text>
        <text class="text-56rpx text-#3c2428 tracking-[0.18em] font-display">
          {{ account.inviteCode }}
        </text>
      </view>
      <stamp-button variant="ghost" open-type="share">
        再转发给微信好友
      </stamp-button>
    </view>
    <ink-load v-else label="正在打开这间厨房" />
  </paper-page>
</template>
