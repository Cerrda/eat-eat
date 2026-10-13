import { presetUni } from '@uni-helper/unocss-preset-uni'
import {
  defineConfig,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  safelist: ['font-display', 'font-body', 'font-mono'],
  shortcuts: {
    'font-display': 'font-["Ma_Shan_Zheng","PingFang_SC",serif]',
    'font-body': 'font-["LXGW_WenKai","PingFang_SC",sans-serif]',
    'font-mono': 'font-["Long_Cang","PingFang_SC",serif]',
  },
  presets: [
    presetUni(),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        mingcute: () => import('@iconify-json/mingcute/icons.json').then(i => i.default),
      },
    }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
})
