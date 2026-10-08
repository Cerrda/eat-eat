<script setup lang="ts">
import { normalizeCode } from '@/utils/format'

const props = withDefaults(defineProps<{
  modelValue?: string
  readonly?: boolean
}>(), {
  modelValue: '',
  readonly: false,
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const chars = computed(() => Array.from(props.modelValue || ''))

function onInput(event: { detail: { value: string } }) {
  emit('update:modelValue', normalizeCode(event.detail.value))
}
</script>

<template>
  <view class="relative h-104rpx">
    <view class="flex justify-between">
      <view
        v-for="index in 6"
        :key="index"
        class="h-104rpx w-88rpx flex items-center justify-center rounded-28rpx bg-#fff9f4"
      >
        <text class="text-44rpx text-#3c2428 font-display">
          {{ chars[index - 1] || '' }}
        </text>
      </view>
    </view>
    <input
      v-if="!readonly"
      class="absolute left-0 top-0 z-1 h-full w-full opacity-0"
      :value="modelValue"
      :maxlength="6"
      @input="onInput"
    >
  </view>
</template>
