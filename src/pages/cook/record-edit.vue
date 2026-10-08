<script setup lang="ts">
import type { OrderDetail, RecordCard, Slot } from '@/api/eat'
import type { DishCard } from '@/api/types'
import { createRecord, dateLabel, getOrder, listDishes, listRecords, SLOT_LABEL, updateRecord } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { chooseImage, ignoredCancel, primeFileUrls, uploadImage } from '@/utils/files'
import { showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const orderId = ref('')
const recordId = ref('')
const today = ref('')
const date = ref('')
const slot = ref<Slot>('noon')
const text = ref('')
const photos = ref<string[]>([])
const dishIds = ref<string[]>([])
const dishNames = ref<string[]>([])
const menu = ref<DishCard[]>([])
const locked = ref(false)
const pending = ref(false)
const ready = ref(false)
const hydrated = ref(false)
const slotLabels = ['早上', '中午', '晚上']

const backLabel = computed(() => {
  if (!date.value)
    return '记下这餐'
  const day = dateLabel(date.value, today.value)
  return `${day === date.value ? date.value : day}${SLOT_LABEL[slot.value]}`
})

onLoad((query) => {
  orderId.value = String(query?.orderId || '')
  recordId.value = String(query?.recordId || '')
})

onShow(() => {
  void load()
})

async function load() {
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view)
      return
    today.value = view.today
    if (hydrated.value) {
      ready.value = true
      return
    }
    if (!date.value)
      date.value = view.today
    if (orderId.value) {
      const order = await getOrder(orderId.value)
      applyOrder(order)
      locked.value = true
    }
    else if (recordId.value) {
      const listed = await listRecords()
      const found = listed.records.find(item => item.recordId === recordId.value)
      if (!found) {
        uni.showToast({ title: '没有这一餐的记录', icon: 'none' })
        return
      }
      applyRecord(found)
      locked.value = true
      await primeFileUrls(found.photoFileIds)
    }
    else {
      const listed = await listDishes({ status: 'on' })
      menu.value = listed.dishes
    }
    hydrated.value = true
    ready.value = true
  }
  catch (err) {
    showError(err)
  }
}

function applyOrder(order: OrderDetail) {
  date.value = order.date
  slot.value = order.slot
  dishIds.value = order.items.map(item => item.dishId)
  dishNames.value = order.items.map(item => item.name)
}

function applyRecord(record: RecordCard) {
  date.value = record.date
  slot.value = record.slot
  text.value = record.text
  photos.value = [...record.photoFileIds]
  dishIds.value = record.dishes.map(dish => dish.dishId)
  dishNames.value = record.dishes.map(dish => dish.name)
}

function onDate(event: { detail: { value: string } }) {
  date.value = event.detail.value
}

function onSlot(event: { detail: { value: string } }) {
  const index = Number(event.detail.value)
  slot.value = (['morning', 'noon', 'evening'] as Slot[])[index] || 'morning'
}

function toggleDish(dish: DishCard) {
  const index = dishIds.value.indexOf(dish.dishId)
  if (index >= 0) {
    dishIds.value.splice(index, 1)
    dishNames.value.splice(index, 1)
    return
  }
  dishIds.value.push(dish.dishId)
  dishNames.value.push(dish.name)
}

function addPhoto() {
  if (photos.value.length >= 9) {
    uni.showToast({ title: '照片最多 9 张', icon: 'none' })
    return
  }
  uni.showActionSheet({
    itemList: ['从相册选', '拍一张'],
    success(result) {
      void storePhoto(result.tapIndex === 0 ? 'album' : 'camera')
    },
  })
}

async function storePhoto(source: 'album' | 'camera') {
  try {
    const path = await chooseImage(source)
    const fileId = await uploadImage(path, 'records')
    photos.value.push(fileId)
    await primeFileUrls([fileId])
  }
  catch (err) {
    if (!ignoredCancel(err))
      showError(err)
  }
}

function removePhoto(fileId: string) {
  photos.value = photos.value.filter(item => item !== fileId)
}

