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
  <view class="relative h-104rpx overflow-hidden">
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
    <textarea
      v-if="!readonly"
      class="code-cells-input"
      :value="modelValue"
      :maxlength="6"
      disable-default-padding
      confirm-type="done"
      :show-confirm-bar="false"
      @input="onInput"
    />
  </view>
</template>

<style>
@import "../../styles/font-util.css";

/* 微信原生 textarea 不吃 opacity，文字会叠在格子上。颜色透明，并把光标和原文挪到可视区外。 */
.code-cells-input {
  position: absolute;
  top: 0;
  left: -100%;
  z-index: 1;
  width: 200%;
  height: 100%;
  color: rgba(0, 0, 0, 0);
  caret-color: transparent;
  background: transparent;
}
</style>
