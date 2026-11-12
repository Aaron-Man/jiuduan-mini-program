import { describe, it, expect } from 'vitest'
import { sortByManualOrder } from '../utils/useDragSort'

const t = d => new Date(d).toISOString()

describe('sortByManualOrder', () => {
    it('从未拖拽过的列表保持最新在前', () => {
        const list = [
            { _id: 'a', createTime: t('2026-01-01') },
            { _id: 'c', createTime: t('2026-03-01') },
            { _id: 'b', createTime: t('2026-02-01') },
        ]
        expect(sortByManualOrder(list).map(x => x._id)).toEqual(['c', 'b', 'a'])
    })

    it('拖拽过的按 manual_order 排序，新建的记录排在最前', () => {
        const list = [
            { _id: 'x', manual_order: 1, createTime: t('2026-01-03') },
            { _id: 'y', manual_order: 0, createTime: t('2026-01-01') },
            { _id: 'new', createTime: t('2026-02-01') },
            { _id: 'z', manual_order: 2, createTime: t('2026-01-02') },
        ]
        expect(sortByManualOrder(list).map(x => x._id)).toEqual(['new', 'y', 'x', 'z'])
    })

    it('支持自定义排序字段', () => {
        const list = [
            { _id: 'a', sort_order: 2 },
            { _id: 'b', sort_order: 1 },
        ]
        expect(sortByManualOrder(list, 'sort_order').map(x => x._id)).toEqual(['b', 'a'])
    })
})
