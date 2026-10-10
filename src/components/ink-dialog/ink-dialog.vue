<script setup lang="ts">
import { currentPage, pageRoute } from '@/utils/hint'
import { beginClose, dismissDialog, settleDialog, useDialog } from '@/utils/ui'

const {
  dialogOpen,
  dialogSeq,
  dialogRoute,
  dialogTitle,
  dialogContent,
  dialogConfirmText,
  dialogCancelText,
  dialogShowCancel,
  dialogEditable,
  dialogPlaceholder,
  dialogDraft,
} = useDialog()

const ownerRoute = ref(pageRoute(currentPage()))
const visible = ref(false)
const shown = ref(false)
const fieldLive = ref(false)
const keyboard = ref(0)
let leaveTimer: ReturnType<typeof setTimeout> | undefined
let enterTimer: ReturnType<typeof setTimeout> | undefined

const active = computed(() => dialogOpen.value && dialogRoute.value !== '' && dialogRoute.value === ownerRoute.value)

const liftStyle = computed(() => {
  if (!dialogEditable.value || keyboard.value <= 0)
    return {}
  return { paddingBottom: `${keyboard.value}px` }
})

function syncOwner() {
  ownerRoute.value = pageRoute(currentPage())
}

function freeze() {}

function onKeyboard(res: { height: number }) {
  keyboard.value = res.height
}

function confirm() {
  beginClose(true)
}

function cancel() {
  beginClose(false)
}

onMounted(syncOwner)

onShow(syncOwner)

onUnload(() => {
  if (dialogRoute.value === ownerRoute.value)
    dismissDialog()
})

onUnmounted(() => {
  if (leaveTimer)
    clearTimeout(leaveTimer)
  if (enterTimer)
    clearTimeout(enterTimer)
  uni.offKeyboardHeightChange(onKeyboard)
})

watch(visible, (on) => {
  if (!dialogEditable.value)
    return
  if (on)
    uni.onKeyboardHeightChange(onKeyboard)
  else {
    keyboard.value = 0
    uni.offKeyboardHeightChange(onKeyboard)
  }
})

watch(dialogSeq, () => {
  if (!active.value)
    return
  if (enterTimer)
    clearTimeout(enterTimer)
  fieldLive.value = false
  visible.value = true
  shown.value = true
  if (!dialogEditable.value)
    return
  enterTimer = setTimeout(() => {
    fieldLive.value = true
  }, 320)
})

watch(active, (on) => {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = undefined
  }
  if (enterTimer) {
    clearTimeout(enterTimer)
    enterTimer = undefined
  }
  fieldLive.value = false
  if (on) {
    visible.value = true
    shown.value = true
    if (dialogEditable.value) {
      enterTimer = setTimeout(() => {
        fieldLive.value = true
      }, 320)
    }
    return
  }
  if (!visible.value)
    return
  shown.value = false
  leaveTimer = setTimeout(() => {
    visible.value = false
    if (dialogRoute.value === ownerRoute.value)
      settleDialog()
  }, 240)
}, { immediate: true })
</script>

<template>
  <view
    v-if="visible"
    :key="dialogSeq"
    class="fixed bottom-0 left-0 right-0 top-0 z-40 box-border flex items-center justify-center px-56rpx"
    :style="liftStyle"
    @touchmove.stop.prevent="freeze"
  >
    <view
      class="absolute bottom-0 left-0 right-0 top-0 bg-#3c2428/45"
      :class="shown ? 'ink-dialog-mask-in' : 'ink-dialog-mask-out'"
    />
    <view
      class="relative z-1 w-full border-4rpx border-#792b3e rounded-44rpx border-solid bg-#fff9f4 px-44rpx py-44rpx"
      :class="shown ? 'ink-dialog-in' : 'ink-dialog-out'"
      :style="{ boxShadow: '8rpx 10rpx 0 rgba(78, 34, 45, 0.35)' }"
      @tap.stop="freeze"
    >
      <view class="flex flex-col gap-32rpx">
        <text class="block text-64rpx text-#3c2428 leading-[1.15] font-display">
          {{ dialogTitle }}
        </text>
        <text v-if="dialogContent" class="block text-30rpx text-#7a534c leading-[1.6] font-body">
          {{ dialogContent }}
        </text>
        <view v-if="dialogEditable" class="flex flex-col gap-16rpx">
          <view class="border-4rpx border-#c9a297 rounded-28rpx border-solid bg-#fbf3ea px-28rpx py-24rpx">
            <textarea
              v-if="fieldLive"
              v-model="dialogDraft"
              class="h-52rpx w-full text-36rpx text-#3c2428 leading-52rpx font-body"
              disable-default-padding
              :focus="fieldLive"
              :placeholder="dialogPlaceholder"
              placeholder-class="ph-sans"
              placeholder-style="font-size: 36rpx; line-height: 52rpx;"
              confirm-type="done"
              :show-confirm-bar="false"
              :adjust-position="false"
              :cursor-spacing="24"
              @confirm="confirm"
            />
            <text
              v-else
              class="block h-52rpx text-36rpx leading-52rpx font-body"
              :class="dialogDraft ? 'text-#3c2428' : 'text-#c9a297'"
            >
              {{ dialogDraft || dialogPlaceholder }}
            </text>
          </view>
          <text v-if="dialogPlaceholder" class="block text-right text-26rpx text-#7a534c font-body">
            {{ dialogPlaceholder }}
          </text>
        </view>
        <view v-if="dialogShowCancel" class="flex items-stretch gap-16rpx">
          <view
            class="box-border flex flex-1 items-center justify-center border-3rpx border-#c9a297 rounded-36rpx border-solid px-32rpx py-24rpx"
            hover-class="ink-dialog-press"
            :hover-stay-time="80"
            @tap.stop="cancel"
          >
            <text class="text-30rpx text-#3c2428 font-medium font-body">
              {{ dialogCancelText }}
            </text>
          </view>
          <view
            class="flex flex-1 items-center justify-center rounded-36rpx bg-#792b3e px-32rpx py-24rpx"
            hover-class="ink-dialog-press"
            :hover-stay-time="80"
            @tap.stop="confirm"
          >
            <text class="text-30rpx text-#fbf3ea font-medium font-body">
              {{ dialogConfirmText }}
            </text>
          </view>
        </view>
        <view
          v-else
          class="flex items-center justify-center rounded-36rpx bg-#792b3e px-32rpx py-24rpx"
          hover-class="ink-dialog-press"
          :hover-stay-time="80"
          @tap.stop="confirm"
        >
          <text class="text-30rpx text-#fbf3ea font-medium font-body">
            {{ dialogConfirmText }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.ink-dialog-press {
  opacity: 0.86;
}

.ink-dialog-mask-in {
  animation: ink-dialog-mask-in 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.ink-dialog-mask-out {
  animation: ink-dialog-mask-out 0.24s cubic-bezier(0.4, 0, 1, 1) forwards;
}

.ink-dialog-in {
  animation: ink-dialog-in 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.ink-dialog-out {
  animation: ink-dialog-out 0.24s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes ink-dialog-mask-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes ink-dialog-mask-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes ink-dialog-in {
  from {
    transform: translate3d(0, 16rpx, 0) scale(0.96);
  }

  to {
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes ink-dialog-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
    transform: translate3d(0, -12rpx, 0);
  }
}
</style>
