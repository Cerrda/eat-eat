<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { useCapsuleClearance } from '@/composables/useTopPadding'
import { beginChoose, ensureAccount } from '@/utils/account'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const account = ref<AccountView | null>(null)
const clearance = useCapsuleClearance()
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

function rechoose() {
  beginChoose()
  uni.reLaunch({ url: '/pages/index' })
}

onShareAppMessage(() => ({
  title: account.value?.shareTitle || '来 EatEat',
  path: `/pages/bind/join?code=${account.value?.inviteCode || ''}`,
}))
</script>

<template>
  <paper-page>
    <view :style="{ paddingTop: clearance }">
      <view v-if="account" class="flex flex-col gap-42rpx">
        <view class="eat-rise">
          <text class="text-42rpx text-#3c2428 font-normal leading-[1.15] font-display italic">
            EatEat
          </text>
        </view>
        <view class="eat-rise eat-delay-1 flex flex-col gap-19rpx">
          <text class="text-58rpx text-#3c2428 font-normal leading-[1.15] font-display">
            {{ title }}
          </text>
          <text class="text-27rpx text-#7a534c leading-[1.55] font-body">
            灯还亮着。对方点开，就能进来。
          </text>
        </view>
        <view class="eat-float flex justify-center pt-4rpx">
          <image class="w-362rpx" src="/static/house.png" mode="widthFix" />
        </view>
        <view class="eat-rise eat-delay-3 box-border flex flex-col gap-12rpx border-2rpx border-#c9a297 rounded-35rpx border-solid bg-#fff9f4 px-35rpx py-31rpx">
          <text class="text-25rpx text-#792b3e leading-[1.45] font-body">
            邀请码
          </text>
          <text class="text-54rpx text-#3c2428 leading-[1.15] tracking-[4rpx] font-mono">
            {{ account.inviteCode }}
          </text>
        </view>
        <stamp-button flat open-type="share">
          再转发给微信好友
        </stamp-button>
        <view class="flex flex-col gap-31rpx pt-35rpx">
          <view class="h-2rpx w-full bg-#3c2428" />
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
      <ink-load v-else label="正在打开这间厨房" />
    </view>
  </paper-page>
</template>
