/**
 * 经期统计 composable
 * 提取 period.vue 和 period-history.vue 共享的统计逻辑
 */
import { computed } from 'vue'

const DAY_MS = 86400000

/** 两个日期字符串相差的天数（a - b） */
const daysBetween = (a, b) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / DAY_MS)

/**
 * @param periodsRef 经期记录列表（按 startDate 降序排列）
 * @param settingsRef 周期设置（缺省字段时使用 28 / 5 天）
 */
export function usePeriodStats(periodsRef, settingsRef) {
    /** 计算相邻周期间的循环天数数组 */
    function getCycleLengths() {
        const r = []
        for (let i = 0; i < periodsRef.value.length - 1; i++) {
            const d = daysBetween(periodsRef.value[i].startDate, periodsRef.value[i + 1].startDate)
            if (d > 0 && d < 90) r.push(d)
        }
        return r
    }
    // 周期长度数组只计算一次，供下面多个统计复用
    const cycleLengths = computed(getCycleLengths)
    // 周期长度的标准差；少于 2 个周期时为 null
    const cycleSd = computed(() => {
        const l = cycleLengths.value
        if (l.length < 2) return null
        const mean = l.reduce((a, b) => a + b, 0) / l.length
        return Math.sqrt(l.reduce((s, v) => s + (v - mean) ** 2, 0) / l.length)
    })
    /** 平均周期长度 */
    const avgCycleLen = computed(() => {
        const l = cycleLengths.value
        return l.length ? l.reduce((a, b) => a + b, 0) / l.length : settingsRef.value.cycleLength || 28
    })
    /** 平均经期长度 */
    const avgPeriodLen = computed(() => {
        const l = periodsRef.value
            .filter(p => p.endDate)
            .map(p => daysBetween(p.endDate, p.startDate) + 1)
            .filter(n => n > 0 && n < 15)
        return l.length ? l.reduce((a, b) => a + b, 0) / l.length : settingsRef.value.periodLength || 5
    })
    /** 规律性标签 */
    const regLabel = computed(() => {
        const sd = cycleSd.value
        if (sd === null) return '--'
        if (sd <= 2) return '规律'
        if (sd <= 4) return '较规律'
        return '不规律'
    })
    /** 规律性样式类 */
    const regClass = computed(() => (regLabel.value === '规律' ? 'good' : regLabel.value === '较规律' ? 'warn' : 'bad'))
    /** 规律性得分 (0-100) */
    const regScore = computed(() => {
        const sd = cycleSd.value
        if (sd === null) return 0
        if (sd <= 2) return 95
        if (sd <= 4) return 65
        return 35
    })
    /** 周期范围 */
    const cycleRange = computed(() => {
        const l = cycleLengths.value
        if (l.length === 0) return { min: null, max: null }
        return { min: Math.min(...l), max: Math.max(...l) }
    })
    /** 获取单条记录的周期长度 */
    function getCycleLen(period, idx) {
        if (idx >= periodsRef.value.length - 1) return settingsRef.value.cycleLength || 28
        const d = daysBetween(period.startDate, periodsRef.value[idx + 1].startDate)
        return d > 0 && d < 90 ? d : settingsRef.value.cycleLength || 28
    }
    /** 获取单条记录的经期长度 */
    function getPeriodLen(period) {
        if (!period.endDate) return null
        const d = daysBetween(period.endDate, period.startDate) + 1
        return d > 0 ? d : null
    }
    return {
        getCycleLengths,
        avgCycleLen,
        avgPeriodLen,
        regLabel,
        regClass,
        regScore,
        cycleRange,
        getCycleLen,
        getPeriodLen,
    }
}
