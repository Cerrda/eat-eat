<script setup lang="ts">
import type { OrderDetail, RecordCard, RecordDish, Slot } from '@/api/eat'
import { createRecord, dateLabel, deleteRecord, getOrder, getRecord, matchMeal, SLOT_LABEL, updateRecord } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { chooseImages, ignoredCancel, primeFileUrls, uploadImage } from '@/utils/files'
import { showHint } from '@/utils/hint'
import { pageStyle } from '@/utils/theme'
import { ask, showError } from '@/utils/ui'

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
const photoLimit = 9
const photos = ref<string[]>([])
const uploading = ref(false)
const dishIds = ref<string[]>([])
const mealDishes = ref<RecordDish[]>([])
const locked = ref(false)
const pending = ref(false)
const ready = ref(false)
const hydrated = ref(false)
const slotLabels = ['早上', '中午', '晚上']

const mealLabel = computed(() => {
  if (!date.value)
    return ''
  return `${dateLabel(date.value, today.value)}${SLOT_LABEL[slot.value]}点的`
})

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
    const view = await ensureAccount({ next: 'home' })
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
      const found = await getRecord(recordId.value)
      applyRecord(found)
      locked.value = true
      await primeFileUrls(found.photoFileIds)
    }
    hydrated.value = true
    ready.value = true
    await loadMeal()
  }
  catch (err) {
    showError(err)
  }
}

let mealSpin = 0

async function loadMeal() {
  const id = ++mealSpin
  if (!date.value) {
    mealDishes.value = []
    return
  }
  try {
    const matched = await matchMeal(date.value, slot.value)
    if (id !== mealSpin)
      return
    mealDishes.value = matched.dishes
    await primeFileUrls(matched.dishes.map(dish => dish.coverFileId))
  }
  catch (err) {
    if (id === mealSpin)
      showError(err)
  }
}

function applyOrder(order: OrderDetail) {
  date.value = order.date
  slot.value = order.slot
  dishIds.value = order.items.map(item => item.dishId)
}

function applyRecord(record: RecordCard) {
  date.value = record.date
  slot.value = record.slot
  text.value = record.text
  photos.value = [...record.photoFileIds]
}

function onDate(event: { detail: { value: string } }) {
  date.value = event.detail.value
  void loadMeal()
}

function onSlot(event: { detail: { value: string } }) {
  const index = Number(event.detail.value)
  slot.value = (['morning', 'noon', 'evening'] as Slot[])[index] || 'morning'
  void loadMeal()
}

