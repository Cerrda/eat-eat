<script setup lang="ts">
import type { AccountView, RecordCard } from '@/api/eat'
import { badges, dateLabel, listRecords, SLOT_LABEL } from '@/api/eat'
import { ensureAccount, rememberAccount } from '@/utils/account'
import { whenTabIdle } from '@/utils/tab-motion'
import { faceOf } from '@/utils/face'
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
const records = ref<RecordCard[]>([])

onShow(() => {
  void refresh()
})

async function refresh() {
  try {
    const view = await ensureAccount({ next: 'home', role: 'eater' })
    if (!view)
      return
    const listed = await listRecords()
    const nextBadges = await badges()
    await whenTabIdle()
    account.value = { ...view, badges: nextBadges }
    rememberAccount(account.value)
    records.value = listed.records
    await primeFileUrls(listed.records.flatMap(record => record.photoFileIds))
  }
  catch (err) {
    showError(err)
  }
}

function createOne() {
  uni.navigateTo({ url: '/pages/cook/record-edit' })
}

function when(record: RecordCard) {
  if (!account.value)
    return record.date
  const label = dateLabel(record.date, account.value.today)
  return label === record.date ? record.date : label
}
</script>

<template>
  <paper-page dock>
    <ink-load v-if="!account" label="正在翻记下的" />
    <view v-else-if="!records.length" class="flex flex-col gap-28rpx">
      <screen-head title="记录" note="还没有记下的一餐。" />
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
    <view v-else class="flex flex-col gap-28rpx">
      <screen-head title="记录" />
      <view
        v-for="record in records"
        :key="record.recordId"
        class="flex flex-col gap-16rpx border-0 border-t-4rpx border-#c9a297 border-solid pt-28rpx"
      >
        <view class="flex items-center justify-between">
          <text class="text-30rpx text-#792b3e leading-[1.15]" :class="faceOf(when(record), 'mono')">
            {{ when(record) }}
          </text>
          <text class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(SLOT_LABEL[record.slot], 'serif')">
            {{ SLOT_LABEL[record.slot] }}
          </text>
        </view>
        <view v-if="record.photoFileIds[0]" class="relative h-360rpx w-full">
          <view class="absolute left-6rpx top-8rpx h-full w-full rounded-36rpx bg-#4e222d/28" />
          <view class="absolute inset-0 overflow-hidden rounded-36rpx">
            <dish-cover class="h-full w-full" :file-id="record.photoFileIds[0]" name="照" />
          </view>
          <view class="pointer-events-none absolute inset-0 z-1 box-border border-6rpx border-#fff9f4 rounded-36rpx border-solid" />
        </view>
        <text v-if="record.dishes.length" class="text-28rpx text-#7a534c" :class="faceOf(record.dishes.map(dish => dish.name).join('、'), 'sans')">
          {{ record.dishes.map(dish => dish.name).join('、') }}
        </text>
        <text v-if="record.text" class="text-48rpx text-#3c2428 leading-[1.15]" :class="faceOf(record.text, 'serif')">
          {{ record.text }}
        </text>
      </view>
    </view>
    <template #dock>
      <tab-dock role="eater" current="records" :badges="account?.badges || { todo: 0, orders: 0, records: 0 }" />
    </template>
  </paper-page>
</template>
