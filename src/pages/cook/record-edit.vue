<script setup lang="ts">
import type { OrderDetail, RecordCard, Slot } from '@/api/eat'
import type { DishCard } from '@/api/types'
import { createRecord, dateLabel, deleteRecord, getOrder, listDishes, listMenu, listRecords, SLOT_LABEL, updateRecord } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { chooseImage, confirmPhotoUse, ignoredCancel, primeFileUrls, uploadImage } from '@/utils/files'
import { showHint } from '@/utils/hint'
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
const photos = ref<string[]>([])
const dishIds = ref<string[]>([])
const dishNames = ref<string[]>([])
const menu = ref<DishCard[]>([])
const locked = ref(false)
const pending = ref(false)
const ready = ref(false)
const hydrated = ref(false)
const recordsHome = ref('/pages/cook/records')
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
    const view = await ensureAccount({ next: 'home' })
    if (!view)
      return
    recordsHome.value = view.role === 'eater' ? '/pages/eat/records' : '/pages/cook/records'
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
        showHint('没有这一餐的记录')
        return
      }
      applyRecord(found)
      locked.value = true
      await primeFileUrls(found.photoFileIds)
    }
    else if (view.role === 'eater') {
      const listed = await listMenu()
      menu.value = listed.dishes.map(dish => ({ ...dish, status: 'on' }))
    }
    else {
      const listed = await listDishes()
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
  const allowed = await confirmPhotoUse('record')
  if (!allowed)
    return
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
  <paper-page>
    <view class="flex flex-col gap-28rpx">
      <back-bar :label="backLabel" :fallback="recordsHome" />
      <template v-if="ready">
      <view class="flex flex-col items-start">
        <text class="text-72rpx text-#3c2428 leading-[1.15]" :class="faceOf('记下这餐', 'serif')">
          记下这餐
        </text>
        <ink-underline class="mt-8rpx" :width="320" />
      </view>
      <view class="flex gap-24rpx">
        <view class="flex flex-1 flex-col gap-8rpx">
          <text class="text-28rpx text-#792b3e" :class="faceOf('日期', 'mono')">
            日期
          </text>
          <picker v-if="!locked" mode="date" :value="date" @change="onDate">
            <text class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(dateLabel(date, today), 'serif')">
              {{ dateLabel(date, today) }}
            </text>
          </picker>
          <text v-else class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(dateLabel(date, today), 'serif')">
            {{ dateLabel(date, today) }}
          </text>
        </view>
        <view class="flex flex-1 flex-col gap-8rpx">
          <text class="text-28rpx text-#792b3e" :class="faceOf('餐次', 'mono')">
            餐次
          </text>
          <picker v-if="!locked" :range="slotLabels" @change="onSlot">
            <text class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(SLOT_LABEL[slot], 'serif')">
              {{ SLOT_LABEL[slot] }}
            </text>
          </picker>
          <text v-else class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(SLOT_LABEL[slot], 'serif')">
            {{ SLOT_LABEL[slot] }}
          </text>
        </view>
      </view>
      <text v-if="dishNames.length" class="text-28rpx text-#792b3e">
        <text :class="faceOf('这一餐', 'mono')">这一餐</text>
        <text>  ·  </text>
        <text :class="faceOf(dishNames.join('、'), 'mono')">{{ dishNames.join('、') }}</text>
      </text>
      <view v-if="!locked && menu.length" class="flex flex-wrap gap-12rpx">
        <view
          v-for="dish in menu"
          :key="dish.dishId"
          class="rounded-full px-20rpx py-8rpx"
          :class="dishIds.includes(dish.dishId) ? 'bg-#792b3e' : 'bg-#fff9f4'"
          @tap="toggleDish(dish)"
        >
          <text class="text-26rpx" :class="[dishIds.includes(dish.dishId) ? 'text-#fff9f4' : 'text-#7a534c', faceOf(`${dish.name}${dish.status === 'off' ? ' · 已下架' : ''}`, 'sans')]">
            {{ dish.name }}{{ dish.status === 'off' ? ' · 已下架' : '' }}
          </text>
        </view>
      </view>
      <view class="flex flex-wrap gap-12rpx">
        <view v-for="photo in photos" :key="photo" class="relative">
          <dish-cover class="h-180rpx w-180rpx rounded-24rpx" :file-id="photo" name="照" />
          <text class="absolute right-8rpx top-8rpx text-24rpx text-#fff9f4" :class="faceOf('拿掉', 'sans')" @tap="removePhoto(photo)">
            拿掉
          </text>
        </view>
        <view
          v-if="photos.length < 9"
          class="h-180rpx w-180rpx flex items-center justify-center rounded-24rpx bg-#fff9f4"
          @tap="addPhoto"
        >
          <text class="text-26rpx text-#7a534c" :class="faceOf('再加', 'sans')">
            再加
          </text>
        </view>
      </view>
      <text class="text-26rpx text-#7a534c" :class="faceOf(`${photos.length} / 9 张`, 'sans')">
        {{ photos.length }} / 9 张
      </text>
      <view class="box-border h-240rpx flex flex-col justify-between rounded-28rpx bg-#fff9f4 px-28rpx py-28rpx">
        <textarea
          v-model="text"
          class="box-border h-140rpx w-full text-40rpx text-#3c2428 leading-[1.8]"
          :class="faceOf(text, 'serif')"
          :maxlength="300"
          placeholder="收汁收得久了一点，骨头很软。"
          placeholder-class="ph-serif"
          :show-confirm-bar="false"
        />
        <text class="block text-right text-30rpx text-#7a534c" :class="faceOf(`${text.length} / 300`, 'mono')">
          {{ text.length }} / 300
        </text>
      </view>
      <stamp-button :disabled="pending" :busy="pending" @tap="submit">
        {{ pending ? '正在记下' : '记下' }}
      </stamp-button>
      <text v-if="recordId" class="py-8rpx text-center text-28rpx text-#9c342c" :class="faceOf('删除这餐', 'sans')" @tap="remove">
        删除这餐
      </text>
      </template>
      <ink-load v-else label="正在摊开记录" />
    </view>
  </paper-page>
</template>

