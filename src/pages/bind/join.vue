<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { acceptInvite, EatRequestError, previewInvite } from '@/api/eat'
import { useCapsuleClearance } from '@/composables/useTopPadding'
import { loadAccount, rememberAccount, routeAccount } from '@/utils/account'
import { normalizeCode } from '@/utils/format'
import { ask, showError } from '@/utils/ui'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FBF3EA',
  },
})

const code = ref('')
const looked = ref('')
const mode = ref<'input' | 'confirm' | 'invalid' | 'taken' | 'loading'>('input')
const preview = ref<AccountView | null>(null)
const needsAbandon = ref(false)
const pending = ref(false)
const clearance = useCapsuleClearance()

const roleTitle = computed(() => preview.value?.role === 'cooker' ? '做饭的人' : '点餐的人')
const showResult = computed(() => mode.value === 'invalid' || mode.value === 'taken' || (mode.value === 'confirm' && !!preview.value))
const eyebrow = computed(() => {
  if (mode.value === 'invalid')
    return '没有加入'
  if (mode.value === 'taken')
    return '现在这间'
  return '你的身份'
})
const roleHeading = computed(() => {
  if (mode.value === 'invalid')
    return '这个码用不了'
  if (mode.value === 'taken')
    return '你已经有厨房'
  return roleTitle.value
})
const detail = computed(() => {
  if (mode.value === 'invalid')
    return '过期了，或写错了。请对方重新转发。'
  if (mode.value === 'taken')
    return '一个人只能待在一间厨房里。'
  return ''
})

onLoad((query) => {
  const incoming = normalizeCode(String(query?.code || query?.inviteCode || ''))
  if (incoming)
    code.value = incoming
})

watch(code, (value) => {
  if (value.length < 6) {
    looked.value = ''
    preview.value = null
    needsAbandon.value = false
    if (mode.value !== 'taken')
      mode.value = 'input'
    return
  }
  void look(value)
})

async function look(value: string) {
  if (looked.value === value || pending.value)
    return
  looked.value = value
  mode.value = 'loading'
  try {
    const view = await previewInvite(value)
    rememberAccount(view)
    if (view.next === 'confirm') {
      preview.value = view
      needsAbandon.value = view.needsAbandon === true
      mode.value = 'confirm'
      return
    }
    needsAbandon.value = false
    routeAccount(view.next === 'invite' ? { ...view, next: 'waiting' } : view)
  }
  catch (err) {
    preview.value = null
    needsAbandon.value = false
    if (err instanceof EatRequestError && err.errCode === 'NEED_ABANDON') {
      mode.value = 'input'
      looked.value = ''
      const agreed = await ask('先放下空厨房', err.message, '放弃加入')
      if (agreed)
        await join(true)
      return
    }
    mode.value = err instanceof EatRequestError && err.errCode === 'ALREADY_BOUND' ? 'taken' : 'invalid'
  }
}

async function join(abandon = false) {
  if (pending.value)
    return
  pending.value = true
  try {
    if (!abandon && needsAbandon.value) {
      const agreed = await ask('先放下空厨房', '接受后，这间空厨房会被放弃。', '放弃加入')
      if (!agreed)
        return
      abandon = true
    }
    const view = await acceptInvite(code.value, { abandonPending: abandon })
    rememberAccount(view)
    await routeAccount(view)
  }
  catch (err) {
    if (err instanceof EatRequestError && err.errCode === 'NEED_ABANDON') {
      const agreed = await ask('先放下空厨房', err.message, '放弃加入')
      if (agreed) {
        pending.value = false
        await join(true)
      }
      return
    }
    if (err instanceof EatRequestError && err.errCode === 'ALREADY_BOUND') {
      mode.value = 'taken'
      return
    }
    mode.value = 'invalid'
    showError(err)
  }
  finally {
    pending.value = false
  }
}

function reset() {
  code.value = ''
  looked.value = ''
  preview.value = null
  needsAbandon.value = false
  mode.value = 'input'
}

async function backHome() {
  try {
    const view = await loadAccount(true)
    routeAccount(view)
  }
  catch (err) {
    showError(err)
  }
}
</script>

<template>
  <paper-page>
    <view class="flex flex-col gap-31rpx" :style="{ paddingTop: `calc(${clearance} + 13rpx)` }">
      <text class="text-42rpx text-#3c2428 font-normal leading-[1.15] font-display italic">
        EatEat
      </text>
      <text class="text-38rpx text-#3c2428 font-normal leading-[1.45] font-body">
        填写邀请码
      </text>
      <code-cells v-model="code" :readonly="mode === 'confirm' || mode === 'taken'" :invalid="mode === 'invalid'" />

      <view v-if="showResult" class="flex flex-col gap-31rpx">
        <view class="box-border flex flex-col gap-12rpx border-0 border-b-4rpx border-t-4rpx border-#c9a297 border-solid py-31rpx">
          <text
            class="text-27rpx leading-[1.15] tracking-[2rpx] font-mono"
            :class="mode === 'invalid' ? 'text-#9c342c' : 'text-#792b3e'"
          >
            {{ eyebrow }}
          </text>
          <text class="text-54rpx text-#3c2428 font-normal leading-[1.15] font-display">
            {{ roleHeading }}
          </text>
          <text v-if="detail" class="text-29rpx text-#7a534c leading-[1.5] font-body">
            {{ detail }}
          </text>
        </view>
        <stamp-button v-if="mode === 'confirm'" flat strong :disabled="pending" :busy="pending" @button-tap="join(false)">
          {{ pending ? '正在确认身份' : '确定身份' }}
        </stamp-button>
        <stamp-button v-else-if="mode === 'invalid'" flat strong @button-tap="reset">
          再试一次
        </stamp-button>
        <stamp-button v-else flat strong @button-tap="backHome">
          回到我的厨房
        </stamp-button>
        <view v-if="mode === 'confirm'" @tap="reset">
          <text class="text-27rpx text-#7a534c leading-[1.45] font-body">
            不是这间厨房
          </text>
        </view>
      </view>

      <ink-load v-else-if="mode === 'loading'" label="正在对这 6 位" />
    </view>
  </paper-page>
</template>
