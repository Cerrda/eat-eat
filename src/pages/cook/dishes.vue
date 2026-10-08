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
let timer = 0
let spin = 0

const onShelf = computed(() => dishes.value.filter(dish => dish.status === 'on'))
const offShelf = computed(() => dishes.value.filter(dish => dish.status === 'off'))

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
    <view class="flex flex-col gap-28rpx">
      <screen-head title="菜品" />
      <view class="flex items-center justify-between" @tap="createDish">
        <text class="text-40rpx text-#3c2428 font-display">
          新增菜品
        </text>
        <text class="text-40rpx text-#792b3e font-body">
          ›
        </text>
      </view>
      <view class="flex items-center gap-16rpx">
        <view class="flex flex-1 items-center rounded-full bg-#fff9f4 px-28rpx py-16rpx">
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
      <ink-load v-show="!ready" label="正在翻菜" />
      <view v-show="ready" class="flex flex-col gap-28rpx">
        <scroll-view scroll-x enhanced class="w-full whitespace-nowrap" :show-scrollbar="false">
          <view class="inline-flex gap-20rpx">
            <view
              class="rounded-full px-24rpx py-10rpx"
              :class="categoryId ? '' : 'bg-#792b3e'"
              @tap="pickCategory('')"
            >
              <text class="text-28rpx font-body" :class="categoryId ? 'text-#7a534c' : 'text-#fff9f4'">
                全部
              </text>
            </view>
            <view
              v-for="category in categories"
              :key="category.categoryId"
              class="rounded-full px-24rpx py-10rpx"
              :class="categoryId === category.categoryId ? 'bg-#792b3e' : ''"
              @tap="pickCategory(category.categoryId)"
            >
              <text
                class="text-28rpx font-body"
                :class="categoryId === category.categoryId ? 'text-#fff9f4' : 'text-#7a534c'"
              >
                {{ category.name }}
              </text>
            </view>
          </view>
        </scroll-view>
        <view v-if="onShelf.length" class="flex flex-col gap-20rpx">
          <text class="text-28rpx text-#7a534c font-body">
            已上架
          </text>
          <view v-for="dish in onShelf" :key="dish.dishId" class="flex items-center gap-20rpx" @tap="editDish(dish)">
            <dish-cover class="h-112rpx w-112rpx rounded-24rpx" :file-id="dish.coverFileId" :name="dish.name" />
            <view class="min-w-0 flex flex-1 flex-col gap-4rpx">
              <text class="text-36rpx text-#3c2428 font-display">
                {{ dish.name }}
              </text>
              <text class="text-26rpx text-#7a534c font-body">
                {{ dish.categoryName || '未分类' }}
              </text>
            </view>
            <text class="text-26rpx text-#792b3e font-body">
              已上架
            </text>
          </view>
        </view>
        <view v-if="offShelf.length" class="flex flex-col gap-20rpx">
          <text class="text-28rpx text-#7a534c font-body">
            已下架
          </text>
          <view v-for="dish in offShelf" :key="dish.dishId" class="flex items-center gap-20rpx" @tap="editDish(dish)">
            <dish-cover class="h-112rpx w-112rpx rounded-24rpx" :file-id="dish.coverFileId" :name="dish.name" />
            <view class="min-w-0 flex flex-1 flex-col gap-4rpx">
              <text class="text-36rpx text-#3c2428 font-display">
                {{ dish.name }}
              </text>
              <text class="text-26rpx text-#7a534c font-body">
                {{ dish.categoryName || '未分类' }}
              </text>
            </view>
            <text class="text-26rpx text-#7a534c font-body">
              已下架
            </text>
          </view>
        </view>
        <text v-if="!onShelf.length && !offShelf.length" class="text-30rpx text-#7a534c leading-[1.5] font-body">
          {{ keyword || categoryId ? '没有这道菜。' : '还没有菜。' }}
        </text>
      </view>
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
