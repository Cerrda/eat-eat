<script setup lang="ts">
import type { Category } from '@/api/eat'
import { createCategory, deleteCategory, listCategories, listDishes, renameCategory } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { ask, askText, showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const categories = ref<Category[]>([])
const counts = ref<Record<string, number>>({})
const draft = ref('')
const pending = ref(false)
const ready = ref(false)

onShow(() => {
  void refresh()
})

async function refresh() {
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view)
      return
    const [listed, dishes] = await Promise.all([listCategories(), listDishes()])
    categories.value = listed.categories
    const next: Record<string, number> = {}
    for (const dish of dishes.dishes) {
      if (!dish.categoryId)
        continue
      next[dish.categoryId] = (next[dish.categoryId] || 0) + 1
    }
    counts.value = next
    ready.value = true
  }
  catch (err) {
    ready.value = true
    showError(err)
  }
}

async function rename(category: Category) {
  const name = await askText('改名', '1 到 6 个字', category.name)
  if (name == null)
    return
  try {
    await renameCategory(category.categoryId, name.trim())
    await refresh()
  }
  catch (err) {
    showError(err)
  }
}

async function remove(category: Category) {
  const agreed = await ask('删除分类', `删掉「${category.name}」？没有菜挂着才能删。`, '删除')
  if (!agreed)
    return
  try {
    await deleteCategory(category.categoryId)
    await refresh()
  }
  catch (err) {
    showError(err)
  }
}

async function add() {
  if (pending.value)
    return
  pending.value = true
  try {
    await createCategory(draft.value.trim())
    draft.value = ''
    await refresh()
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <paper-page>
    <view class="flex flex-col gap-28rpx">
      <back-bar label="菜品" fallback="/pages/cook/dishes" />
      <ink-load v-if="!ready" label="正在翻分类" />
      <template v-else>
        <view class="flex flex-col items-start">
          <text class="text-72rpx text-#3c2428 leading-[1.15] font-display">
            {{ categories.length ? '分类' : '还没有分类。' }}
          </text>
          <image class="mt-8rpx block w-180rpx" src="/static/underline.png" mode="widthFix" />
        </view>
        <view
          v-for="category in categories"
          :key="category.categoryId"
          class="flex items-center justify-between gap-16rpx rounded-36rpx bg-#fff9f4 px-28rpx py-24rpx"
        >
          <text class="min-w-0 flex-1 text-44rpx text-#3c2428 font-display">
            {{ category.name }}
          </text>
          <text class="text-26rpx text-#7a534c font-body">
            {{ counts[category.categoryId] ? `${counts[category.categoryId]} 道` : '还没有菜' }}
          </text>
          <text class="text-28rpx text-#792b3e font-body" @tap="rename(category)">
            改名
          </text>
          <text
            v-if="!counts[category.categoryId]"
            class="text-28rpx text-#9c342c font-body"
            @tap="remove(category)"
          >
            删除
          </text>
        </view>
      <text class="mt-8rpx text-28rpx text-#792b3e font-body">
        新分类
      </text>
      <view class="flex items-center gap-16rpx">
        <input
          v-model="draft"
          class="flex-1 rounded-full bg-#fff9f4 px-28rpx py-18rpx text-30rpx text-#3c2428 font-body"
          :maxlength="6"
          placeholder="1 到 6 个字"
          placeholder-class="ph"
          confirm-type="done"
          @confirm="add"
        >
        <view
          class="flex items-center gap-16rpx rounded-full px-28rpx py-16rpx"
          :class="pending ? 'bg-#a24c5c' : 'bg-#792b3e'"
          @tap="add"
        >
          <ink-spin v-if="pending" tone="paper" />
          <text class="text-28rpx text-#fbf3ea font-body">
            {{ pending ? '正在加上' : '加上' }}
          </text>
        </view>
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
