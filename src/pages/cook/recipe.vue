<script setup lang="ts">
import type { CookDish } from '@/api/eat'
import { getCookDish, getDish } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { copyHint } from '@/utils/hint'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const orderId = ref('')
const dishId = ref('')
const dish = ref<CookDish | null>(null)
const categoryName = ref('')

onLoad((query) => {
  orderId.value = String(query?.orderId || '')
  dishId.value = String(query?.dishId || '')
})

onShow(async () => {
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view || !orderId.value || !dishId.value)
      return
    const [cooked, detail] = await Promise.all([
      getCookDish(orderId.value, dishId.value),
      getDish(dishId.value).catch(() => null),
    ])
    dish.value = cooked
    categoryName.value = detail?.categoryName || ''
    await primeFileUrls([cooked.coverFileId])
  }
  catch (err) {
    showError(err)
  }
})

function sourceCopyMessage(text: string) {
  const xiaohongshu = text.indexOf('小红书')
  const douyin = text.indexOf('抖音')
  if (xiaohongshu >= 0 && (douyin < 0 || xiaohongshu < douyin))
    return '已复制小红书链接'
  if (douyin >= 0)
    return '已复制抖音链接'
  return '已复制链接'
}

function copyLink() {
  const sourceUrl = dish.value?.sourceUrl
  if (!sourceUrl)
    return
  copyHint(sourceUrl, sourceCopyMessage(sourceUrl))
}
</script>

<template>
  <paper-page>
    <view class="flex flex-col gap-32rpx">
      <back-bar label="做法" fallback="/pages/cook/todo" />
      <template v-if="dish">
        <view class="flex flex-col items-start">
          <text class="text-64rpx text-#3c2428 leading-[1.15]" :class="faceOf(dish.name, 'serif')">
            {{ dish.name }}
          </text>
          <ink-underline class="mt-8rpx" :width="288" />
        </view>
        <text v-if="categoryName" class="text-30rpx text-#7a534c leading-[1.3]" :class="faceOf(categoryName, 'sans')">
          {{ categoryName }}
        </text>
        <dish-cover class="h-336rpx w-full rounded-36rpx" :file-id="dish.coverFileId" :name="dish.name" />
        <view v-if="dish.ingredients.length" class="flex flex-col gap-8rpx">
          <text class="text-28rpx text-#792b3e" :class="faceOf('食材', 'mono')">
            食材
          </text>
          <text v-for="(line, index) in dish.ingredients" :key="index" class="text-32rpx text-#3c2428 leading-[1.45]" :class="faceOf(line, 'sans')">
            {{ line }}
          </text>
        </view>
        <view v-if="dish.steps.length" class="flex flex-col gap-16rpx">
          <text class="text-28rpx text-#792b3e" :class="faceOf('步骤', 'mono')">
            步骤
          </text>
          <view v-for="(step, index) in dish.steps" :key="index" class="flex gap-16rpx">
            <text class="text-32rpx text-#792b3e" :class="faceOf(String(index + 1), 'mono')">
              {{ index + 1 }}
            </text>
            <text class="flex-1 text-32rpx text-#3c2428 leading-[1.45]" :class="faceOf(step, 'sans')">
              {{ step }}
            </text>
          </view>
        </view>
        <text v-if="!dish.ingredients.length && !dish.steps.length" class="text-30rpx text-#7a534c" :class="faceOf('这道菜没有写下做法。', 'sans')">
          这道菜没有写下做法。
        </text>
        <view v-if="dish.sourceUrl" class="flex flex-col items-start gap-16rpx pt-8rpx">
          <text class="text-28rpx text-#792b3e" :class="faceOf('来源', 'mono')">
            来源
          </text>
          <view class="rounded-full bg-#792b3e px-36rpx py-16rpx" @tap="copyLink">
            <text class="text-30rpx text-#fbf3ea font-medium" :class="faceOf('复制链接', 'sans')">
              复制链接
            </text>
          </view>
        </view>
      </template>
      <ink-load v-else label="正在打开做法" />
    </view>
  </paper-page>
</template>
