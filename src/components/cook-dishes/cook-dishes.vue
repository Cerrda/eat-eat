<script setup lang="ts">
import type { Category } from '@/api/eat'
import type { DishCard } from '@/api/types'
import { listCategories, listDishes } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { keepOneLine } from '@/utils/format'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const ready = ref(false)
const dishes = ref<DishCard[]>([])
const categories = ref<Category[]>([])
const keyword = ref('')
keepOneLine(keyword)
const categoryId = ref('')
const knownCount = ref(-1)
let timer = 0
let spin = 0

const onShelf = computed(() => dishes.value.filter(dish => dish.status === 'on'))
const offShelf = computed(() => dishes.value.filter(dish => dish.status === 'off'))
const bareEmpty = computed(() => knownCount.value === 0 && !keyword.value.trim() && !categoryId.value)
const emptyCopy = computed(() => {
  if (keyword.value.trim())
    return '没有找到这道菜。'
  if (categoryId.value)
    return '这个分类里还没有菜。'
  return ''
})

onMounted(() => {
  void refresh()
})

onUnmounted(() => {
  clearTimeout(timer)
})

watch(keyword, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    void refresh()
  }, 250) as unknown as number
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view || id !== spin)
      return
    const [listed, cats] = await Promise.all([
      listDishes({
        keyword: keyword.value.trim(),
        categoryId: categoryId.value || undefined,
      }),
      listCategories(),
    ])
    if (id !== spin)
      return
    noteBadges(view.badges)
    dishes.value = listed.dishes
    categories.value = cats.categories
    if (!keyword.value.trim() && !categoryId.value)
      knownCount.value = listed.dishes.length
    ready.value = true
    await primeFileUrls(listed.dishes.map(dish => dish.coverFileId))
    if (id !== spin)
      return
    markTabFresh('dishes')
  }
  catch (err) {
    if (id === spin)
      showError(err)
  }
}

function pickCategory(id: string) {
  categoryId.value = id
  void refresh()
}

function createDish() {
  uni.navigateTo({ url: '/pages/cook/dish-edit' })
}

function editDish(dish: DishCard) {
  uni.navigateTo({ url: `/pages/cook/dish-edit?id=${dish.dishId}` })
}

function openCategories() {
  uni.navigateTo({ url: '/pages/cook/categories' })
}

defineExpose({ refresh })
</script>

