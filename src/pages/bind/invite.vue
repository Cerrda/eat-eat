<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { refreshInvite } from '@/api/eat'
import { ensureAccount, rememberAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { copyHint } from '@/utils/hint'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const account = ref<AccountView | null>(null)
const pending = ref('')

onShow(async () => {
  try {
    const view = await ensureAccount({ next: 'invite' })
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

async function refresh() {
  if (pending.value)
    return
  pending.value = 'refresh'
  try {
    const view = await refreshInvite()
    rememberAccount(view)
    account.value = view
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = ''
  }
}

function copyCode() {
  if (!account.value?.inviteCode)
    return
  copyHint(account.value.inviteCode, '已复制邀请码')
}
</script>

<template>
  <paper-page>
    <view v-if="account" class="flex flex-col gap-24rpx">
      <text class="text-44rpx text-#3c2428 font-display italic">
        EatEat
      </text>
      <text class="text-40rpx text-#3c2428 leading-[1.45]" :class="faceOf('把这间厨房交给对方', 'sans')">
        把这间厨房交给对方
      </text>
      <code-cells :model-value="account.inviteCode" readonly />
      <text v-if="account.inviteExpired" class="text-26rpx text-#7a534c leading-[1.5] font-body">
        这个码已经过期了。
      </text>
      <stamp-button open-type="share">
        转发给微信好友
      </stamp-button>
      <stamp-button variant="ghost" @tap="copyCode">
        复制邀请码
      </stamp-button>
      <view class="flex items-center justify-center gap-16rpx py-8rpx" @tap="refresh">
        <ink-spin v-if="pending === 'refresh'" tone="muted" />
        <text class="text-28rpx text-#7a534c font-body">
          {{ pending === 'refresh' ? '正在换一个' : '换一个邀请码' }}
        </text>
      </view>
    </view>
    <ink-load v-else label="正在写出邀请" />
  </paper-page>
</template>
