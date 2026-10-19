<script setup lang="ts">
import type { AccountView, RecordCard, RecordDish } from '@/api/eat'
import type { CloudImageSize } from '@/utils/files'
import { dateLabel, listRecords, SLOT_LABEL } from '@/api/eat'
import CoverZoom from '@/components/cover-zoom/cover-zoom.vue'
import { useCoverZoom } from '@/composables/useCoverZoom'
import { usePaged } from '@/composables/usePaged'
import { ensureAccount, patchBadges, rememberAccount } from '@/utils/account'
import { art } from '@/utils/theme'
import { faceOf } from '@/utils/face'
import { primeFileUrls } from '@/utils/files'
import { markTabFresh, noteBadges } from '@/utils/tabs'
import { showError } from '@/utils/ui'

const props = defineProps<{
  active?: boolean
}>()

const {
  coverZoom,
  heldId,
  domId,
  remember,
  release,
  open: openZoom,
} = useCoverZoom(() => props.active !== false)

const account = ref<AccountView | null>(null)
const { shown, total, finished, loading, reset, more } = usePaged(async (page) => {
  const listed = await listRecords({ page })
  await primeFileUrls(listed.records.flatMap(record => [
    ...record.photoFileIds,
    ...record.dishes.map(dish => dish.coverFileId),
  ]))
  return { rows: listed.records, total: listed.total }
})
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
    await reset()
    if (id !== spin)
      return
    const nextBadges = patchBadges({ records: 0 })
    account.value = { ...view, badges: nextBadges }
    rememberAccount(account.value)
    noteBadges(nextBadges)
    markTabFresh('records')
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

