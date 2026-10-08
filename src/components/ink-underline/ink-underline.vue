<script setup lang="ts">
const props = defineProps<{
  width: number
}>()

// underline.png 为 349×59。高度随宽度写死，图片解码前就不会被默认高度撑开。
const height = computed(() => (props.width * 59) / 349)
</script>

<template>
  <image
    class="block"
    :style="{ width: `${width}rpx`, height: `${height}rpx` }"
    src="/static/underline.png"
    mode="scaleToFill"
  />
</template>
