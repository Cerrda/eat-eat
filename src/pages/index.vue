<script setup lang="ts">
definePage({
  type: 'home',
  layout: false,
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const topPadding = ref('87px')

onLoad(() => {
  const info = uni.getWindowInfo()
  const statusBar = info.statusBarHeight ?? 0
  let anchor = statusBar + 35
  // #ifdef MP-WEIXIN
  const menu = uni.getMenuButtonBoundingClientRect()
  if (menu.bottom)
    anchor = menu.bottom + 4
  // #endif
  topPadding.value = `${anchor}px`
})
</script>

<template>
  <view class="relative box-border max-w-full min-h-screen w-full bg-#fbf3ea">
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

      <text class="block text-77rpx text-#3c2428 font-normal leading-[1.15] font-display">
        谁来开这间厨房
      </text>
      <image class="block w-170rpx self-start" src="/static/underline.png" mode="widthFix" />
      <text class="block text-29rpx text-#7a534c font-normal leading-[1.5] font-body">
        先打开的人选一边。另一个人加入后，自动成为另一边。
      </text>

      <view class="flex justify-center">
        <image class="w-404rpx" src="/static/pot.png" mode="widthFix" />
      </view>

      <view class="box-border flex flex-col gap-23rpx border-0 border-t-4rpx border-#c9a297 border-solid pb-15rpx pt-42rpx">
        <text class="block text-58rpx text-#3c2428 font-normal leading-[1.15] font-display">
          我来做饭
        </text>
        <text class="block text-29rpx text-#7a534c font-normal leading-[1.5] font-body">
          我来上架菜、接下这一餐、记下做过的饭。
        </text>
        <view class="relative">
          <view class="absolute bottom--8rpx left-6rpx right--6rpx top-8rpx rounded-50rpx bg-#4e222d/35" />
          <view
            class="relative box-border flex items-center justify-center border-4rpx border-#792b3e rounded-50rpx border-solid bg-#792b3e px-31rpx py-29rpx"
            hover-class="translate-x-6rpx translate-y-8rpx"
            :hover-stay-time="80"
          >
            <text class="text-29rpx text-#fbf3ea font-medium leading-[1.2] font-body">
              生成邀请，等对方来点餐
            </text>
          </view>
        </view>
      </view>

      <view class="box-border flex flex-col gap-23rpx border-0 border-t-4rpx border-#c9a297 border-solid pb-15rpx pt-42rpx">
        <text class="block text-58rpx text-#3c2428 font-normal leading-[1.15] font-display">
          我来点餐
        </text>
        <text class="block text-29rpx text-#7a534c font-normal leading-[1.5] font-body">
          我来点早上、中午和晚上。
        </text>
        <view class="relative">
          <view class="absolute bottom--8rpx left-6rpx right--6rpx top-8rpx rounded-50rpx bg-#4e222d/35" />
          <view
            class="relative box-border flex items-center justify-center border-4rpx border-#792b3e rounded-50rpx border-solid bg-#792b3e px-31rpx py-29rpx"
            hover-class="translate-x-6rpx translate-y-8rpx"
            :hover-stay-time="80"
          >
            <text class="text-29rpx text-#fbf3ea font-medium leading-[1.2] font-body">
              生成邀请，等对方来做饭
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
@font-face {
  font-family: "Ma Shan Zheng";
  src: url("@/static/fonts/ma-shan-zheng.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: "LXGW WenKai";
  src: url("@/static/fonts/lxgw-wenkai.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: "LXGW WenKai";
  src: url("@/static/fonts/lxgw-wenkai-medium.ttf") format("truetype");
  font-weight: 500;
  font-style: normal;
}

page {
  width: 100%;
  overflow-x: hidden;
  background-color: #fbf3ea;
}
</style>
