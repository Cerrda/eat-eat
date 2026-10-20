import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'

export default defineUniPages({
  // 首页就绪后在后台预下载后续可能进入的子包。
  preloadRule: {
    'pages/index': {
      network: 'all',
      packages: ['pages/bind'],
    },
    'pages/home/index': {
      network: 'all',
      packages: ['pages/cook', 'pages/eat'],
    },
  },
  globalStyle: {
    backgroundColor: '@bgColor',
    backgroundColorBottom: '@bgColorBottom',
    backgroundColorTop: '@bgColorTop',
    backgroundTextStyle: '@bgTxtStyle',
    navigationBarBackgroundColor: '#000000',
    navigationBarTextStyle: '@navTxtStyle',
    navigationBarTitleText: 'EatEat',
    navigationStyle: 'custom',
  },
  // tabBar: {
  //   backgroundColor: "@tabBgColor",
  //   borderStyle: "@tabBorderStyle",
  //   color: "@tabFontColor",
  //   selectedColor: "@tabSelectedColor",
  // },
})
