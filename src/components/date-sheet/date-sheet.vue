<script setup lang="ts">
import { faceOf } from '@/utils/face'

interface DayCell {
  key: string
  date: string
  day: number
  outside: boolean
  enabled: boolean
  selected: boolean
}

const props = defineProps<{
  open: boolean
  value: string
  today: string
}>()

const emit = defineEmits<{
  select: [date: string]
  close: []
}>()

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const visible = ref(false)
const shown = ref(false)
const year = ref(0)
const month = ref(1)
const monthDir = ref<'next' | 'prev'>('next')
let leaveTimer: ReturnType<typeof setTimeout> | undefined

const monthKey = computed(() => `${year.value}-${String(month.value).padStart(2, '0')}`)
const currentMonthKey = computed(() => props.today.slice(0, 7))
const canNext = computed(() => monthKey.value < currentMonthKey.value)
const monthLabel = computed(() => `${year.value}年${month.value}月`)

const weeks = computed(() => {
  const y = year.value
  const m = month.value
  if (!y || !m)
    return []
  const first = new Date(Date.UTC(y, m - 1, 1))
  const offset = first.getUTCDay()
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const total = Math.ceil((offset + length) / 7) * 7
  const cells: DayCell[] = []
  for (let index = 0; index < total; index++) {
    const day = new Date(Date.UTC(y, m - 1, 1 - offset + index))
    const date = isoDate(day)
    const outside = day.getUTCMonth() !== m - 1
    cells.push({
      key: date,
      date,
      day: day.getUTCDate(),
      outside,
      enabled: !outside && date <= props.today,
      selected: !outside && date === props.value,
    })
  }
  const rows: DayCell[][] = []
  for (let index = 0; index < cells.length; index += 7)
    rows.push(cells.slice(index, index + 7))
  return rows
})

watch(() => props.open, (open) => {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = undefined
  }
  if (open) {
    jumpTo(props.value || props.today, false)
    visible.value = true
    shown.value = true
    return
  }
  if (!visible.value)
    return
  shown.value = false
  leaveTimer = setTimeout(() => {
    visible.value = false
    leaveTimer = undefined
  }, 260)
}, { immediate: true })

onUnmounted(() => {
  if (leaveTimer)
    clearTimeout(leaveTimer)
})

