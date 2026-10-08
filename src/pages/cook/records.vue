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
let spin = 0

onShow(() => {
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
</script>

<template>
  <paper-page dock>
    <view class="flex flex-col gap-28rpx">
      <screen-head title="记录" />
      <view class="self-start" @tap="createOne">
        <text class="text-28rpx text-#792b3e font-body">
          记下这餐
        </text>
      </view>
      <ink-load v-show="!account" label="正在翻记下的" />
      <view v-show="account" class="flex flex-col gap-28rpx">
      <text v-if="!records.length" class="text-30rpx text-#7a534c leading-[1.5] font-body">
        还没有记下。
      </text>
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
        <text v-if="record.text" class="text-36rpx text-#3c2428 leading-[1.45] font-body">
          {{ record.text }}
        </text>
        <view v-if="record.photoFileIds.length" class="flex flex-wrap gap-12rpx">
          <dish-cover
            v-for="photo in record.photoFileIds"
            :key="photo"
            class="h-160rpx w-160rpx rounded-24rpx"
            :file-id="photo"
            name="照"
          />
        </view>
      </view>
      </view>
    </view>
    <template #dock>
      <tab-dock role="cooker" current="records" :badges="account?.badges || { todo: 0, orders: 0, records: 0 }" />
    </template>
  </paper-page>
</template>
