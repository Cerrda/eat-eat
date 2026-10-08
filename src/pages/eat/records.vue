<script setup lang="ts">
import type { AccountView, RecordCard } from '@/api/eat'
import { badges, dateLabel, listRecords, SLOT_LABEL } from '@/api/eat'
import { ensureAccount, rememberAccount } from '@/utils/account'
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

function editOne(record: RecordCard) {
  uni.navigateTo({ url: `/pages/cook/record-edit?recordId=${record.recordId}` })
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
    <view v-else-if="!records.length" class="flex flex-col items-start gap-8rpx pt-36rpx">
      <text class="text-72rpx text-#3c2428 leading-[1.15] font-display">
        还没有记下的一餐。
      </text>
      <image class="block w-220rpx" src="/static/underline.png" mode="widthFix" />
      <view class="mt-36rpx w-full flex flex-col items-center">
        <image class="relative z-1 h-216rpx w-216rpx" src="/static/cook-seal.png" mode="aspectFit" />
        <view class="relative z-0 -mt-84rpx w-456rpx flex items-center justify-center gap-8rpx border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-40rpx pt-148rpx" @tap="createOne">
          <text class="text-44rpx text-#792b3e font-display">
            记下这餐
          </text>
          <text class="text-44rpx text-#792b3e font-body">
            ›
          </text>
        </view>
      </view>
    </view>
    <view v-else class="flex flex-col gap-28rpx">
      <view class="flex items-start justify-between gap-16rpx">
        <screen-head title="记录" />
        <view class="mt-8rpx rounded-full bg-#792b3e px-28rpx py-14rpx" @tap="createOne">
          <text class="text-26rpx text-#fbf3ea font-body">
            记下这餐
          </text>
        </view>
      </view>
      <view
        v-for="record in records"
        :key="record.recordId"
        class="flex flex-col gap-12rpx border-0 border-t-2rpx border-#c9a297 border-solid pt-24rpx"
        @tap="editOne(record)"
      >
        <view class="flex items-end justify-between">
          <text class="text-28rpx text-#7a534c font-body">
            {{ when(record) }}
          </text>
          <text class="text-44rpx text-#3c2428 font-display">
            {{ SLOT_LABEL[record.slot] }}
          </text>
        </view>
        <text v-if="record.dishes.length" class="text-30rpx text-#3c2428 font-body">
          {{ record.dishes.map(dish => dish.name).join('、') }}
        </text>
        <text v-if="record.text" class="text-40rpx text-#3c2428 leading-[1.45] font-body">
          {{ record.text }}
        </text>
        <view v-if="record.photoFileIds.length" class="flex flex-wrap gap-12rpx">
          <dish-cover
            v-for="photo in record.photoFileIds"
            :key="photo"
            class="h-180rpx w-180rpx rounded-24rpx"
            :file-id="photo"
            name="照"
          />
        </view>
      </view>
    </view>
    <template #dock>
      <tab-dock role="eater" current="records" :badges="account?.badges || { todo: 0, orders: 0, records: 0 }" />
    </template>
  </paper-page>
</template>
