<script setup lang="ts">
import { normalizeCode } from '@/utils/format'

const props = withDefaults(defineProps<{
  modelValue?: string
  readonly?: boolean
  invalid?: boolean
}>(), {
  modelValue: '',
  readonly: false,
  invalid: false,
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const chars = computed(() => Array.from(props.modelValue || ''))
const shakeKey = ref(0)

watch(() => props.invalid, (on, was) => {
  if (on && !was)
    shakeKey.value += 1
})

function onInput(event: { detail: { value: string } }) {
  emit('update:modelValue', normalizeCode(event.detail.value))
}
</script>

<template>
  <view class="relative overflow-hidden">
    <view :key="shakeKey" class="flex gap-15rpx" :class="invalid ? 'eat-shake' : ''">
      <view
        v-for="index in 6"
        :key="index"
        class="box-border h-112rpx min-w-0 flex flex-1 items-center justify-center border-4rpx border-solid rounded-35rpx bg-#fff9f4"
        :class="invalid ? 'border-#9c342c' : 'border-#c9a297'"
      >
        <text class="text-42rpx text-#3c2428 leading-[1.15] font-mono">
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
@import "../../styles/motion.css";

/* 微信原生 textarea 不吃 opacity，文字会叠在格子上。颜色透明，并把光标和原文挪到可视区外。 */
.code-cells-input {
  position: absolute;
  top: 0;
  left: -100%;
  z-index: 1;
  width: 200%;
  height: 112rpx;
  color: rgba(0, 0, 0, 0);
  caret-color: transparent;
  background: transparent;
}
</style>
