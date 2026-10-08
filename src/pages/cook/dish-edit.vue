<script setup lang="ts">
import type { Category, DishDetail } from '@/api/eat'
import { deleteDish, getDish, listCategories, publishDish, unpublishDish } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { chooseImage, confirmPhotoUse, ignoredCancel, primeFileUrls, uploadImage } from '@/utils/files'
import { splitPieces } from '@/utils/format'
import { ask, showError } from '@/utils/ui'

function stepLines(value: string) {
  return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
}

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const dishId = ref('')
const categories = ref<Category[]>([])
const loaded = ref(false)
const status = ref<'on' | 'off' | ''>('')
const name = ref('')
const categoryId = ref('')
const summary = ref('')
const ingredients = ref('')
const stepsText = ref('')
const stepsOpen = ref(false)
const sourceUrl = ref('')
const coverFileId = ref('')
const localCover = ref('')
const pending = ref('')
const booted = ref(false)

onLoad((query) => {
  dishId.value = String(query?.id || '')
})

onShow(() => {
  void refresh()
})

async function refresh() {
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view)
      return
    categories.value = (await listCategories()).categories
    if (dishId.value && !loaded.value) {
      const dish = await getDish(dishId.value)
      fill(dish)
      loaded.value = true
      await primeFileUrls([dish.coverFileId])
    }
    booted.value = true
  }
  catch (err) {
    booted.value = true
    showError(err)
  }
}

function fill(dish: DishDetail) {
  status.value = dish.status
  name.value = dish.name
  categoryId.value = dish.categoryId
  summary.value = dish.summary
  ingredients.value = dish.ingredients.join('\n')
  stepsText.value = dish.steps.join('\n')
  stepsOpen.value = false
  sourceUrl.value = dish.sourceUrl
  coverFileId.value = dish.coverFileId
}

async function pickCover(source: 'album' | 'camera') {
  const allowed = await confirmPhotoUse('cover')
  if (!allowed)
    return
  try {
    const path = await chooseImage(source)
    localCover.value = path
    coverFileId.value = await uploadImage(path, 'covers')
    localCover.value = ''
  }
  catch (err) {
    localCover.value = ''
    if (!ignoredCancel(err))
      showError(err)
  }
}

async function publish() {
  if (pending.value)
    return
  pending.value = 'publish'
  try {
    await publishDish({
      dishId: dishId.value || undefined,
      name: name.value.trim(),
      categoryId: categoryId.value || undefined,
      summary: summary.value.trim(),
      ingredients: splitPieces(ingredients.value),
      steps: stepLines(stepsText.value),
      sourceUrl: sourceUrl.value.trim(),
      coverFileId: coverFileId.value,
    })
    uni.navigateBack()
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = ''
  }
}

async function unpublish() {
  if (!dishId.value || pending.value)
    return
  pending.value = 'off'
  try {
    await unpublishDish(dishId.value)
    uni.navigateBack()
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = ''
  }
}

function openCategories() {
  uni.navigateTo({ url: '/pages/cook/categories' })
}

const stepCount = computed(() => stepLines(stepsText.value).length)
const lackCover = computed(() => !coverFileId.value)
const lackWords = computed(() => !summary.value.trim() && stepCount.value === 0)

async function remove() {
  if (!dishId.value || pending.value)
    return
  const agreed = await ask('删除这道菜', '删掉之后，列表里不会再看到。正在做的那一餐只能先下架。', '删除')
  if (!agreed)
    return
  pending.value = 'delete'
  try {
    await deleteDish(dishId.value)
    uni.navigateBack()
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = ''
  }
}
</script>

