import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import {
    TAB_PAGES,
    SUBSCRIBE_SCENES,
    NOTIFY_TEMPLATES,
    NOTIFY_TYPES,
    BG_PRESETS,
    BG_COLOR_MAP,
} from '../utils/constants'

const root = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const { VALID_NOTIFY_TYPES } = require('../cloud/functions/auth/invite.js')
// pages.json 允许注释，这里只是简单 JSON，直接解析
const pagesJson = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8'))

describe('常量与配置一致性', () => {
    it('TAB_PAGES 与 pages.json 的 tabBar 一致', () => {
        const tabs = pagesJson.tabBar.list.map(t => '/' + t.pagePath)
        expect(TAB_PAGES).toEqual(tabs)
    })

    it('每个订阅场景最多 3 个模板，且都已配置模板 ID', () => {
        for (const [scene, keys] of Object.entries(SUBSCRIBE_SCENES)) {
            expect(keys.length, scene).toBeLessThanOrEqual(3)
            keys.forEach(k => expect(NOTIFY_TEMPLATES[k], `${scene}.${k}`).toBeTruthy())
        }
    })

    it('设置页展示的通知类型都有模板 ID', () => {
        NOTIFY_TYPES.forEach(t => expect(NOTIFY_TEMPLATES[t.key], t.key).toBeTruthy())
    })

    it('auth 云函数允许的订阅类型与模板列表一致', () => {
        expect([...VALID_NOTIFY_TYPES].sort()).toEqual(Object.keys(NOTIFY_TEMPLATES).sort())
    })

    it('背景预设都有对应颜色', () => {
        BG_PRESETS.filter(p => p.value !== 'none').forEach(p => {
            expect(p.style).toBe(BG_COLOR_MAP[p.value])
        })
    })
})
