<script setup lang="ts">
import type { Category } from '@/api/eat'
import type { DishCard } from '@/api/types'
import { listCategories, listDishes } from '@/api/eat'
import { usePaged } from '@/composables/usePaged'
import { ensureAccount } from '@/utils/account'
import { art } from '@/utils/theme'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { keepOneLine } from '@/utils/format'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const ready = ref(false)
const categories = ref<Category[]>([])
const keyword = ref('')
keepOneLine(keyword)
const categoryId = ref('')
const pulling = ref(false)
let spin = 0

const { shown, total, finished, loading, reset, more } = usePaged(async (page) => {
  const listed = await listDishes({
    page,
    keyword: keyword.value.trim(),
    categoryId: categoryId.value,
  })
  await primeFileUrls(listed.dishes.map(dish => dish.coverFileId))
  return { rows: listed.dishes, total: listed.total }
})
const bareEmpty = computed(() => ready.value && total.value === 0 && !keyword.value.trim() && !categoryId.value)
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

let filterTimer: ReturnType<typeof setTimeout> | undefined

function reloadList(wait = 0) {
  if (filterTimer)
    clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    filterTimer = undefined
    void reset().catch(err => showError(err))
  }, wait)
}

watch(keyword, () => {
  reloadList(280)
})

watch(categoryId, () => {
  reloadList(0)
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view || id !== spin)
      return
    if (filterTimer) {
      clearTimeout(filterTimer)
      filterTimer = undefined
    }
    const [cats] = await Promise.all([
      listCategories(),
      reset(),
    ])
    if (id !== spin)
      return
    noteBadges(view.badges)
    categories.value = cats.categories
    ready.value = true
    markTabFresh('dishes')
  }
  catch (err) {
    if (id === spin)
      showError(err)
  }
}

async function onMore() {
  try {
    await more()
  }
  catch (err) {
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
  uni.navigateTo({ url: `/pages/cook/dish-edit?id=${dish.dishId}` })
}

function openCategories() {
  uni.navigateTo({ url: '/pages/cook/categories' })
}

defineExpose({ refresh })
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <list-scroll
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      @refresh="onPull"
      @more="onMore"
    >
      <screen-head title="菜品" :note="bareEmpty ? '还没有菜' : ''" />
      <template v-if="ready">
        <view v-if="bareEmpty" class="w-full flex flex-col items-center pb-16rpx pt-32rpx">
          <image class="relative z-1 h-248rpx w-264rpx" :src="art('cook-tomato')" mode="aspectFit" />
          <view class="relative z-0 w-456rpx flex items-center justify-center gap-12rpx border-2rpx border-line rounded-40rpx border-solid bg-cream px-32rpx pb-48rpx pt-164rpx -mt-148rpx" @tap="createDish">
            <text class="text-44rpx text-accent leading-[1.15]" :class="faceOf('新增菜品', 'serif')">
              新增菜品
            </text>
            <text class="text-44rpx text-accent leading-none" :class="faceOf('›', 'sans')">
              ›
            </text>
          </view>
        </view>
        <view v-else class="flex flex-col gap-32rpx pt-32rpx">
          <view class="border-0 border-y-4rpx border-line border-solid py-32rpx" @tap="createDish">
            <text class="text-36rpx text-ink leading-[1.15]" :class="faceOf('新增菜品', 'serif')">
              新增菜品
            </text>
          </view>
          <view class="flex flex-col gap-20rpx">
            <view class="box-border h-84rpx flex items-center gap-16rpx border-2rpx border-line rounded-full border-solid bg-cream px-28rpx">
              <view class="i-mingcute-search-line shrink-0 text-32rpx text-muted" />
              <!-- iOS 原生 textarea 从行盒顶部排字，行高拉满搜索条时文字会偏上 -->
              <textarea
                v-model="keyword"
                disable-default-padding
                class="h-40rpx min-h-40rpx min-w-0 flex-1 self-center p-0 text-30rpx text-ink leading-40rpx"
                :class="faceOf(keyword, 'sans')"
                placeholder="搜菜名"
                placeholder-class="ph-sans"
                placeholder-style="font-size: 30rpx; line-height: 40rpx;"
                confirm-type="search"
                :show-confirm-bar="false"
              />
              <text class="shrink-0 text-28rpx text-accent" :class="faceOf('管理分类', 'mono')" @tap="openCategories">
                管理分类
              </text>
            </view>
            <scroll-view scroll-x enhanced class="w-full whitespace-nowrap" :show-scrollbar="false">
              <view class="inline-flex gap-16rpx">
                <view
                  class="box-border border-2rpx rounded-full border-solid px-24rpx py-14rpx"
                  :class="categoryId ? 'border-line bg-cream' : 'border-accent bg-accent'"
                  @tap="pickCategory('')"
                >
                  <text class="text-28rpx" :class="[categoryId ? 'text-ink' : 'text-on-accent', faceOf('全部', 'sans')]">
                    全部
                  </text>
                </view>
                <view
                  v-for="category in categories"
                  :key="category.categoryId"
                  class="box-border border-2rpx rounded-full border-solid px-24rpx py-14rpx"
                  :class="categoryId === category.categoryId ? 'border-accent bg-accent' : 'border-line bg-cream'"
                  @tap="pickCategory(category.categoryId)"
                >
                  <text
                    class="text-28rpx"
                    :class="[categoryId === category.categoryId ? 'text-on-accent' : 'text-ink', faceOf(category.name, 'sans')]"
                  >
                    {{ category.name }}
                  </text>
                </view>
              </view>
            </scroll-view>
          </view>
          <view v-if="shown.length" class="flex flex-col">
            <view v-for="dish in shown" :key="dish.dishId" class="flex items-center gap-24rpx border-0 border-t-4rpx border-line border-solid py-24rpx" @tap="editDish(dish)">
              <view class="relative h-120rpx w-118rpx shrink-0 -mb-8rpx -mr-6rpx">
                <view class="absolute left-6rpx top-8rpx h-112rpx w-112rpx rounded-36rpx bg-shade-28" />
                <view class="absolute left-0 top-0 h-112rpx w-112rpx overflow-hidden rounded-36rpx">
                  <dish-cover class="h-full w-full" :file-id="dish.coverFileId" :name="dish.name" />
                </view>
                <view class="pointer-events-none absolute left-0 top-0 z-1 box-border h-112rpx w-112rpx border-6rpx border-photo rounded-36rpx border-solid" />
              </view>
              <view class="min-w-0 flex flex-1 flex-col gap-4rpx">
                <text class="text-36rpx text-ink leading-[1.15]" :class="faceOf(dish.name, 'serif')">
                  {{ dish.name }}
                </text>
                <text class="text-28rpx text-muted" :class="faceOf(dish.categoryName || '未分类', 'sans')">
                  {{ dish.categoryName || '未分类' }}
                </text>
              </view>
            </view>
          </view>
          <text v-if="emptyCopy && !shown.length" class="text-30rpx text-muted leading-[1.5]" :class="faceOf(emptyCopy, 'sans')">
            {{ emptyCopy }}
          </text>
        </view>
      </template>
    </list-scroll>
  </view>
</template>

<style>
@import "../../styles/scrollbar.css";
</style>
