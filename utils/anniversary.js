/**
 * 纪念日 / 倒数日的日期计算
 * 记录字段：title、date（YYYY-MM-DD）、type（since 纪念日 / countdown 倒数日 / yearly 每年重复，如生日）、emoji、color
 */
import { dateToStr } from './usePeriodData'

const DAY_MS = 86400000

/** 本地时区的「今天 0 点」 */
const startOfToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

/** 把 YYYY-MM-DD 解析为本地时区 0 点（避免 new Date('YYYY-MM-DD') 按 UTC 解析导致差一天） */
export function parseDate(str) {
    const [y, m, d] = String(str).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
}

/** 两个日期相差的天数（b - a） */
export const diffDays = (a, b) => Math.round((b.getTime() - a.getTime()) / DAY_MS)

/** 每年重复的日期：返回今天或之后最近的一次，以及是第几次（周年 / 岁） */
export function nextYearly(dateStr, today = startOfToday()) {
    const base = parseDate(dateStr)
    let next = new Date(today.getFullYear(), base.getMonth(), base.getDate())
    if (next < today) next = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate())
    return { date: next, count: next.getFullYear() - base.getFullYear() }
}

/** 下一个整百天的里程碑（例如在一起第 1100 天） */
export function nextMilestone(daysSince) {
    const step = daysSince < 10000 ? 100 : 1000
    const target = (Math.floor(daysSince / step) + 1) * step
    return { target, remain: target - daysSince }
}

export const ANNIVERSARY_TYPES = [
    { value: 'since', label: '纪念日', hint: '记录已经过去多少天' },
    { value: 'countdown', label: '倒数日', hint: '距离那一天还有多少天' },
    { value: 'yearly', label: '每年', hint: '生日、周年等每年重复的日子' },
]

/**
 * 计算展示用信息
 * @returns {{ num: number, prefix: string, sub: string, sortKey: number, isToday: boolean, targetDate: string }}
 *   sortKey 越小越靠前：即将到来的按剩余天数排，纪念日排在后面
 */
export function describeAnniversary(item, today = startOfToday()) {
    if (!item || !item.date) return { num: 0, prefix: '', sub: '', sortKey: Infinity, isToday: false, targetDate: '' }
    const date = parseDate(item.date)
    if (item.type === 'yearly') {
        const { date: next, count } = nextYearly(item.date, today)
        const remain = diffDays(today, next)
        return {
            num: remain,
            prefix: remain === 0 ? '就是今天' : '还有',
            sub: `${dateToStr(next)} · 第 ${count} 次`,
            sortKey: remain,
            isToday: remain === 0,
            targetDate: dateToStr(next),
        }
    }
    // 纪念日的日期还没到时，按倒数日展示
    if (item.type === 'countdown' || (item.type !== 'yearly' && date > today)) {
        const remain = diffDays(today, date)
        if (remain >= 0) {
            return {
                num: remain,
                prefix: remain === 0 ? '就是今天' : '还有',
                sub: item.date,
                sortKey: remain,
                isToday: remain === 0,
                targetDate: item.date,
            }
        }
        return { num: -remain, prefix: '已经过去', sub: item.date, sortKey: 100000 - remain, isToday: false, targetDate: item.date }
    }
    // since：纪念日，起始当天算第 1 天
    const passed = diffDays(date, today) + 1
    const { target, remain } = nextMilestone(passed)
    return {
        num: passed,
        prefix: '已经',
        sub: `${item.date} 起 · 距第 ${target} 天还有 ${remain} 天`,
        sortKey: 50000 + remain,
        isToday: false,
        targetDate: item.date,
    }
}