<template>
  <paper-page>
    <view class="flex flex-col gap-28rpx">
      <back-bar label="编辑" fallback="/pages/cook/dishes" />
      <ink-load v-if="!booted" label="正在摊开这道菜" />
      <template v-else>
      <input
        v-model="name"
        class="text-64rpx text-#3c2428 font-display"
        :maxlength="20"
        placeholder="写下这道菜"
        placeholder-class="ph"
      >
      <view class="flex items-center justify-between">
        <text class="text-28rpx text-#7a534c font-body">
          分类
        </text>
        <text class="text-28rpx text-#792b3e font-body" @tap="openCategories">
          管理分类
        </text>
      </view>
      <view class="flex flex-wrap gap-16rpx">
        <view
          v-for="category in categories"
          :key="category.categoryId"
          class="border-2rpx rounded-full border-solid px-24rpx py-10rpx"
          :class="categoryId === category.categoryId ? 'border-#792b3e bg-#792b3e' : 'border-#c9a297'"
          @tap="categoryId = category.categoryId"
        >
          <text class="text-28rpx font-body" :class="categoryId === category.categoryId ? 'text-#fff9f4' : 'text-#3c2428'">
            {{ category.name }}
          </text>
        </view>
        <view
          class="border-2rpx rounded-full border-solid px-24rpx py-10rpx"
          :class="categoryId ? 'border-#c9a297' : 'border-#792b3e bg-#792b3e'"
          @tap="categoryId = ''"
        >
          <text class="text-28rpx font-body" :class="categoryId ? 'text-#3c2428' : 'text-#fff9f4'">
            先不归
          </text>
        </view>
      </view>
      <text class="text-28rpx text-#7a534c font-body">
        简介
      </text>
      <textarea
        v-model="summary"
        class="h-120rpx rounded-28rpx bg-#fff9f4 px-24rpx py-20rpx text-32rpx text-#3c2428 font-body"
        :maxlength="80"
        placeholder="蒜香，少盐。"
        placeholder-class="ph"
      />
      <text class="text-28rpx text-#7a534c font-body">
        食材
      </text>
      <textarea
        v-model="ingredients"
        class="h-160rpx rounded-28rpx bg-#fff9f4 px-24rpx py-20rpx text-32rpx text-#3c2428 font-body"
        placeholder="一条一行"
        placeholder-class="ph"
      />
      <view class="flex items-center justify-between">
        <text class="text-28rpx text-#7a534c font-body">
          步骤
        </text>
        <text v-if="!stepsOpen" class="text-28rpx text-#7a534c font-body" @tap="stepsOpen = true">
          展开
        </text>
        <text v-else class="text-28rpx text-#7a534c font-body" @tap="stepsOpen = false">
          收起
        </text>
      </view>
      <text v-if="!stepsOpen" class="text-32rpx text-#3c2428 font-body">
        {{ stepCount }} 步
      </text>
      <textarea
        v-else
        v-model="stepsText"
        class="h-200rpx rounded-28rpx bg-#fff9f4 px-24rpx py-20rpx text-32rpx text-#3c2428 font-body"
        placeholder="一步一行"
        placeholder-class="ph"
      />
      <text v-if="lackWords" class="text-28rpx text-#9c342c font-body">
        简介和步骤至少写一项
      </text>
      <text class="text-28rpx text-#7a534c font-body">
        来源链接
      </text>
      <input
        v-model="sourceUrl"
        class="rounded-28rpx bg-#fff9f4 px-24rpx py-20rpx text-28rpx text-#3c2428 font-body"
        placeholder="https://"
        placeholder-class="ph"
      >
      <text class="text-28rpx text-#7a534c font-body">
        封面
      </text>
      <dish-cover
        v-if="localCover || coverFileId"
        class="h-280rpx w-full rounded-36rpx"
        :src="localCover"
        :file-id="coverFileId"
        :name="name"
      />
      <view v-else class="h-220rpx flex items-center justify-center rounded-36rpx bg-#fff9f4">
        <text class="text-28rpx text-#7a534c font-body">
          上传封面
        </text>
      </view>
      <text v-if="lackCover" class="text-28rpx text-#9c342c font-body">
        还缺封面
      </text>
      <view class="flex gap-16rpx">
        <view class="flex-1 border-2rpx border-#c9a297 rounded-full border-solid py-16rpx text-center" @tap="pickCover('album')">
          <text class="text-28rpx text-#3c2428 font-body">
            从相册选
          </text>
        </view>
        <view class="flex-1 border-2rpx border-#c9a297 rounded-full border-solid py-16rpx text-center" @tap="pickCover('camera')">
          <text class="text-28rpx text-#3c2428 font-body">
            拍一张
          </text>
        </view>
      </view>
      <stamp-button :disabled="pending !== ''" :busy="pending === 'publish'" @tap="publish">
        {{ pending === 'publish' ? '正在上架' : '上架' }}
      </stamp-button>
      <view v-if="dishId && status === 'on'" class="flex items-center justify-center gap-16rpx py-8rpx" @tap="unpublish">
        <ink-spin v-if="pending === 'off'" tone="muted" />
        <text class="text-28rpx text-#7a534c font-body">
          {{ pending === 'off' ? '正在下架' : '下架' }}
        </text>
      </view>
      <view v-if="dishId" class="flex items-center justify-center gap-16rpx py-8rpx" @tap="remove">
        <ink-spin v-if="pending === 'delete'" tone="muted" />
        <text class="text-28rpx text-#9c342c font-body">
          {{ pending === 'delete' ? '正在删除' : '删除' }}
        </text>
      </view>
      </template>
    </view>
  </paper-page>
</template>

<style>
.ph {
  color: #c9a297;
}
</style>
