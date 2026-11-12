import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import prettierConfig from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default [
    {
        ignores: ['node_modules/**', 'unpackage/**', 'dist/**', '**/node_modules/**'],
    },
    js.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    // 关闭与 Prettier 冲突的格式类规则，格式统一交给 Prettier
    prettierConfig,
    {
        files: ['**/*.{js,mjs,ts,vue}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                // 小程序 / uni-app 全局对象
                uni: 'readonly',
                wx: 'readonly',
                getCurrentPages: 'readonly',
                getApp: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            // 页面文件名（如 home.vue）是 uni-app 约定，不要求多单词
            'vue/multi-word-component-names': 'off',
        },
    },
    // TypeScript 模块（utils/*.ts）
    ...tseslint.configs.recommended.map(c => ({ ...c, files: ['**/*.ts'] })),
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: { uni: 'readonly', wx: 'readonly', getCurrentPages: 'readonly', getApp: 'readonly' },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
        },
    },
    {
        // 云函数运行在 Node.js（CommonJS）
        files: ['cloud/functions/**/*.js'],
        languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    },
    {
        files: ['tests/**', '*.config.{js,mjs}', 'vite.config.js'],
        languageOptions: { globals: { ...globals.node } },
    },
]
