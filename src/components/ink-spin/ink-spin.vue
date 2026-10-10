<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'paper' | 'wine' | 'muted'
  large?: boolean
}>(), {
  tone: 'wine',
  large: false,
})
</script>

<template>
  <view
    class="eat-notch box-border rounded-full border-solid"
    :class="[
      large ? 'eat-notch-lg' : 'eat-notch-sm',
      tone === 'paper' ? 'eat-notch-paper' : tone === 'muted' ? 'eat-notch-muted' : 'eat-notch-wine',
    ]"
  />
</template>

<style>
.eat-notch {
  border-left-color: transparent;
  animation: eat-notch 1.1s linear infinite;
}

.eat-notch-sm {
  width: 32rpx;
  height: 32rpx;
  border-width: 4rpx;
}

.eat-notch-lg {
  width: 72rpx;
  height: 72rpx;
  border-width: 6rpx;
}

.eat-notch-paper {
  border-top-color: #fbf3ea;
  border-right-color: #fbf3ea;
  border-bottom-color: #fbf3ea;
}

.eat-notch-wine {
  border-top-color: #792b3e;
  border-right-color: #792b3e;
  border-bottom-color: #792b3e;
}

.eat-notch-muted {
  border-top-color: #7a534c;
  border-right-color: #7a534c;
  border-bottom-color: #7a534c;
}

@keyframes eat-notch {
  to {
    transform: rotate(360deg);
  }
}
</style>