function addPhoto() {
  if (uploading.value)
    return
  if (photos.value.length >= photoLimit) {
    showHint('照片最多 9 张')
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
  const room = photoLimit - photos.value.length
  if (room <= 0 || uploading.value) {
    if (room <= 0)
      showHint('照片最多 9 张')
    return
  }
  uploading.value = true
  try {
    const picked = await chooseImages(source, source === 'camera' ? 1 : room)
    const batch = picked.slice(0, room)
    const settled = await Promise.allSettled(batch.map(path => uploadImage(path, 'records')))
    const fileIds = settled.flatMap(item => item.status === 'fulfilled' ? [item.value] : [])
    if (fileIds.length) {
      photos.value = [...photos.value, ...fileIds].slice(0, photoLimit)
      await primeFileUrls(fileIds)
    }
    const failed = settled.find(item => item.status === 'rejected')
    if (failed?.status === 'rejected')
      showError(failed.reason)
  }
  catch (err) {
    if (!ignoredCancel(err))
      showError(err)
  }
  finally {
    uploading.value = false
  }
}

async function removePhoto(fileId: string) {
  const agreed = await ask('拿掉这张', '这张照片不会再出现在这餐里。', '拿掉')
  if (!agreed)
    return
  photos.value = photos.value.filter(item => item !== fileId)
}

async function remove() {
  if (!recordId.value || pending.value)
    return
  const agreed = await ask('删除这餐', '删掉之后，对方那里也不会再看到。', '删除')
  if (!agreed)
    return
  pending.value = true
  try {
    await deleteRecord(recordId.value)
    uni.navigateBack()
  }
  catch (err) {
    showError(err)
  }
  finally {
    pending.value = false
  }
}

async function submit() {
  if (pending.value)
    return
  if (!text.value.trim() && !photos.value.length) {
    showHint('照片和文字至少留一样')
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
  <page-meta :page-style="pageStyle" />
  <paper-page>
    <view class="flex flex-col gap-28rpx">
      <back-bar :label="backLabel" fallback="/pages/home/index" />
      <template v-if="ready">
        <view class="flex flex-col items-start gap-4rpx">
          <text class="text-72rpx text-ink leading-[1.15]" :class="faceOf('记下这餐', 'serif')">
            记下这餐
          </text>
          <ink-underline :width="176" />
        </view>
        <view class="box-border flex border-0 border-y-4rpx border-line border-solid py-24rpx">
          <view class="min-w-0 flex flex-1 flex-col gap-8rpx">
            <text class="text-28rpx text-accent leading-[1.15]" :class="faceOf('日期', 'mono')">
              日期
            </text>
            <picker v-if="!locked" mode="date" :value="date" @change="onDate">
              <text class="text-44rpx text-ink leading-[1.15]" :class="faceOf(dateLabel(date, today), 'serif')">
                {{ dateLabel(date, today) }}
              </text>
            </picker>
            <text v-else class="text-44rpx text-ink leading-[1.15]" :class="faceOf(dateLabel(date, today), 'serif')">
              {{ dateLabel(date, today) }}
            </text>
          </view>
          <view class="box-border min-w-0 flex flex-1 flex-col gap-8rpx border-0 border-l-4rpx border-line border-solid pl-24rpx">
            <text class="text-28rpx text-accent leading-[1.15]" :class="faceOf('餐次', 'mono')">
              餐次
            </text>
            <picker v-if="!locked" :range="slotLabels" @change="onSlot">
              <text class="text-44rpx text-ink leading-[1.15]" :class="faceOf(SLOT_LABEL[slot], 'serif')">
                {{ SLOT_LABEL[slot] }}
              </text>
            </picker>
            <text v-else class="text-44rpx text-ink leading-[1.15]" :class="faceOf(SLOT_LABEL[slot], 'serif')">
              {{ SLOT_LABEL[slot] }}
            </text>
          </view>
        </view>
        <view v-if="mealDishes.length" class="flex flex-col gap-4rpx">
          <text class="text-26rpx text-accent leading-[1.15]" :class="faceOf(mealLabel, 'mono')">
            {{ mealLabel }}
          </text>
          <view
            v-for="dish in mealDishes"
            :key="dish.dishId"
            class="flex items-center gap-20rpx py-8rpx"
          >
            <view
              class="h-96rpx w-96rpx shrink-0 rounded-28rpx"
              :style="{ boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.28)' }"
            >
              <dish-cover
                class="box-border h-full w-full border-6rpx border-photo rounded-28rpx border-solid"
                :file-id="dish.coverFileId"
                :name="dish.name"
              />
            </view>
            <text class="min-w-0 flex-1 text-36rpx text-ink leading-[1.15]" :class="faceOf(dish.name, 'serif')">
              {{ dish.name }}
            </text>
          </view>
        </view>
        <view class="flex flex-wrap items-start gap-16rpx">
          <view v-for="photo in photos" :key="photo" class="relative h-208rpx w-208rpx shrink-0" @tap="removePhoto(photo)">
            <view class="absolute left-6rpx top-8rpx h-full w-full rounded-36rpx bg-shade-28" />
            <view class="absolute inset-0 overflow-hidden rounded-36rpx">
              <dish-cover class="h-full w-full" :file-id="photo" name="照" />
            </view>
            <view class="pointer-events-none absolute inset-0 z-1 box-border border-6rpx border-photo rounded-36rpx border-solid" />
          </view>
          <view
            v-if="photos.length < photoLimit"
            class="box-border h-208rpx w-208rpx flex shrink-0 items-center justify-center border-4rpx border-line rounded-36rpx border-solid"
            @tap="addPhoto"
          >
            <text class="text-26rpx text-muted leading-[1.15]" :class="faceOf(uploading ? '正在加上' : '加一张', 'sans')">
              {{ uploading ? '正在加上' : '加一张' }}
            </text>
          </view>
        </view>
        <text class="text-26rpx text-muted leading-[1.15]" :class="faceOf(`${photos.length} / ${photoLimit} 张`, 'sans')">
          {{ photos.length }} / {{ photoLimit }} 张
        </text>
        <view class="box-border h-240rpx flex flex-col justify-between border-4rpx border-line rounded-36rpx border-solid bg-cream p-28rpx">
          <textarea
            v-model="text"
            class="box-border h-128rpx w-full text-40rpx text-ink leading-[1.15]"
            :class="faceOf(text, 'serif')"
            :maxlength="300"
            disable-default-padding
            placeholder="写点什么吧~"
            placeholder-class="ph-serif"
            :show-confirm-bar="false"
          />
          <text class="block text-right text-30rpx text-muted leading-[1.15]" :class="faceOf(`${text.length} / 300`, 'mono')">
            {{ text.length }} / 300
          </text>
        </view>
        <stamp-button :disabled="pending" :busy="pending" @button-tap="submit">
          {{ pending ? '正在记下' : '记下' }}
        </stamp-button>
        <text v-if="recordId" class="py-8rpx text-center text-28rpx text-danger" :class="faceOf('删除这餐', 'sans')" @tap="remove">
          删除这餐
        </text>
      </template>
    </view>
  </paper-page>
</template>
