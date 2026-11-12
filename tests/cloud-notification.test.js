import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { normalizePage, buildMsgData } = require('../cloud/functions/notification/messages.js')

describe('notification 云函数：消息内容', () => {
    it('跳转页面只允许 pages/ 路径', () => {
        expect(normalizePage('/pages/memo/memo')).toBe('pages/memo/memo')
        expect(normalizePage('pages/orders/orders?id=1')).toBe('pages/orders/orders?id=1')
        expect(normalizePage('https://evil.example.com')).toBe('')
        expect(normalizePage('../../etc')).toBe('')
        expect(normalizePage(undefined)).toBe('')
    })

    it('订单通知：状态转中文，字段截断到 20 字', () => {
        const d = buildMsgData('order_update', { dishName: '一'.repeat(30), status: 'cooking' })
        expect(d.thing1.value).toHaveLength(20)
        expect(d.thing2.value).toBe('烹饪中')
        expect(d.thing3.value).toBe('无')
    })

    it('未知类型使用通用格式', () => {
        const d = buildMsgData('other', { title: 't', content: 'c' })
        expect(d).toEqual({ thing1: { value: 't' }, thing2: { value: 'c' }, thing3: { value: '' } })
    })
})
