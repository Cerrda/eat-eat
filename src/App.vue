<script setup lang="ts">
import { primeTopPadding } from '@/composables/useTopPadding'
import { loadAccount, markAppShow } from '@/utils/account'
import { applyChrome } from '@/utils/theme'

onLaunch(() => {
  primeTopPadding()
  applyChrome()
  // bootFonts()
})

onShow(() => {
  markAppShow()
  applyChrome()
  void loadAccount().catch(() => {})
})
</script>

<style>
@import "./styles/motion.css";
@import "./styles/scrollbar.css";

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
  color: var(--line);
}

.ph-muted {
  color: var(--muted);
}

.ph-serif {
  color: var(--line);
  font-family: "Ma Shan Zheng", "PingFang SC", serif;
}

.ph-sans {
  color: var(--muted);
  font-family: "LXGW WenKai", "PingFang SC", sans-serif;
}

.shadow-stamp {
  box-shadow: 6rpx 8rpx 0 var(--stamp-shadow);
}

page {
  width: 100%;
  --paper: #FBF3EA;
  --cream: #FFF9F4;
  --ink: #3C2428;
  --muted: #7A534C;
  --line: #C9A297;
  --rule: #C9A297;
  --accent: #792B3E;
  --accent-deep: #4E222D;
  --accent-busy: #A24C5C;
  --wash: #F6E4DE;
  --danger: #9C342C;
  --booked: #9C342C;
  --on-accent: #FFF9F4;
  --photo: #FFF9F4;
  --scrim: rgba(60, 36, 40, 0.45);
  --shade-28: rgba(78, 34, 45, 0.28);
  --shade-35: rgba(78, 34, 45, 0.35);
  --stamp-shadow: #4E222D59;
  background-color: var(--paper);
}

.theme-dark {
  --paper: #1A211C;
  --cream: #262E29;
  --ink: #F3E6D4;
  --muted: #B5A394;
  --line: #5C5348;
  --rule: #7A6C5C;
  --accent: #C6A36A;
  --accent-deep: #8A6E3E;
  --accent-busy: #8A7048;
  --wash: #314038;
  --danger: #E07A6A;
  --booked: #C6A36A;
  --on-accent: #1A211C;
  --photo: #3A4640;
  --scrim: rgba(0, 0, 0, 0.45);
  --shade-28: rgba(0, 0, 0, 0.28);
  --shade-35: rgba(0, 0, 0, 0.35);
  --stamp-shadow: #00000059;
}
</style>
