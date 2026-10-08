<script setup lang="ts">
import type { AccountView, Category } from '@/api/eat'
import type { DishCard } from '@/api/types'
import { listCategories, listDishes } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { primeFileUrls } from '@/utils/files'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const account = ref<AccountView | null>(null)
const ready = ref(false)
const dishes = ref<DishCard[]>([])
const categories = ref<Category[]>([])
const keyword = ref('')
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

onShow(() => {
  void refresh()
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
    account.value = view
    const [listed, cats] = await Promise.all([
      listDishes({
        keyword: keyword.value.trim(),
        categoryId: categoryId.value || undefined,
      }),
      listCategories(),
    ])
    if (id !== spin)
      return
    dishes.value = listed.dishes
    categories.value = cats.categories
    if (!keyword.value.trim() && !categoryId.value)
      knownCount.value = listed.dishes.length
    ready.value = true
    await primeFileUrls(listed.dishes.map(dish => dish.coverFileId))
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
</script>

<template>
  <paper-page dock>
    <ink-load v-if="!ready" label="正在翻菜" />
    <view v-else-if="bareEmpty" class="flex flex-col items-start gap-8rpx pt-36rpx">
      <text class="text-72rpx text-#3c2428 leading-[1.15] font-display">
        还没有菜。
      </text>
      <image class="block w-180rpx" src="/static/underline.png" mode="widthFix" />
      <view class="mt-36rpx w-full flex flex-col items-center">
        <image class="relative z-1 h-248rpx w-264rpx" src="/static/cook-tomato.png" mode="aspectFit" />
        <view class="relative z-0 -mt-100rpx w-456rpx flex items-center justify-center gap-8rpx border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-36rpx pt-128rpx" @tap="createDish">
          <text class="text-44rpx text-#792b3e font-display">
            新增菜品
          </text>
          <text class="text-44rpx text-#792b3e font-body">
            ›
          </text>
        </view>
      </view>
    </view>
    <view v-else class="flex flex-col gap-28rpx">
      <screen-head title="菜品" />
      <view class="flex items-center justify-between" @tap="createDish">
        <text class="text-36rpx text-#3c2428 font-display">
          新增菜品
        </text>
        <text class="text-40rpx text-#792b3e font-body">
          ›
        </text>
      </view>
      <view class="flex items-center gap-16rpx">
        <view class="h-84rpx flex flex-1 items-center rounded-full bg-#fff9f4 px-28rpx">
          <input
            v-model="keyword"
            class="flex-1 text-30rpx text-#3c2428 font-body"
            placeholder="搜菜名"
            placeholder-class="ph"
            confirm-type="search"
          >
        </view>
        <text class="text-28rpx text-#792b3e font-body" @tap="openCategories">
          管理分类
        </text>
      </view>
      <scroll-view scroll-x enhanced class="w-full whitespace-nowrap" :show-scrollbar="false">
        <view class="inline-flex gap-16rpx">
          <view
            class="rounded-full px-24rpx py-10rpx"
            :class="categoryId ? 'bg-#fff9f4' : 'bg-#792b3e'"
            @tap="pickCategory('')"
          >
            <text class="text-28rpx font-body" :class="categoryId ? 'text-#3c2428' : 'text-#fff9f4'">
              全部
            </text>
          </view>
          <view
            v-for="category in categories"
            :key="category.categoryId"
            class="rounded-full px-24rpx py-10rpx"
            :class="categoryId === category.categoryId ? 'bg-#792b3e' : 'bg-#fff9f4'"
            @tap="pickCategory(category.categoryId)"
          >
            <text
              class="text-28rpx font-body"
              :class="categoryId === category.categoryId ? 'text-#fff9f4' : 'text-#3c2428'"
            >
              {{ category.name }}
            </text>
          </view>
        </view>
      </scroll-view>
      <view v-if="onShelf.length" class="flex flex-col gap-20rpx">
        <text class="text-28rpx text-#792b3e font-body">
          已上架
        </text>
        <view v-for="dish in onShelf" :key="dish.dishId" class="flex items-center gap-20rpx" @tap="editDish(dish)">
          <dish-cover class="h-112rpx w-112rpx rounded-36rpx" :file-id="dish.coverFileId" :name="dish.name" />
          <view class="min-w-0 flex flex-1 flex-col gap-4rpx">
            <text class="text-36rpx text-#3c2428 font-display">
              {{ dish.name }}
            </text>
            <text class="text-28rpx text-#7a534c font-body">
              {{ dish.categoryName || '未分类' }}
            </text>
          </view>
          <text class="text-28rpx text-#792b3e font-body">
            已上架
          </text>
        </view>
      </view>
      <view v-if="offShelf.length" class="flex flex-col gap-20rpx">
        <text class="text-28rpx text-#7a534c font-body">
          已下架
        </text>
        <view v-for="dish in offShelf" :key="dish.dishId" class="flex items-center gap-20rpx" @tap="editDish(dish)">
          <dish-cover class="h-112rpx w-112rpx rounded-36rpx" :file-id="dish.coverFileId" :name="dish.name" />
          <view class="min-w-0 flex flex-1 flex-col gap-4rpx">
            <text class="text-36rpx text-#3c2428 font-display">
              {{ dish.name }}
            </text>
            <text class="text-28rpx text-#7a534c font-body">
              {{ dish.categoryName || '未分类' }}
            </text>
          </view>
          <text class="text-28rpx text-#7a534c font-body">
            已下架
          </text>
        </view>
      </view>
      <text v-if="emptyCopy && !onShelf.length && !offShelf.length" class="text-30rpx text-#7a534c leading-[1.5] font-body">
        {{ emptyCopy }}
      </text>
    </view>
    <template #dock>
      <tab-dock role="cooker" current="dishes" :badges="account?.badges || { todo: 0, orders: 0, records: 0 }" />
    </template>
  </paper-page>
</template>

<style>
.ph {
  color: #c9a297;
}
</style>
