import { describe, it, expect } from 'vitest'
import { pad, dateToStr, addDays, displayDate, validatePeriodRange } from '../utils/usePeriodData'

describe('经期日期工具', () => {
    it('pad / dateToStr', () => {
        expect(pad(3)).toBe('03')
        expect(pad(12)).toBe('12')
        expect(dateToStr(new Date(2026, 0, 5))).toBe('2026-01-05')
    })

    it('addDays 跨月、跨年', () => {
        expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    })

    it('displayDate', () => {
        expect(displayDate('2026-03-08')).toBe('3月8日')
        expect(displayDate('')).toBe('')
    })

    it('validatePeriodRange：结束日期不能早于开始日期', () => {
        expect(validatePeriodRange('', '')).toBe('请选择开始日期')
        expect(validatePeriodRange('2026-03-05', '2026-03-01')).toBe('结束日期不能早于开始日期')
        expect(validatePeriodRange('2026-03-01', '2026-03-01')).toBe('')
        expect(validatePeriodRange('2026-03-01', '')).toBe('')
    })
})
