<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import type { Category } from '@/api/eat'
import type { DishCard } from '@/api/types'
import { listCategories, listDishes } from '@/api/eat'
import { usePaged } from '@/composables/usePaged'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { keepOneLine } from '@/utils/format'
import { showHint } from '@/utils/hint'
import { fillDishes, isSample } from '@/utils/sample-feed'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const ready = ref(false)
const pool = ref<DishCard[]>([])
const categories = ref<Category[]>([])
const keyword = ref('')
keepOneLine(keyword)
const categoryId = ref('')
const pulling = ref(false)
let spin = 0

const viewRows = computed(() => {
  const word = keyword.value.trim()
  let rows = pool.value
  if (categoryId.value)
    rows = rows.filter(dish => dish.categoryId === categoryId.value)
  if (word)
    return rows.filter(dish => dish.name.includes(word))
  return fillDishes(rows, categories.value, categoryId.value, pool.value.map(dish => dish.name))
})
const { shown, total, finished, loading, reset, more } = usePaged(viewRows)
const onShelf = computed(() => shown.value.filter(dish => dish.status === 'on'))
const offShelf = computed(() => shown.value.filter(dish => dish.status === 'off'))
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

watch([keyword, categoryId], () => {
  reset()
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view || id !== spin)
      return
    const [listed, cats] = await Promise.all([
      listDishes(),
      listCategories(),
    ])
    if (id !== spin)
      return
    noteBadges(view.badges)
    pool.value = listed.dishes
    categories.value = cats.categories
    reset()
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

async function onPull() {
  if (pulling.value)
    return
  pulling.value = true
  try {
    await refresh()
  }
  finally {
    pulling.value = false
  }
}

function pickCategory(id: string) {
  categoryId.value = id
}

function createDish() {
  uni.navigateTo({ url: '/pages/cook/dish-edit' })
}

function editDish(dish: DishCard) {
  if (isSample(dish.dishId)) {
    showHint('这是凑出来的示例')
    return
  }
  uni.navigateTo({ url: `/pages/cook/dish-edit?id=${dish.dishId}` })
}

function openCategories() {
  uni.navigateTo({ url: '/pages/cook/categories' })
}

defineExpose({ refresh })
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <view class="shrink-0">
      <screen-head title="菜品" />
    </view>
    <ink-load v-if="!ready" label="正在翻菜" />
    <list-scroll
      v-else
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      @refresh="onPull"
      @more="more"
    >
      <view class="flex flex-col gap-32rpx pt-32rpx">
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
            <view class="relative h-120rpx w-118rpx shrink-0 -mb-8rpx -mr-6rpx">
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
            <view class="relative h-120rpx w-118rpx shrink-0 -mb-8rpx -mr-6rpx">
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
    </list-scroll>
  </view>
</template>
