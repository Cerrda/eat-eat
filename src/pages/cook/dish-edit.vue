<script setup lang="ts">
import type { Category, DishDetail } from '@/api/eat'
import { deleteDish, getDish, listCategories, publishDish, unpublishDish } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { chooseImage, ignoredCancel, primeFileUrls, resolveFileUrl, uploadImage } from '@/utils/files'
import { keepOneLine, splitPieces } from '@/utils/format'
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
keepOneLine(name)
const categoryId = ref('')
const ingredients = ref('')
const stepsText = ref('')
const stepsOpen = ref(true)
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
  ingredients.value = dish.ingredients.join('\n')
  stepsText.value = dish.steps.join('\n')
  sourceUrl.value = dish.sourceUrl
  coverFileId.value = dish.coverFileId
}

async function pickCover(source: 'album' | 'camera') {
  try {
    const path = await chooseImage(source)
    localCover.value = path
    const fileId = await uploadImage(path, 'covers')
    coverFileId.value = fileId
    await primeFileUrls([fileId])
    if (await resolveFileUrl(fileId))
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
      ingredients: splitPieces(ingredients.value),
      steps: stepLines(stepsText.value),
      sourceUrl: sourceUrl.value.replace(/[\r\n]/g, '').trim(),
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
        <textarea
          v-model="name"
          auto-height
          disable-default-padding
          class="min-h-74rpx w-full text-64rpx text-#3c2428 leading-74rpx"
          :class="faceOf(name, 'serif')"
          :maxlength="20"
          placeholder="写下这道菜"
          placeholder-class="ph-serif"
          :show-confirm-bar="false"
        />
        <view class="flex flex-col gap-16rpx py-24rpx">
          <view class="flex items-center justify-between">
            <text class="text-28rpx text-#792b3e leading-[1.15]" :class="faceOf('分类', 'mono')">
              分类
            </text>
            <text class="text-28rpx text-#792b3e leading-[1.15]" :class="faceOf('管理分类', 'mono')" @tap="openCategories">
              管理分类
            </text>
          </view>
          <view class="flex flex-wrap gap-16rpx">
            <view
              v-for="category in categories"
              :key="category.categoryId"
              class="box-border border-2rpx rounded-32rpx border-solid px-24rpx py-14rpx"
              :class="categoryId === category.categoryId ? 'border-#792b3e bg-#792b3e' : 'border-#c9a297 bg-#fff9f4'"
              @tap="categoryId = category.categoryId"
            >
              <text class="text-28rpx" :class="[categoryId === category.categoryId ? 'text-#fff9f4' : 'text-#3c2428', faceOf(category.name, 'sans')]">
                {{ category.name }}
              </text>
            </view>
            <view
              class="box-border border-2rpx rounded-32rpx border-solid px-24rpx py-14rpx"
              :class="categoryId ? 'border-#c9a297 bg-#fff9f4' : 'border-#792b3e bg-#792b3e'"
              @tap="categoryId = ''"
            >
              <text class="text-28rpx" :class="[categoryId ? 'text-#3c2428' : 'text-#fff9f4', faceOf('先不归', 'sans')]">
                先不归
              </text>
            </view>
          </view>
        </view>
        <view class="flex flex-col gap-8rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx">
          <text class="text-28rpx text-#792b3e leading-[1.15] tracking-[1.6rpx]" :class="faceOf('食材', 'mono')">
            食材
          </text>
          <textarea
            v-model="ingredients"
            auto-height
            disable-default-padding
            class="min-h-46rpx w-full text-32rpx text-#3c2428 leading-[1.45]"
            :class="faceOf(ingredients, 'sans')"
            placeholder="请输入食材，一个食材一行"
            placeholder-class="ph-sans"
            :show-confirm-bar="false"
          />
        </view>
        <view class="flex flex-col gap-8rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx">
          <view class="flex items-center justify-between">
            <text class="text-28rpx text-#792b3e leading-[1.15] tracking-[1.6rpx]" :class="faceOf('步骤', 'mono')">
              步骤
            </text>
            <text
              class="text-28rpx text-#7a534c"
              :class="faceOf(stepsOpen ? '收起' : '展开', 'sans')"
              @tap="stepsOpen = !stepsOpen"
            >
              {{ stepsOpen ? '收起' : '展开' }}
            </text>
          </view>
          <textarea
            v-if="stepsOpen"
            v-model="stepsText"
            auto-height
            disable-default-padding
            class="min-h-46rpx w-full text-32rpx text-#3c2428 leading-[1.45]"
            :class="faceOf(stepsText, 'sans')"
            placeholder="请输入制作步骤，一步一行"
            placeholder-class="ph-sans"
            :show-confirm-bar="false"
          />
        </view>
        <view class="flex flex-col gap-8rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx">
          <text class="text-28rpx text-#792b3e leading-[1.15]" :class="faceOf('来源链接', 'mono')">
            来源链接
          </text>
          <textarea
            v-model="sourceUrl"
            auto-height
            disable-default-padding
            class="min-h-46rpx w-full text-32rpx text-#3c2428 leading-[1.45]"
            :class="faceOf(sourceUrl, 'sans')"
            placeholder="请输入小红书或抖音链接"
            placeholder-class="ph-sans"
            :show-confirm-bar="false"
          />
        </view>
        <text class="text-28rpx text-#792b3e leading-[1.15] tracking-[2rpx]" :class="faceOf('封面', 'mono')">
          封面
        </text>
        <view class="flex items-center gap-28rpx">
          <view class="relative box-border h-296rpx w-296rpx shrink-0 overflow-hidden border-4rpx border-#c9a297 rounded-36rpx border-solid bg-#fff9f4">
            <dish-cover
              v-if="localCover || coverFileId"
              class="absolute inset-0 h-full w-full"
              :src="localCover"
              :file-id="coverFileId"
              :name="name"
              size="tile"
            />
            <view v-else class="h-full flex flex-col items-center justify-center gap-12rpx">
              <image class="h-56rpx w-56rpx" src="/static/icons/cover-image.png" mode="aspectFit" />
              <text class="text-26rpx text-#7a534c" :class="faceOf('上传封面', 'sans')">
                上传封面
              </text>
            </view>
          </view>
          <view class="min-w-0 flex flex-1 flex-col gap-16rpx">
            <view class="box-border border-4rpx border-#c9a297 rounded-36rpx border-solid bg-#fff9f4 py-24rpx text-center" @tap="pickCover('album')">
              <text class="text-28rpx text-#3c2428" :class="faceOf('从相册选', 'sans')">
                从相册选
              </text>
            </view>
            <view class="box-border border-4rpx border-#c9a297 rounded-36rpx border-solid bg-#fff9f4 py-24rpx text-center" @tap="pickCover('camera')">
              <text class="text-28rpx text-#3c2428" :class="faceOf('拍一张', 'sans')">
                拍一张
              </text>
            </view>
          </view>
        </view>
        <stamp-button :disabled="pending !== ''" :busy="pending === 'publish'" @tap="publish">
          {{ pending === 'publish' ? '正在上架' : '上架' }}
        </stamp-button>
        <view v-if="dishId && status === 'on'" class="flex items-center justify-center gap-16rpx py-8rpx" @tap="unpublish">
          <ink-spin v-if="pending === 'off'" tone="muted" />
          <text class="text-28rpx text-#7a534c" :class="faceOf(pending === 'off' ? '正在下架' : '下架', 'sans')">
            {{ pending === 'off' ? '正在下架' : '下架' }}
          </text>
        </view>
        <view v-if="dishId" class="flex items-center justify-center gap-16rpx py-8rpx" @tap="remove">
          <ink-spin v-if="pending === 'delete'" tone="muted" />
          <text class="text-28rpx text-#9c342c" :class="faceOf(pending === 'delete' ? '正在删除' : '删除', 'sans')">
            {{ pending === 'delete' ? '正在删除' : '删除' }}
          </text>
        </view>
      </template>
    </view>
  </paper-page>
</template>
