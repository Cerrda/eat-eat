import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    environment: 'uniapp',
    environmentOptions: {
      uniapp: {
        platform: 'mp-weixin',
        projectPath: './src',
        port: 5121,
      },
    },
  },
})
