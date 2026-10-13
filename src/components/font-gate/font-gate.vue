<script setup lang="ts">
import { ensurePageFonts, waitFontLayout } from '@/utils/fonts'

const props = withDefaults(defineProps<{
  hold?: boolean
  label?: string
}>(), {
  hold: false,
  label: '',
})

const fontsReady = ref(false)
const painted = ref(false)
let alive = true

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function paint() {
  if (!alive || painted.value || props.hold || !fontsReady.value)
    return
  await nextTick()
  await delay(48)
  if (!alive || props.hold || !fontsReady.value)
    return
  painted.value = true
}

onMounted(async () => {
  try {
    await ensurePageFonts()
    await waitFontLayout()
  }
  catch (error) {
    console.error('[font] page', error)
  }
  if (!alive)
    return
  fontsReady.value = true
  await paint()
})

watch(() => props.hold, () => {
  void paint()
})

onBeforeUnmount(() => {
  alive = false
})
</script>

<template>
  <view class="relative min-h-screen w-full">
    <view
      class="w-full"
      :class="painted ? '' : 'pointer-events-none absolute left-0 right-0 top-0 opacity-0'"
    >
      <slot />
    </view>
    <ink-load v-if="!painted" :label="label || undefined" />
  </view>
</template>
