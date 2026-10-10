<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { refreshInvite } from '@/api/eat'
import { useCapsuleClearance } from '@/composables/useTopPadding'
import { beginChoose, ensureAccount, rememberAccount } from '@/utils/account'
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
const clearance = useCapsuleClearance()

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

function rechoose() {
  if (pending.value)
    return
  beginChoose()
  uni.reLaunch({ url: '/pages/index' })
}

function copyCode() {
  if (!account.value?.inviteCode)
    return
  copyHint(account.value.inviteCode, '已复制邀请码')
}
</script>

<template>
  <paper-page>
    <view :style="{ paddingTop: clearance }">
      <view v-if="account" class="flex flex-col gap-38rpx">
        <view class="eat-rise">
          <text class="text-42rpx text-#3c2428 font-normal leading-[1.15] font-display italic">
            EatEat
          </text>
        </view>
        <view class="eat-rise eat-delay-1 flex flex-col gap-19rpx">
          <view class="flex flex-col">
            <text class="text-58rpx text-#3c2428 font-normal leading-[1.15] font-display">
              把这间厨房
            </text>
            <text class="text-58rpx text-#3c2428 font-normal leading-[1.15] font-display">
              交给对方
            </text>
          </view>
          <text class="text-27rpx text-#7a534c leading-[1.55] font-body">
            对方点开这条，就能进来。
          </text>
        </view>
        <view class="eat-pop eat-delay-2 flex flex-col gap-12rpx">
          <code-cells :model-value="account.inviteCode" readonly />
          <text v-if="account.inviteExpired" class="text-27rpx text-#7a534c leading-[1.55] font-body">
            这个码已经过期了。
          </text>
        </view>
        <view class="eat-rise eat-delay-4 flex flex-col gap-38rpx">
          <stamp-button flat open-type="share">
            转发给微信好友
          </stamp-button>
          <stamp-button flat variant="ghost" @button-tap="copyCode">
            复制邀请码
          </stamp-button>
        </view>
        <view class="flex flex-col gap-31rpx pt-35rpx">
          <view class="h-2rpx w-full bg-#3c2428" />
          <view class="flex flex-col gap-4rpx">
            <view class="flex items-center gap-12rpx py-19rpx" @tap="refresh">
              <ink-spin v-if="pending === 'refresh'" tone="muted" />
              <text class="text-29rpx text-#3c2428 leading-[1.45] font-body">
                {{ pending === 'refresh' ? '正在换一个' : '换一个邀请码' }}
              </text>
            </view>
            <view class="flex items-center py-19rpx" @tap="rechoose">
              <text class="text-29rpx text-#7a534c leading-[1.45] font-body">
                选错了这边，
              </text>
              <view class="flex flex-col gap-6rpx">
                <text class="text-29rpx text-#792b3e leading-[1.45] font-body">
                  回到选择
                </text>
                <view class="h-2rpx w-full rounded-2rpx bg-#792b3e" />
              </view>
            </view>
          </view>
        </view>
      </view>
      <ink-load v-else label="正在写出邀请" />
    </view>
  </paper-page>
</template>
