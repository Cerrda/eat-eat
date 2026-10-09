<script setup lang="ts">
import { longCang, lxgwWenKai, lxgwWenKaiMedium, maShanZheng } from '@/utils/font-sources'

function loadFace(family: string, payload: string, weight: '400' | '500' = '400') {
  uni.loadFontFace({
    global: true,
    family,
    source: `url("data:font/truetype;charset=utf-8;base64,${payload}")`,
    desc: { style: 'normal', weight },
    scopes: ['webview', 'native'],
    fail: (error) => {
      console.error(`[font] ${family} ${weight}`, error)
    },
  })
}

onLaunch(() => {
  loadFace('Ma Shan Zheng', maShanZheng)
  loadFace('LXGW WenKai', lxgwWenKai)
  loadFace('LXGW WenKai', lxgwWenKaiMedium, '500')
  loadFace('Long Cang', longCang)
})
</script>

<style>

text.font-display,
input.font-display,
textarea.font-display,
button.font-display {
  font-family: "Ma Shan Zheng", "PingFang SC", serif;
}

text.font-body,
input.font-body,
textarea.font-body,
button.font-body {
  font-family: "LXGW WenKai", "PingFang SC", sans-serif;
}

text.font-mono,
input.font-mono,
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