async function submit() {
  if (pending.value)
    return
  if (!text.value.trim() && !photos.value.length) {
    uni.showToast({ title: '照片和文字至少留一样', icon: 'none' })
    return
  }
  pending.value = true
  try {
    if (recordId.value) {
      await updateRecord({
        recordId: recordId.value,
        text: text.value.trim(),
        photoFileIds: photos.value,
      })
    }
    else {
      await createRecord({
        orderId: orderId.value || undefined,
        date: orderId.value ? undefined : date.value,
        slot: orderId.value ? undefined : slot.value,
        text: text.value.trim(),
        photoFileIds: photos.value,
        dishIds: dishIds.value,
      })
    }
    uni.navigateBack()
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
      <back-bar :label="backLabel" fallback="/pages/cook/records" />
      <template v-if="ready">
      <view class="flex flex-col items-start">
        <text class="text-72rpx text-#3c2428 leading-[1.15] font-display">
          记下这餐
        </text>
        <image class="mt-8rpx block w-140rpx" src="/static/underline.png" mode="widthFix" />
      </view>
      <view class="flex gap-24rpx">
        <view class="flex flex-1 flex-col gap-8rpx">
          <text class="text-26rpx text-#7a534c font-body">
            日期
          </text>
          <picker v-if="!locked" mode="date" :value="date" @change="onDate">
            <text class="text-44rpx text-#3c2428 font-display">
              {{ dateLabel(date, today) }}
            </text>
          </picker>
          <text v-else class="text-44rpx text-#3c2428 font-display">
            {{ dateLabel(date, today) }}
          </text>
        </view>
        <view class="flex flex-1 flex-col gap-8rpx">
          <text class="text-26rpx text-#7a534c font-body">
            餐次
          </text>
          <picker v-if="!locked" :range="slotLabels" @change="onSlot">
            <text class="text-44rpx text-#3c2428 font-display">
              {{ SLOT_LABEL[slot] }}
            </text>
          </picker>
          <text v-else class="text-44rpx text-#3c2428 font-display">
            {{ SLOT_LABEL[slot] }}
          </text>
        </view>
      </view>
      <text v-if="dishNames.length" class="text-28rpx text-#7a534c font-body">
        这一餐  ·  {{ dishNames.join('、') }}
      </text>
      <view v-if="!locked && menu.length" class="flex flex-wrap gap-12rpx">
        <view
          v-for="dish in menu"
          :key="dish.dishId"
          class="rounded-full px-20rpx py-8rpx"
          :class="dishIds.includes(dish.dishId) ? 'bg-#792b3e' : 'bg-#fff9f4'"
          @tap="toggleDish(dish)"
        >
          <text class="text-26rpx font-body" :class="dishIds.includes(dish.dishId) ? 'text-#fff9f4' : 'text-#7a534c'">
            {{ dish.name }}
          </text>
        </view>
      </view>
      <view class="flex flex-wrap gap-12rpx">
        <view v-for="photo in photos" :key="photo" class="relative">
          <dish-cover class="h-180rpx w-180rpx rounded-24rpx" :file-id="photo" name="照" />
          <text class="absolute right-8rpx top-8rpx text-24rpx text-#fff9f4 font-body" @tap="removePhoto(photo)">
            拿掉
          </text>
        </view>
        <view
          v-if="photos.length < 9"
          class="h-180rpx w-180rpx flex items-center justify-center rounded-24rpx bg-#fff9f4"
          @tap="addPhoto"
        >
          <text class="text-28rpx text-#792b3e font-body">
            再加
          </text>
        </view>
      </view>
      <text class="text-26rpx text-#7a534c font-body">
        {{ photos.length }} / 9 张
      </text>
      <view class="rounded-28rpx bg-#fff9f4 px-28rpx py-24rpx">
        <textarea
          v-model="text"
          class="h-180rpx w-full text-36rpx text-#3c2428 font-body"
          :maxlength="300"
          placeholder="收汁收得久了一点，骨头很软。"
          placeholder-class="ph"
        />
        <text class="block text-right text-26rpx text-#7a534c font-body">
          {{ text.length }} / 300
        </text>
      </view>
      <stamp-button :disabled="pending" :busy="pending" @tap="submit">
        {{ pending ? '正在记下' : '记下' }}
      </stamp-button>
      </template>
      <ink-load v-else label="正在摊开记录" />
    </view>
  </paper-page>
</template>

<style>
.ph {
  color: #c9a297;
}
</style>
