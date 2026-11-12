import { defineConfig } from 'vitest/config'

// 单元测试使用独立配置，不加载 uni-app 的 Vite 插件
export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        environment: 'node',
    },
})
