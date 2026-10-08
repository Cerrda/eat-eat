<script setup lang="ts">
import type { AccountView } from '@/api/eat'
import { acceptInvite, EatRequestError, previewInvite } from '@/api/eat'
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
const pending = ref(false)

const roleTitle = computed(() => preview.value?.role === 'cooker' ? '做饭的人' : '点餐的人')

onLoad((query) => {
  const incoming = normalizeCode(String(query?.code || query?.inviteCode || ''))
  if (incoming)
    code.value = incoming
})

watch(code, (value) => {
  if (value.length < 6) {
    looked.value = ''
    preview.value = null
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
      mode.value = 'confirm'
      return
    }
    routeAccount(view.next === 'invite' ? { ...view, next: 'waiting' } : view)
  }
  catch (err) {
    preview.value = null
    if (err instanceof EatRequestError && err.errCode === 'NEED_ABANDON') {
      mode.value = 'input'
      looked.value = ''
      const agreed = await ask('先放下空厨房', err.message, '放弃并加入')
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
    const view = await acceptInvite(code.value, { abandonPending: abandon })
    rememberAccount(view)
    routeAccount(view)
  }
  catch (err) {
    if (err instanceof EatRequestError && err.errCode === 'NEED_ABANDON') {
      const agreed = await ask('先放下空厨房', err.message, '放弃并加入')
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
    <view class="flex flex-col gap-32rpx">
      <text class="text-44rpx text-#3c2428 font-display italic">
        EatEat
      </text>
      <text v-if="mode === 'invalid' || mode === 'taken'" class="text-28rpx text-#792b3e font-body">
        另一方
      </text>
      <view class="flex flex-col items-start gap-8rpx">
        <text class="text-80rpx text-#3c2428 leading-[1.15] font-display">
          填上这 6 位
        </text>
        <image class="block w-170rpx" src="/static/underline.png" mode="widthFix" />
      </view>
      <code-cells v-model="code" :readonly="mode === 'confirm' || mode === 'taken'" />

      <view v-if="mode === 'confirm' && preview" class="flex flex-col gap-20rpx border-0 border-t-4rpx border-#c9a297 border-solid pt-32rpx">
        <text class="text-28rpx text-#792b3e font-body">
          你的身份
        </text>
        <text class="text-56rpx text-#3c2428 font-display">
          {{ roleTitle }}
        </text>
        <stamp-button :disabled="pending" :busy="pending" @tap="join(false)">
          {{ pending ? '正在确认身份' : '确定身份' }}
        </stamp-button>
        <view class="flex justify-center py-8rpx" @tap="reset">
          <text class="text-28rpx text-#7a534c font-body">
            不是这间厨房
          </text>
        </view>
      </view>

      <view v-else-if="mode === 'invalid'" class="flex flex-col gap-20rpx border-0 border-t-4rpx border-#c9a297 border-solid pt-32rpx">
        <text class="text-28rpx text-#9c342c font-body">
          没有加入
        </text>
        <text class="text-56rpx text-#3c2428 font-display">
          这个码用不了
        </text>
        <text class="text-30rpx text-#7a534c leading-[1.5] font-body">
          过期了，或写错了。请对方重新转发。
        </text>
        <stamp-button @tap="reset">
          再试一次
        </stamp-button>
      </view>

      <view v-else-if="mode === 'taken'" class="flex flex-col gap-20rpx border-0 border-t-4rpx border-#c9a297 border-solid pt-32rpx">
        <text class="text-28rpx text-#792b3e font-body">
          现在这间
        </text>
        <text class="text-56rpx text-#3c2428 font-display">
          你已经有厨房
        </text>
        <text class="text-30rpx text-#7a534c leading-[1.5] font-body">
          一个人只能待在一间厨房里。
        </text>
        <stamp-button @tap="backHome">
          回到我的厨房
        </stamp-button>
      </view>

      <ink-load v-else-if="mode === 'loading'" label="正在对这 6 位" />
    </view>
  </paper-page>
</template>
