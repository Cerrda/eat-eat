import { presetUni } from '@uni-helper/unocss-preset-uni'
import {
  defineConfig,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

const tones = [
  'accent-deep',
  'accent-busy',
  'on-accent',
  'shade-28',
  'shade-35',
  'paper',
  'cream',
  'ink',
  'muted',
  'line',
  'rule',
  'accent',
  'wash',
  'danger',
  'booked',
  'photo',
  'scrim',
].join('|')

// 语义色在小程序里走 CSS 变量，预设调色板不会生成 text-ink 这类类。
function toneRule(prefix: string, property: string) {
  return [
    new RegExp(`^${prefix}-(${tones})$`),
    ([, name]: string[]) => ({ [property]: `var(--${name})` }),
  ] as const
}

export default defineConfig({
  rules: [
    toneRule('text', 'color'),
    toneRule('bg', 'background-color'),
    toneRule('border', 'border-color'),
  ],
  safelist: ['font-display', 'font-body', 'font-mono'],
  theme: {
    colors: {
      'paper': 'var(--paper)',
      'cream': 'var(--cream)',
      'ink': 'var(--ink)',
      'muted': 'var(--muted)',
      'line': 'var(--line)',
      'rule': 'var(--rule)',
      'accent': 'var(--accent)',
      'accent-deep': 'var(--accent-deep)',
      'accent-busy': 'var(--accent-busy)',
      'wash': 'var(--wash)',
      'danger': 'var(--danger)',
      'booked': 'var(--booked)',
      'on-accent': 'var(--on-accent)',
      'photo': 'var(--photo)',
      'scrim': 'var(--scrim)',
      'shade-28': 'var(--shade-28)',
      'shade-35': 'var(--shade-35)',
    },
  },
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
