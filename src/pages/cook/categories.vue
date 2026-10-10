<script setup lang="ts">
import type { Category } from '@/api/eat'
import { createCategory, deleteCategory, listCategories, listDishes, renameCategory } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
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
const boxKey = ref(0)
const focused = ref(false)
const pending = ref(false)
const ready = ref(false)
let lock = false

interface FieldEvent {
  detail?: { value?: string }
}

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

function remember(event?: FieldEvent) {
  if (typeof event?.detail?.value !== 'string')
    return
  draft.value = event.detail.value.replace(/[\r\n]/g, '')
}

function readName() {
  return draft.value.replace(/[\r\n]/g, '').trim()
}

function onBlur(event: FieldEvent) {
  remember(event)
  focused.value = false
}

function waitName() {
  if (!focused.value)
    return Promise.resolve(readName())
  return new Promise<string>((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout>
    const finish = () => {
      if (settled)
        return
      settled = true
      clearTimeout(timer)
      stop()
      resolve(readName())
    }
    const stop = watch(focused, (value) => {
      if (!value)
        finish()
    })
    timer = setTimeout(finish, 200)
  })
}

async function add(event?: FieldEvent) {
  if (lock)
    return
  lock = true
  remember(event)
  try {
    const name = await waitName()
    pending.value = true
    await createCategory(name)
    draft.value = ''
    boxKey.value += 1
    await refresh()
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = false
    lock = false
  }
}
</script>

<template>
  <paper-page>
    <view class="flex flex-col gap-32rpx">
      <back-bar label="菜品" fallback="/pages/home/index" />
      <ink-load v-if="!ready" label="正在翻分类" />
      <template v-else>
        <view class="flex flex-col items-start">
          <text class="text-72rpx text-#3c2428 leading-[1.2]" :class="faceOf('分类', 'serif')">
            分类
          </text>
          <ink-underline class="mt-8rpx" :width="176" />
          <text v-if="!categories.length" class="mt-28rpx text-32rpx text-#7a534c leading-[1.5]" :class="faceOf('还没有分类', 'sans')">
            还没有分类
          </text>
        </view>
        <view
          v-for="category in categories"
          :key="category.categoryId"
          class="flex items-center justify-between gap-16rpx rounded-36rpx bg-#fff9f4 px-32rpx py-28rpx"
        >
          <text class="min-w-0 flex-1 text-44rpx text-#3c2428" :class="faceOf(category.name, 'serif')">
            {{ category.name }}
          </text>
          <text class="text-28rpx text-#7a534c" :class="faceOf(counts[category.categoryId] ? `${counts[category.categoryId]} 道` : '还没有菜', 'mono')">
            {{ counts[category.categoryId] ? `${counts[category.categoryId]} 道` : '还没有菜' }}
          </text>
          <text class="text-28rpx text-#792b3e" :class="faceOf('改名', 'sans')" @tap="rename(category)">
            改名
          </text>
          <text
            v-if="!counts[category.categoryId]"
            class="text-28rpx text-#9c342c"
            :class="faceOf('删除', 'sans')"
            @tap="remove(category)"
          >
            删除
          </text>
        </view>
        <text class="mt-8rpx text-28rpx text-#792b3e" :class="faceOf('新分类', 'mono')">
          新分类
        </text>
        <view class="flex items-center gap-16rpx">
          <textarea
            :key="boxKey"
            disable-default-padding
            class="h-80rpx flex-1 rounded-full bg-#fff9f4 px-28rpx text-32rpx text-#3c2428 leading-80rpx"
            :class="faceOf('新分类', 'sans')"
            placeholder="1 到 6 个字"
            placeholder-class="ph-sans"
            placeholder-style="font-size: 32rpx; line-height: 80rpx;"
            confirm-type="done"
            :show-confirm-bar="false"
            @input="remember"
            @focus="focused = true"
            @blur="onBlur"
            @confirm="add"
          />
          <view
            class="flex items-center gap-16rpx rounded-full px-28rpx py-16rpx"
            :class="pending ? 'bg-#a24c5c' : 'bg-#792b3e'"
            @tap="add"
          >
            <ink-spin v-if="pending" tone="paper" />
            <text class="text-30rpx text-#fbf3ea" :class="faceOf(pending ? '正在加上' : '加上', 'sans')">
              {{ pending ? '正在加上' : '加上' }}
            </text>
          </view>
        </view>
      </template>
    </view>
  </paper-page>
</template>
