<script setup lang="ts">
import { primeTopPadding } from '@/composables/useTopPadding'
import { bootFonts } from '@/utils/fonts'

onLaunch(() => {
  primeTopPadding()
  bootFonts()
})
</script>

<style>
@import "./styles/motion.css";

text.font-display,
textarea.font-display,
button.font-display {
  font-family: "Ma Shan Zheng", "PingFang SC", serif;
}

text.font-body,
textarea.font-body,
button.font-body {
  font-family: "LXGW WenKai", "PingFang SC", sans-serif;
}

text.font-mono,
textarea.font-mono {
  font-family: "Long Cang", "PingFang SC", serif;
}

.ph {
  color: #c9a297;
}

.ph-muted {
  color: #7a534c;
}

.ph-serif {
  color: #c9a297;
  font-family: "Ma Shan Zheng", "PingFang SC", serif;
}

.ph-sans {
  color: #7a534c;
  font-family: "LXGW WenKai", "PingFang SC", sans-serif;
}

page {
  width: 100%;
  background-color: #fbf3ea;
}
</style>