function isoDate(day: Date) {
  const y = day.getUTCFullYear()
  const m = String(day.getUTCMonth() + 1).padStart(2, '0')
  const d = String(day.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function jumpTo(date: string, animate = true) {
  const [y, m] = date.split('-').map(Number)
  if (!y || !m)
    return
  const nextKey = `${y}-${String(m).padStart(2, '0')}`
  if (animate && nextKey !== monthKey.value)
    monthDir.value = nextKey > monthKey.value ? 'next' : 'prev'
  year.value = y
  month.value = m
}

function stepMonth(delta: number) {
  if (delta > 0 && !canNext.value)
    return
  monthDir.value = delta > 0 ? 'next' : 'prev'
  const next = new Date(Date.UTC(year.value, month.value - 1 + delta, 1))
  year.value = next.getUTCFullYear()
  month.value = next.getUTCMonth() + 1
}

function pick(cell: DayCell) {
  if (!cell.enabled)
    return
  emit('select', cell.date)
}

function selectToday() {
  jumpTo(props.today)
  emit('select', props.today)
}

function dayStyle(cell: DayCell) {
  if (cell.selected)
    return ''
  if (cell.outside)
    return 'opacity: 0.3;'
  if (!cell.enabled)
    return 'opacity: 0.5;'
  return ''
}

function close() {
  emit('close')
}

function freeze() {}
</script>

<script lang="ts">
export default {
  options: {
    virtualHost: true,
  },
}
</script>

<template>
  <view
    v-if="visible"
    class="fixed bottom-0 left-0 right-0 top-0"
    style="z-index: 35;"
    @touchmove.stop.prevent="freeze"
  >
    <view
      class="absolute bottom-0 left-0 right-0 top-0 bg-scrim"
      :class="shown ? 'date-mask-in' : 'date-mask-out'"
      @tap="close"
    />
    <view
      class="date-sheet box-border absolute bottom-0 left-0 right-0 overflow-hidden border-0 border-t-4rpx border-line border-solid bg-cream px-40rpx pt-28rpx"
      :class="shown ? 'date-sheet-in' : 'date-sheet-out'"
      :style="{ paddingBottom: 'calc(68rpx + env(safe-area-inset-bottom))' }"
      @tap.stop="freeze"
    >
      <view class="flex flex-col gap-20rpx" :class="shown ? 'date-body-in' : ''">
        <view class="flex justify-center">
          <view class="h-8rpx w-80rpx rounded-4rpx bg-line" />
        </view>
        <view class="flex items-center justify-between gap-16rpx">
          <text class="text-48rpx text-ink leading-[1.15]" :class="faceOf('选日期', 'serif')">
            选日期
          </text>
          <view
            class="eat-press box-border h-56rpx flex items-center justify-center rounded-30rpx border-3rpx border-line border-solid bg-paper px-24rpx"
            hover-class="eat-press-on"
            :hover-stay-time="120"
            @tap="selectToday"
          >
            <text class="text-26rpx text-accent leading-[1.2]" :class="faceOf('今天', 'sans')">
              今天
            </text>
          </view>
        </view>
        <view class="box-border flex items-center justify-between gap-20rpx border-3rpx border-line rounded-44rpx border-solid bg-paper px-24rpx py-12rpx">
          <view
            class="h-52rpx w-52rpx flex items-center justify-center"
            hover-class="eat-press-on"
            :hover-stay-time="120"
            @tap="stepMonth(-1)"
          >
            <view class="date-chevron date-chevron-left text-ink" />
          </view>
          <text class="text-40rpx text-ink leading-[1.15]" :class="faceOf(monthLabel, 'serif')">
            {{ monthLabel }}
          </text>
          <view
            class="h-52rpx w-52rpx flex items-center justify-center"
            :class="canNext ? '' : 'opacity-50'"
            :hover-class="canNext ? 'eat-press-on' : 'none'"
            :hover-stay-time="120"
            @tap="stepMonth(1)"
          >
            <view class="date-chevron date-chevron-right" :class="canNext ? 'text-ink' : 'text-line'" />
          </view>
        </view>
        <view class="box-border h-56rpx w-full flex items-center rounded-20rpx bg-wash py-6rpx">
          <view v-for="label in WEEKDAYS" :key="label" class="flex flex-1 items-center justify-center">
            <text class="text-26rpx text-accent leading-[1.15]" :class="faceOf(label, 'mono')">
              {{ label }}
            </text>
          </view>
        </view>
        <view
          :key="monthKey"
          class="flex flex-col"
          :class="monthDir === 'prev' ? 'date-grid-prev' : 'date-grid-next'"
        >
          <view v-for="(week, weekIndex) in weeks" :key="weekIndex" class="h-80rpx w-full flex items-center">
            <view v-for="cell in week" :key="cell.key" class="h-full flex flex-1 items-center justify-center">
              <view
                class="date-day h-72rpx w-72rpx flex items-center justify-center rounded-full"
                :class="cell.selected ? 'date-day-on' : ''"
                :hover-class="cell.enabled ? 'date-day-press' : 'none'"
                :hover-stay-time="90"
                @tap="pick(cell)"
              >
                <text
                  class="text-32rpx leading-[1.15]"
                  :class="[cell.selected ? 'text-paper' : cell.enabled ? 'text-ink' : 'text-line', faceOf(String(cell.day), 'serif')]"
                  :style="dayStyle(cell)"
                >
                  {{ cell.day }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.date-sheet {
  border-radius: 44rpx 44rpx 0 0;
}

.date-mask-in {
  animation: date-mask-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.date-mask-out {
  animation: date-mask-out 220ms cubic-bezier(0.4, 0, 1, 1) both;
}

.date-sheet-in {
  animation: date-sheet-in 340ms cubic-bezier(0.22, 1.06, 0.36, 1) both;
}

.date-sheet-out {
  animation: date-sheet-out 260ms cubic-bezier(0.4, 0, 1, 1) both;
}

.date-body-in {
  animation: date-body-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both;
}

.date-grid-next {
  animation: date-grid-next 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.date-grid-prev {
  animation: date-grid-prev 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.date-chevron {
  width: 14rpx;
  height: 14rpx;
  border-bottom: 3rpx solid currentColor;
  border-left: 3rpx solid currentColor;
}

.date-chevron-left {
  transform: rotate(45deg);
}

.date-chevron-right {
  transform: rotate(-135deg);
}

.date-day {
  transition:
    transform 120ms cubic-bezier(0.2, 0, 0, 1),
    background-color 180ms ease,
    color 180ms ease;
}

.date-day-on {
  background-color: var(--accent);
}

.date-day-press {
  transform: scale(0.9);
}

@keyframes date-mask-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes date-mask-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes date-sheet-in {
  from {
    transform: translate3d(0, 100%, 0);
  }

  to {
    transform: translate3d(0, 0, 0);
  }
}

@keyframes date-sheet-out {
  from {
    transform: translate3d(0, 0, 0);
  }

  to {
    transform: translate3d(0, 100%, 0);
  }
}

@keyframes date-body-in {
  from {
    opacity: 0;
    transform: translate3d(0, 20rpx, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes date-grid-next {
  from {
    opacity: 0;
    transform: translate3d(24rpx, 0, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes date-grid-prev {
  from {
    opacity: 0;
    transform: translate3d(-24rpx, 0, 0);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
</style>