async function onMore() {
  try {
    await more()
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

function photoKey(recordId: string, index: number) {
  return `${recordId}-${index}`
}

function photoAt(count: number, rowIndex: number, column: number) {
  const cols = wideTiles(count) ? 2 : 3
  return rowIndex * cols + column
}

function dishKey(recordId: string, dishId: string) {
  return `${recordId}-dish-${dishId}`
}

function openDish(record: RecordCard, dish: RecordDish) {
  if (!dish.coverFileId)
    return
  void openZoom({
    id: dishKey(record.recordId, dish.dishId),
    fileId: dish.coverFileId,
    radius: 28,
  })
}

function openPhoto(record: RecordCard, index: number, from: Exclude<CloudImageSize, 'raw'>) {
  const fileId = record.photoFileIds[index]
  if (!fileId)
    return
  void openZoom({
    id: photoKey(record.recordId, index),
    fileId,
    from,
    sharp: from === 'cover' ? 'raw' : 'cover',
  })
}

defineExpose({ refresh })
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view class="h-full min-h-0 flex flex-1 flex-col">
    <list-scroll
      :refreshing="pulling"
      :loading="loading"
      :finished="finished"
      :total="total"
      @refresh="onPull"
      @more="onMore"
    >
      <screen-head title="记录" :note="account && !total ? '还没有记下的一餐' : ''">
        <view v-if="account && total" class="eat-press shrink-0 rounded-full bg-accent px-24rpx py-20rpx shadow-stamp" hover-class="eat-press-on" :hover-stay-time="140" @tap="createOne">
          <text class="text-26rpx text-paper font-medium leading-[1.15]" :class="faceOf('记下这餐', 'sans')">
            记下这餐
          </text>
        </view>
      </screen-head>
      <template v-if="account">
        <view v-if="!total" class="w-full flex justify-center pb-16rpx pt-32rpx">
          <view class="relative h-336rpx w-456rpx" @tap="createOne">
            <view class="absolute left-0 top-84rpx box-border h-244rpx w-full flex items-end justify-center border-2rpx border-line rounded-40rpx border-solid bg-cream px-32rpx pb-44rpx">
              <view class="flex items-center gap-12rpx">
                <text class="text-44rpx text-accent leading-none" :class="faceOf('记下这餐', 'serif')">
                  记下这餐
                </text>
                <text class="text-44rpx text-accent leading-none" :class="faceOf('›', 'sans')">
                  ›
                </text>
              </view>
            </view>
            <image class="pointer-events-none absolute left-120rpx top-0 z-1 h-216rpx w-216rpx" :src="art('cook-seal')" mode="aspectFit" />
          </view>
        </view>
        <view v-else class="flex flex-col gap-32rpx pt-32rpx">
          <view
            v-for="record in shown"
            :key="record.recordId"
            class="flex flex-col gap-24rpx border-0 border-t-4rpx border-line border-solid pb-16rpx pt-32rpx"
            @tap="editOne(record)"
          >
            <view class="flex items-center justify-between">
              <text class="text-60rpx text-accent leading-[1.15]" :class="faceOf(when(record), 'mono')">
                {{ when(record) }}
              </text>
              <text class="text-30rpx text-ink leading-[1.15]" :class="faceOf(SLOT_LABEL[record.slot], 'serif')">
                {{ SLOT_LABEL[record.slot] }}
              </text>
            </view>
            <text v-if="record.authorName" class="text-36rpx text-ink leading-[1.15]" :class="faceOf(`${record.authorName}记下`, 'serif')">
              {{ record.authorName }}记下
            </text>
            <view v-if="record.dishes.length" class="flex flex-col">
              <view
                v-for="dish in record.dishes"
                :key="dish.dishId"
                class="flex items-center gap-20rpx py-8rpx"
              >
                <view
                  :id="domId(dishKey(record.recordId, dish.dishId))"
                  class="h-96rpx w-96rpx shrink-0 rounded-28rpx"
                  :style="{ boxShadow: '6rpx 8rpx 0 rgba(78, 34, 45, 0.28)' }"
                  @tap.stop="openDish(record, dish)"
                >
                  <dish-cover
                    class="box-border h-full w-full border-6rpx border-photo rounded-28rpx border-solid"
                    :file-id="dish.coverFileId"
                    :name="dish.name"
                    :held="heldId === dishKey(record.recordId, dish.dishId)"
                    @size="remember(dishKey(record.recordId, dish.dishId), $event)"
                  />
                </view>
                <text class="min-w-0 flex-1 text-36rpx text-ink leading-[1.15]" :class="faceOf(dish.name, 'serif')">
                  {{ dish.name }}
                </text>
              </view>
            </view>
            <view
              v-if="record.photoFileIds.length === 1"
              :id="domId(photoKey(record.recordId, 0))"
              class="relative h-336rpx w-full"
              @tap.stop="openPhoto(record, 0, 'cover')"
            >
              <view class="absolute left-6rpx top-8rpx h-full w-full rounded-36rpx bg-shade-28" />
              <view class="absolute inset-0 overflow-hidden rounded-36rpx">
                <dish-cover
                  class="h-full w-full"
                  :file-id="record.photoFileIds[0]"
                  name="照"
                  size="cover"
                  :held="heldId === photoKey(record.recordId, 0)"
                  @size="remember(photoKey(record.recordId, 0), $event)"
                />
              </view>
              <view class="pointer-events-none absolute inset-0 z-1 box-border border-6rpx border-photo rounded-36rpx border-solid" />
            </view>
            <view v-else-if="record.photoFileIds.length" class="flex flex-col gap-16rpx">
              <view v-for="(row, rowIndex) in photoRows(record.photoFileIds)" :key="rowIndex" class="flex gap-16rpx">
                <view
                  v-for="(photo, column) in row"
                  :key="`${rowIndex}-${column}`"
                  :class="wideTiles(record.photoFileIds.length) ? 'w-[calc((100%-16rpx)/2)]' : 'w-[calc((100%-32rpx)/3)]'"
                >
                  <view class="relative pt-full">
                    <view
                      :id="domId(photoKey(record.recordId, photoAt(record.photoFileIds.length, rowIndex, column)))"
                      class="absolute inset-0"
                      @tap.stop="openPhoto(record, photoAt(record.photoFileIds.length, rowIndex, column), wideTiles(record.photoFileIds.length) ? 'tile' : 'thumb')"
                    >
                      <view class="absolute left-6rpx top-8rpx h-full w-full rounded-36rpx bg-shade-28" />
                      <view class="absolute inset-0 overflow-hidden rounded-36rpx">
                        <dish-cover
                          class="h-full w-full"
                          :file-id="photo"
                          name="照"
                          :size="wideTiles(record.photoFileIds.length) ? 'tile' : 'thumb'"
                          :held="heldId === photoKey(record.recordId, photoAt(record.photoFileIds.length, rowIndex, column))"
                          @size="remember(photoKey(record.recordId, photoAt(record.photoFileIds.length, rowIndex, column)), $event)"
                        />
                      </view>
                      <view class="pointer-events-none absolute inset-0 z-1 box-border border-6rpx border-photo rounded-36rpx border-solid" />
                    </view>
                  </view>
                </view>
              </view>
            </view>
            <text v-if="record.text" class="text-44rpx text-ink leading-[1.15]" :class="faceOf(record.text, 'serif')">
              {{ record.text }}
            </text>
          </view>
        </view>
      </template>
    </list-scroll>
    <CoverZoom ref="coverZoom" @idle="release" />
  </view>
</template>
