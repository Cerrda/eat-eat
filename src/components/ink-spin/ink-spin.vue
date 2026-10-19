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
  border-top-color: var(--paper);
  border-right-color: var(--paper);
  border-bottom-color: var(--paper);
}

.eat-notch-wine {
  border-top-color: var(--accent);
  border-right-color: var(--accent);
  border-bottom-color: var(--accent);
}

.eat-notch-muted {
  border-top-color: var(--muted);
  border-right-color: var(--muted);
  border-bottom-color: var(--muted);
}

@keyframes eat-notch {
  to {
    transform: rotate(360deg);
  }
}
</style>
