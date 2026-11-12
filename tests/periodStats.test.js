import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { usePeriodStats } from '../utils/usePeriodStats'

// 记录按 startDate 降序
const mk = (...starts) => starts.map((s, i) => ({ startDate: s, endDate: null, _id: String(i) }))

describe('usePeriodStats', () => {
    it('没有记录时使用设置中的默认值', () => {
        const s = usePeriodStats(ref([]), ref({ cycleLength: 30, periodLength: 6 }))
        expect(s.avgCycleLen.value).toBe(30)
        expect(s.avgPeriodLen.value).toBe(6)
        expect(s.regLabel.value).toBe('--')
        expect(s.regScore.value).toBe(0)
        expect(s.cycleRange.value).toEqual({ min: null, max: null })
    })

    it('计算相邻周期长度、平均值与范围', () => {
        const periods = ref(mk('2026-03-29', '2026-03-01', '2026-02-01'))
        const s = usePeriodStats(periods, ref({ cycleLength: 28, periodLength: 5 }))
        expect(s.getCycleLengths()).toEqual([28, 28])
        expect(s.avgCycleLen.value).toBe(28)
        expect(s.cycleRange.value).toEqual({ min: 28, max: 28 })
        expect(s.regLabel.value).toBe('规律')
        expect(s.regClass.value).toBe('good')
        expect(s.regScore.value).toBe(95)
    })

    it('忽略异常的周期间隔（≥90 天）', () => {
        const s = usePeriodStats(ref(mk('2026-06-01', '2026-01-01')), ref({ cycleLength: 28 }))
        expect(s.getCycleLengths()).toEqual([])
        expect(s.avgCycleLen.value).toBe(28)
    })

    it('周期波动大时判定为不规律', () => {
        const s = usePeriodStats(ref(mk('2026-04-10', '2026-03-01', '2026-02-08', '2026-01-01')), ref({}))
        expect(s.getCycleLengths()).toEqual([40, 21, 38])
        expect(s.regLabel.value).toBe('不规律')
        expect(s.regClass.value).toBe('bad')
    })

    it('经期长度包含首尾两天，并过滤异常值', () => {
        const periods = ref([
            { startDate: '2026-03-01', endDate: '2026-03-05' },
            { startDate: '2026-02-01', endDate: '2026-02-03' },
            { startDate: '2026-01-01', endDate: '2026-01-30' }, // 30 天，异常值，被忽略
        ])
        const s = usePeriodStats(periods, ref({ periodLength: 5 }))
        expect(s.avgPeriodLen.value).toBe(4)
        expect(s.getPeriodLen(periods.value[0])).toBe(5)
        expect(s.getPeriodLen({ startDate: '2026-01-01' })).toBeNull()
    })

    it('最后一条记录的周期长度取设置值', () => {
        const periods = ref(mk('2026-03-01', '2026-02-01'))
        const s = usePeriodStats(periods, ref({ cycleLength: 31 }))
        expect(s.getCycleLen(periods.value[0], 0)).toBe(28)
        expect(s.getCycleLen(periods.value[1], 1)).toBe(31)
    })
})
