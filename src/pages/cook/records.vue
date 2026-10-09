<script setup lang="ts">
import type { AccountView, RecordCard } from '@/api/eat'
import { badges, dateLabel, listRecords, SLOT_LABEL } from '@/api/eat'
import { ensureAccount, rememberAccount } from '@/utils/account'
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
    <ink-load v-if="!account" label="正在翻记下的" />
    <view v-else-if="!records.length" class="flex flex-col gap-28rpx">
      <screen-head title="记录" note="还没有记下的一餐" />
      <view class="w-full flex flex-col items-center">
        <image class="relative z-1 h-216rpx w-216rpx" src="/static/cook-seal.png" mode="aspectFit" />
        <view class="relative z-0 -mt-84rpx w-456rpx flex items-center justify-center gap-8rpx border-2rpx border-#c9a297 rounded-40rpx border-solid bg-#fff9f4 px-32rpx pb-40rpx pt-148rpx" @tap="createOne">
          <text class="text-44rpx text-#792b3e" :class="faceOf('记下这餐', 'serif')">
            记下这餐
          </text>
          <text class="text-44rpx text-#792b3e" :class="faceOf('›', 'sans')">
            ›
          </text>
        </view>
      </view>
    </view>
    <view v-else class="flex flex-col gap-32rpx">
      <screen-head title="记录">
        <view class="mb-4rpx shrink-0 rounded-full bg-#792b3e px-24rpx py-20rpx shadow-[6rpx_8rpx_0_#4E222D59]" @tap="createOne">
          <text class="text-26rpx text-#fbf3ea font-medium leading-[1.15]" :class="faceOf('记下这餐', 'sans')">
            记下这餐
          </text>
        </view>
      </screen-head>
      <view
        v-for="record in records"
        :key="record.recordId"
        class="flex flex-col gap-12rpx"
        @tap="editOne(record)"
      >
        <view class="flex items-end justify-between">
          <text class="text-30rpx text-#792b3e" :class="faceOf(when(record), 'mono')">
            {{ when(record) }}
          </text>
          <text class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(SLOT_LABEL[record.slot], 'serif')">
            {{ SLOT_LABEL[record.slot] }}
          </text>
        </view>
        <dish-cover
          v-if="record.photoFileIds[0]"
          class="h-336rpx w-full rounded-36rpx"
          :file-id="record.photoFileIds[0]"
          name="照"
        />
        <text v-if="record.dishes.length" class="text-28rpx text-#7a534c" :class="faceOf(record.dishes.map(dish => dish.name).join('、'), 'sans')">
          {{ record.dishes.map(dish => dish.name).join('、') }}
        </text>
        <text v-if="record.text" class="text-44rpx text-#3c2428 leading-[1.15]" :class="faceOf(record.text, 'serif')">
          {{ record.text }}
        </text>
      </view>
    </view>
    <template #dock>
      <tab-dock role="cooker" current="records" :badges="account?.badges || { todo: 0, orders: 0, records: 0 }" />
    </template>
  </paper-page>
</template>
