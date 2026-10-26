<script setup lang="ts">
import type { OrderDetail, RecordCard, RecordDish, Slot } from '@/api/eat'
import { createRecord, dateLabel, deleteRecord, getOrder, getRecord, matchMeal, SLOT_LABEL, updateRecord } from '@/api/eat'
import { ensureAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { chooseImages, ignoredCancel, primeFileUrls, uploadImage } from '@/utils/files'
import { defaultMeal, monthDay } from '@/utils/format'
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
const sheetOpen = ref(false)
const mealOpen = ref(false)
const mealMatchDate = ref('')
const mealMatchSlot = ref<Slot>('noon')
const savedDate = ref('')
const savedSlot = ref<Slot>('noon')
let mealCloseTimer: ReturnType<typeof setTimeout> | undefined
const slotOptions: Array<{ value: Slot, label: string, short: string }> = [
  { value: 'morning', label: '早上', short: '早' },
  { value: 'noon', label: '中午', short: '中' },
  { value: 'evening', label: '晚上', short: '晚' },
]

const dateMain = computed(() => {
  if (!date.value)
    return ''
  return dateLabel(date.value, today.value)
})

const dateSub = computed(() => {
  if (!date.value)
    return ''
  return `${monthDay(date.value)} ${weekdayLabel(date.value)}`
})

const mealLabel = computed(() => {
  if (!mealMatchDate.value)
    return ''
  return `${dateLabel(mealMatchDate.value, today.value)}${SLOT_LABEL[mealMatchSlot.value]}点的`
})

const mealPanelHeight = computed(() => {
  if (!mealOpen.value || !mealDishes.value.length)
    return '0rpx'
  return `${40 + mealDishes.value.length * 116}rpx`
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

onUnmounted(() => {
  clearMealClose()
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
    if (!date.value) {
      const pick = defaultMeal(view.today)
      date.value = pick.date
      slot.value = pick.slot
    }
    if (orderId.value) {
      const order = await getOrder(orderId.value)
      applyOrder(order)
      locked.value = true
    }
    else if (recordId.value) {
      const found = await getRecord(recordId.value)
      applyRecord(found)
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

function clearMealClose() {
  if (!mealCloseTimer)
    return
  clearTimeout(mealCloseTimer)
  mealCloseTimer = undefined
}

function showMeal(dishes: RecordDish[], matchedDate: string, matchedSlot: Slot) {
  dishIds.value = dishes.map(dish => dish.dishId)
  if (dishes.length) {
    clearMealClose()
    mealDishes.value = dishes
    mealMatchDate.value = matchedDate
    mealMatchSlot.value = matchedSlot
    mealOpen.value = true
    return
  }
  if (!mealDishes.value.length) {
    mealOpen.value = false
    mealMatchDate.value = ''
    return
  }
  clearMealClose()
  mealOpen.value = false
  mealCloseTimer = setTimeout(() => {
    mealCloseTimer = undefined
    mealDishes.value = []
    mealMatchDate.value = ''
  }, 260)
}

async function loadMeal() {
  const id = ++mealSpin
  clearMealClose()
  const matchedDate = date.value
  const matchedSlot = slot.value
  if (!matchedDate) {
    showMeal([], matchedDate, matchedSlot)
    return
  }
  try {
    const matched = await matchMeal(matchedDate, matchedSlot)
    if (id !== mealSpin)
      return
    await primeFileUrls(matched.dishes.map(dish => dish.coverFileId))
    if (id !== mealSpin)
      return
    showMeal(matched.dishes, matchedDate, matchedSlot)
  }
  catch (err) {
    if (id === mealSpin) {
      showMeal([], matchedDate, matchedSlot)
      showError(err)
    }
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
  savedDate.value = record.date
  savedSlot.value = record.slot
  text.value = record.text
  photos.value = [...record.photoFileIds]
}

function weekdayLabel(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  const week = new Date(Date.UTC(year, month - 1, date)).getUTCDay()
  return `周${'日一二三四五六'[week]}`
}

function openSheet() {
  if (locked.value || pending.value)
    return
  sheetOpen.value = true
}

function chooseDate(next: string) {
  if (locked.value || pending.value)
    return
  sheetOpen.value = false
  if (next === date.value)
    return
  date.value = next
  dishIds.value = []
  void loadMeal()
}

function chooseSlot(next: Slot) {
  if (locked.value || pending.value || next === slot.value)
    return
  slot.value = next
  dishIds.value = []
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
    const moved = !!recordId.value && (date.value !== savedDate.value || slot.value !== savedSlot.value)
    if (!orderId.value && (!recordId.value || moved)) {
      const matched = await matchMeal(date.value, slot.value)
      showMeal(matched.dishes, date.value, slot.value)
      if (!matched.dishes.length) {
        const agreed = await ask(
          '这餐还没对上',
          `${dateLabel(date.value, today.value)}${SLOT_LABEL[slot.value]}还没找到对应的点餐，日期和餐次要不要再确认一下？`,
          '就这样记',
          '再看看',
        )
        if (!agreed)
          return
      }
    }
    if (recordId.value) {
      await updateRecord({
        recordId: recordId.value,
        date: date.value,
        slot: slot.value,
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
        <view class="box-border w-full flex gap-20rpx border-4rpx border-line rounded-36rpx border-solid bg-cream p-24rpx shadow-stamp">
          <view class="min-w-0 flex flex-1 flex-col gap-8rpx" @tap="openSheet">
            <view class="min-h-48rpx w-full flex items-center justify-between gap-8rpx">
              <text class="text-28rpx text-accent leading-[1.15]" :class="faceOf('日期', 'mono')">
                日期
              </text>
              <view
                v-if="!locked"
                class="eat-press box-border flex shrink-0 items-center gap-6rpx border-3rpx border-line rounded-24rpx border-solid bg-paper px-16rpx py-8rpx"
                hover-class="eat-press-on"
                :hover-stay-time="120"
              >
                <view class="i-mingcute-calendar-line text-24rpx text-accent" />
                <text class="text-24rpx text-accent leading-none" :class="faceOf('换一天', 'sans')">
                  换一天
                </text>
              </view>
            </view>
            <view :key="date" class="record-date-in flex min-w-0 flex-col gap-2rpx">
              <text class="block truncate text-44rpx text-ink leading-[1.15]" :class="faceOf(dateMain, 'serif')">
                {{ dateMain }}
              </text>
              <text class="block truncate text-24rpx text-muted leading-[1.3]" :class="faceOf(dateSub, 'sans')">
                {{ dateSub }}
              </text>
            </view>
          </view>
          <view class="box-border min-w-0 flex flex-1 flex-col gap-12rpx border-0 border-l-4rpx border-line border-solid pl-24rpx">
            <view class="min-h-48rpx w-full flex items-center">
              <text class="text-28rpx text-accent leading-[1.15]" :class="faceOf('餐次', 'mono')">
                餐次
              </text>
            </view>
            <view class="flex gap-8rpx">
              <view
                v-for="item in slotOptions"
                :key="item.value"
                class="record-slot h-88rpx flex flex-1 items-center justify-center border-3rpx rounded-28rpx border-solid"
                :class="slot === item.value ? 'record-slot-on' : 'record-slot-off'"
                :aria-label="item.label"
                :hover-class="locked || slot === item.value ? 'none' : 'record-slot-press'"
                :hover-stay-time="100"
                @tap="chooseSlot(item.value)"
              >
                <text
                  class="text-36rpx leading-[1.15]"
                  :class="[slot === item.value ? 'text-paper' : 'text-ink', faceOf(item.short, 'serif')]"
                >
                  {{ item.short }}
                </text>
              </view>
            </view>
          </view>
        </view>
        <view
          class="record-meal-panel"
          :class="mealOpen && mealDishes.length ? 'record-meal-panel-on' : ''"
          :style="{ maxHeight: mealPanelHeight }"
        >
          <view
            v-if="mealDishes.length"
            class="record-meal-content flex flex-col gap-4rpx"
          >
            <text :key="mealLabel" class="record-meal-in text-26rpx text-accent leading-[1.15]" :class="faceOf(mealLabel, 'mono')">
              {{ mealLabel }}
            </text>
            <view
              v-for="(dish, index) in mealDishes"
              :key="`${mealMatchDate}-${mealMatchSlot}-${dish.dishId}`"
              class="record-meal-in flex items-center gap-20rpx py-8rpx"
              :style="{ animationDelay: `${40 + index * 36}ms` }"
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
              <text class="min-w-0 flex-1 truncate text-36rpx text-ink leading-[1.15]" :class="faceOf(dish.name, 'serif')">
                {{ dish.name }}
              </text>
            </view>
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
    <template #dock>
      <date-sheet
        v-if="!locked"
        :open="sheetOpen"
        :value="date"
        :today="today"
        @select="chooseDate"
        @close="sheetOpen = false"
      />
    </template>
  </paper-page>
</template>

<style>
.record-date-in {
  animation: record-date-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.record-slot {
  transition:
    transform 120ms cubic-bezier(0.2, 0, 0, 1),
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease;
}

.record-slot-on {
  border-color: transparent;
  background-color: var(--accent);
  animation: record-slot-on 220ms cubic-bezier(0.22, 1.08, 0.36, 1);
}

.record-slot-off {
  border-color: var(--line);
  background-color: var(--paper);
}

.record-slot-press {
  transform: scale(0.95);
}

.record-meal-panel {
  overflow: hidden;
  max-height: 0;
  /* 空着时抵掉父级 flex gap，展开后再把上下间距补回来 */
  margin: -14rpx 0;
  transition:
    max-height 240ms cubic-bezier(0.4, 0, 0.2, 1),
    margin 240ms cubic-bezier(0.4, 0, 0.2, 1);
}

.record-meal-panel-on {
  margin: 0;
  transition:
    max-height 300ms cubic-bezier(0.22, 1, 0.36, 1),
    margin 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

.record-meal-panel .record-meal-content {
  opacity: 0;
  transition: opacity 160ms ease;
}

.record-meal-panel-on .record-meal-content {
  opacity: 1;
  transition: opacity 200ms ease;
}

.record-meal-in {
  animation: record-meal-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes record-date-in {
  from {
    opacity: 0;
    transform: translate3d(0, 12rpx, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes record-slot-on {
  from {
    transform: scale(0.94);
  }

  to {
    transform: scale(1);
  }
}

@keyframes record-meal-in {
  from {
    opacity: 0;
    transform: translate3d(0, 16rpx, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
</style>