<template>
  <view>
    <ink-load v-if="!ready" label="正在翻菜" />
    <view v-else-if="bareEmpty" class="flex flex-col gap-28rpx">
      <screen-head title="菜品" note="还没有菜" />
      <view class="w-full flex flex-col items-center pb-16rpx pt-32rpx">
        <image class="relative z-1 h-248rpx w-264rpx" src="/static/cook-tomato.png" mode="aspectFit" />
        <view class="relative z-0 w-456rpx flex items-center justify-center gap-12rpx border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-48rpx pt-164rpx -mt-148rpx" @tap="createDish">
          <text class="text-44rpx text-#792b3e leading-[1.15]" :class="faceOf('新增菜品', 'serif')">
            新增菜品
          </text>
          <text class="text-44rpx text-#792b3e leading-none" :class="faceOf('›', 'sans')">
            ›
          </text>
        </view>
      </view>
    </view>
    <view v-else class="flex flex-col gap-32rpx">
      <screen-head title="菜品" />
      <view class="border-0 border-y-4rpx border-#c9a297 border-solid py-32rpx" @tap="createDish">
        <text class="text-36rpx text-#3c2428 leading-[1.15]" :class="faceOf('新增菜品', 'serif')">
          新增菜品
        </text>
      </view>
      <view class="flex flex-col gap-20rpx">
        <view class="box-border h-84rpx flex items-center gap-16rpx border-2rpx border-#c9a297 rounded-full border-solid bg-#fff9f4 px-28rpx">
          <view class="relative h-32rpx w-32rpx shrink-0">
            <view class="absolute left-2rpx top-2rpx box-border h-20rpx w-20rpx border-3rpx border-#7a534c rounded-full border-solid" />
            <view
              class="absolute left-16rpx top-16rpx h-3rpx w-12rpx rounded-full bg-#7a534c"
              style="transform: rotate(45deg); transform-origin: left center"
            />
          </view>
          <textarea
            v-model="keyword"
            disable-default-padding
            class="h-40rpx min-w-0 flex-1 text-30rpx text-#3c2428 leading-40rpx"
            :class="faceOf(keyword, 'sans')"
            placeholder="搜菜名"
            placeholder-class="ph-sans"
            confirm-type="search"
            :show-confirm-bar="false"
          />
          <text class="shrink-0 text-28rpx text-#792b3e" :class="faceOf('管理分类', 'mono')" @tap="openCategories">
            管理分类
          </text>
        </view>
        <scroll-view scroll-x enhanced class="w-full whitespace-nowrap" :show-scrollbar="false">
          <view class="inline-flex gap-16rpx">
            <view
              class="box-border border-2rpx rounded-full border-solid px-24rpx py-14rpx"
              :class="categoryId ? 'border-#c9a297 bg-#fff9f4' : 'border-#792b3e bg-#792b3e'"
              @tap="pickCategory('')"
            >
              <text class="text-28rpx" :class="[categoryId ? 'text-#3c2428' : 'text-#fff9f4', faceOf('全部', 'sans')]">
                全部
              </text>
            </view>
            <view
              v-for="category in categories"
              :key="category.categoryId"
              class="box-border border-2rpx rounded-full border-solid px-24rpx py-14rpx"
              :class="categoryId === category.categoryId ? 'border-#792b3e bg-#792b3e' : 'border-#c9a297 bg-#fff9f4'"
              @tap="pickCategory(category.categoryId)"
            >
              <text
                class="text-28rpx"
                :class="[categoryId === category.categoryId ? 'text-#fff9f4' : 'text-#3c2428', faceOf(category.name, 'sans')]"
              >
                {{ category.name }}
              </text>
            </view>
          </view>
        </scroll-view>
      </view>
      <template v-if="onShelf.length">
        <text class="text-30rpx text-#792b3e" :class="faceOf('已上架', 'mono')">
          已上架
        </text>
        <view v-for="dish in onShelf" :key="dish.dishId" class="flex items-center gap-24rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx" @tap="editDish(dish)">
          <view class="relative -mb-8rpx -mr-6rpx h-120rpx w-118rpx shrink-0">
            <view class="absolute left-6rpx top-8rpx h-112rpx w-112rpx rounded-36rpx bg-#4e222d/28" />
            <view class="absolute left-0 top-0 h-112rpx w-112rpx overflow-hidden rounded-36rpx">
              <dish-cover class="h-full w-full" :file-id="dish.coverFileId" :name="dish.name" />
            </view>
            <view class="pointer-events-none absolute left-0 top-0 z-1 box-border h-112rpx w-112rpx border-6rpx border-#fff9f4 rounded-36rpx border-solid" />
          </view>
          <view class="min-w-0 flex flex-1 flex-col gap-4rpx">
            <text class="text-36rpx text-#3c2428 leading-[1.15]" :class="faceOf(dish.name, 'serif')">
              {{ dish.name }}
            </text>
            <text class="text-28rpx text-#7a534c" :class="faceOf(dish.categoryName || '未分类', 'sans')">
              {{ dish.categoryName || '未分类' }}
            </text>
          </view>
          <text class="shrink-0 text-28rpx text-#792b3e" :class="faceOf('已上架', 'mono')">
            已上架
          </text>
        </view>
      </template>
      <template v-if="offShelf.length">
        <text class="text-30rpx text-#792b3e" :class="faceOf('已下架', 'mono')">
          已下架
        </text>
        <view v-for="dish in offShelf" :key="dish.dishId" class="flex items-center gap-24rpx border-0 border-t-4rpx border-#c9a297 border-solid py-24rpx" @tap="editDish(dish)">
          <view class="relative -mb-8rpx -mr-6rpx h-120rpx w-118rpx shrink-0">
            <view class="absolute left-6rpx top-8rpx h-112rpx w-112rpx rounded-36rpx bg-#4e222d/28" />
            <view class="absolute left-0 top-0 h-112rpx w-112rpx overflow-hidden rounded-36rpx">
              <dish-cover class="h-full w-full" :file-id="dish.coverFileId" :name="dish.name" />
            </view>
            <view class="pointer-events-none absolute left-0 top-0 z-1 box-border h-112rpx w-112rpx border-6rpx border-#fff9f4 rounded-36rpx border-solid" />
          </view>
          <view class="min-w-0 flex flex-1 flex-col gap-4rpx">
            <text class="text-36rpx text-#3c2428 leading-[1.15]" :class="faceOf(dish.name, 'serif')">
              {{ dish.name }}
            </text>
            <text class="text-28rpx text-#7a534c" :class="faceOf(dish.categoryName || '未分类', 'sans')">
              {{ dish.categoryName || '未分类' }}
            </text>
          </view>
          <text class="shrink-0 text-28rpx text-#7a534c" :class="faceOf('已下架', 'mono')">
            已下架
          </text>
        </view>
      </template>
      <text v-if="emptyCopy && !onShelf.length && !offShelf.length" class="text-30rpx text-#7a534c leading-[1.5]" :class="faceOf(emptyCopy, 'sans')">
        {{ emptyCopy }}
      </text>
    </view>
  </view>
</template>
