<script setup lang="ts">
import type { AccountView, RecordCard } from '@/api/eat'
import { badges, dateLabel, listRecords, SLOT_LABEL } from '@/api/eat'
import { ensureAccount, rememberAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const account = ref<AccountView | null>(null)
const records = ref<RecordCard[]>([])
let spin = 0

onMounted(() => {
  void refresh()
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home', role: 'cooker' })
    if (!view || id !== spin)
      return
    const listed = await listRecords()
    const nextBadges = await badges()
    if (id !== spin)
      return
    account.value = { ...view, badges: nextBadges }
    rememberAccount(account.value)
    noteBadges(nextBadges)
    markTabFresh('records')
    records.value = listed.records
    await primeFileUrls(listed.records.flatMap(record => record.photoFileIds))
  }
  catch (err) {
    if (id === spin)
      showError(err)
  }
}

function createOne() {
  uni.navigateTo({ url: '/pages/cook/record-edit' })
}

function editOne(record: RecordCard) {
  uni.navigateTo({ url: `/pages/cook/record-edit?recordId=${record.recordId}` })
}

function when(record: RecordCard) {
  if (!account.value)
    return record.date
  const label = dateLabel(record.date, account.value.today)
  return label === record.date ? record.date : label
}

function photoRows(ids: string[]) {
  const photos = ids.slice(0, 9)
  const cols = photos.length === 2 || photos.length === 4 ? 2 : 3
  const rows: string[][] = []
  for (let index = 0; index < photos.length; index += cols)
    rows.push(photos.slice(index, index + cols))
  return rows
}

function wideTiles(count: number) {
  const shown = Math.min(count, 9)
  return shown === 2 || shown === 4
}

defineExpose({ refresh })
</script>

<template>
  <view>
    <ink-load v-if="!account" label="正在翻记下的" />
    <view v-else-if="!records.length" class="flex flex-col gap-28rpx">
      <screen-head title="记录" note="还没有记下的一餐" />
      <view class="w-full flex justify-center pb-16rpx pt-32rpx">
        <view class="relative h-336rpx w-456rpx" @tap="createOne">
          <view class="absolute left-0 top-84rpx box-border h-244rpx w-full flex items-end justify-center border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-44rpx">
            <view class="flex items-center gap-12rpx">
              <text class="text-44rpx text-#792b3e leading-none" :class="faceOf('记下这餐', 'serif')">
                记下这餐
              </text>
              <text class="text-44rpx text-#792b3e leading-none" :class="faceOf('›', 'sans')">
                ›
              </text>
            </view>
          </view>
          <image class="pointer-events-none absolute left-120rpx top-0 z-1 h-216rpx w-216rpx" src="/static/cook-seal.png" mode="aspectFit" />
        </view>
      </view>
    </view>
    <view v-else class="flex flex-col gap-32rpx">
      <screen-head title="记录">
        <view class="shrink-0 rounded-full bg-#792b3e px-24rpx py-20rpx shadow-[6rpx_8rpx_0_#4E222D59]" @tap="createOne">
          <text class="text-26rpx text-#fbf3ea font-medium leading-[1.15]" :class="faceOf('记下这餐', 'sans')">
            记下这餐
          </text>
        </view>
      </screen-head>
      <view
        v-for="record in records"
        :key="record.recordId"
        class="flex flex-col gap-16rpx border-0 border-t-4rpx border-#c9a297 border-solid pb-16rpx pt-32rpx"
        @tap="editOne(record)"
      >
        <view class="flex items-center justify-between">
          <text class="text-30rpx text-#792b3e leading-[1.15]" :class="faceOf(when(record), 'mono')">
            {{ when(record) }}
          </text>
          <text class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(SLOT_LABEL[record.slot], 'serif')">
            {{ SLOT_LABEL[record.slot] }}
          </text>
        </view>
        <view v-if="record.photoFileIds.length === 1" class="relative h-336rpx w-full">
          <view class="absolute left-6rpx top-8rpx h-full w-full rounded-36rpx bg-#4e222d/28" />
          <view class="absolute inset-0 overflow-hidden rounded-36rpx">
            <dish-cover class="h-full w-full" :file-id="record.photoFileIds[0]" name="照" size="cover" />
          </view>
          <view class="pointer-events-none absolute inset-0 z-1 box-border border-6rpx border-#fff9f4 rounded-36rpx border-solid" />
        </view>
        <view v-else-if="record.photoFileIds.length" class="flex flex-col gap-16rpx">
          <view v-for="(row, rowIndex) in photoRows(record.photoFileIds)" :key="rowIndex" class="flex gap-16rpx">
            <view
              v-for="photo in row"
              :key="photo"
              :class="wideTiles(record.photoFileIds.length) ? 'w-[calc((100%-16rpx)/2)]' : 'w-[calc((100%-32rpx)/3)]'"
            >
              <view class="relative pt-full">
                <view class="absolute inset-0">
                  <view class="absolute left-6rpx top-8rpx h-full w-full rounded-36rpx bg-#4e222d/28" />
                  <view class="absolute inset-0 overflow-hidden rounded-36rpx">
                    <dish-cover
                      class="h-full w-full"
                      :file-id="photo"
                      name="照"
                      :size="wideTiles(record.photoFileIds.length) ? 'tile' : 'thumb'"
                    />
                  </view>
                  <view class="pointer-events-none absolute inset-0 z-1 box-border border-6rpx border-#fff9f4 rounded-36rpx border-solid" />
                </view>
              </view>
            </view>
          </view>
        </view>
        <text v-if="record.dishes.length" class="text-28rpx text-#7a534c" :class="faceOf(record.dishes.map(dish => dish.name).join('、'), 'sans')">
          {{ record.dishes.map(dish => dish.name).join('、') }}
        </text>
        <text v-if="record.text" class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(record.text, 'serif')">
          {{ record.text }}
        </text>
      </view>
    </view>
  </view>
</template>
