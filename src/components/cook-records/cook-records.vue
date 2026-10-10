<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<script setup lang="ts">
import type { AccountView, RecordCard } from '@/api/eat'
import { badges, dateLabel, listRecords, SLOT_LABEL } from '@/api/eat'
import { usePaged } from '@/composables/usePaged'
import { ensureAccount, rememberAccount } from '@/utils/account'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { showHint } from '@/utils/hint'
import { fillRecords, isSample } from '@/utils/sample-feed'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const account = ref<AccountView | null>(null)
const pool = ref<RecordCard[]>([])
const rows = computed(() => fillRecords(pool.value, account.value?.today || ''))
const { shown, total, finished, loading, reset, more } = usePaged(rows)
const pulling = ref(false)
let spin = 0

onMounted(() => {
  void refresh()
})

async function refresh() {
  const id = ++spin
  try {
    const view = await ensureAccount({ next: 'home' })
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
    pool.value = listed.records
    reset()
    await primeFileUrls(listed.records.flatMap(record => record.photoFileIds))
  }
  catch (err) {
    if (id === spin)
      showError(err)
  }
}

async function onPull() {
  if (pulling.value)
    return
  pulling.value = true
  try {
    await refresh()
  }
  finally {
    pulling.value = false
  }
}

function createOne() {
  uni.navigateTo({ url: '/pages/cook/record-edit' })
}

function editOne(record: RecordCard) {
  if (isSample(record.recordId)) {
    showHint('这是凑出来的示例')
    return
  }
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
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <view class="shrink-0">
      <screen-head title="记录">
        <view v-if="account" class="eat-press shrink-0 rounded-full bg-#792b3e px-24rpx py-20rpx shadow-[6rpx_8rpx_0_#4E222D59]" hover-class="eat-press-on" :hover-stay-time="140" @tap="createOne">
          <text class="text-26rpx text-#fbf3ea font-medium leading-[1.15]" :class="faceOf('记下这餐', 'sans')">
            记下这餐
          </text>
        </view>
      </screen-head>
    </view>
    <ink-load v-if="!account" label="正在翻记下的" />
    <list-scroll
      v-else
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      @refresh="onPull"
      @more="more"
    >
      <view class="flex flex-col gap-32rpx pt-32rpx">
        <view
          v-for="record in shown"
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
    </list-scroll>
  </view>
</template>
