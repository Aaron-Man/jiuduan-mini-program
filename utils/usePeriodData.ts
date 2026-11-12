/**
 * 经期数据 composable：记录列表与周期设置的加载、缓存、保存
 * 使用页面：period / period-history
 */
import { ref } from 'vue'
import { fetchAllRecords, getProfile, saveProfile, getPCache, setPCache } from './cloud'
import { handleLoadError } from './contentActions'
import type { PeriodRecord, PeriodSettings } from './types'

const SETTINGS_STORAGE_KEY = 'period_settings'
export const DEFAULT_PERIOD_SETTINGS: PeriodSettings = { cycleLength: 28, periodLength: 5, remindDays: 3 }

// ===== 日期工具（YYYY-MM-DD 字符串）=====
export const pad = (n: number): string => (n < 10 ? '0' + n : '' + n)
export const dateToStr = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays = (str: string, n: number): string => {
    const d = new Date(str)
    d.setDate(d.getDate() + n)
    return dateToStr(d)
}
export const displayDate = (str: string | null | undefined): string => {
    if (!str) return ''
    const d = new Date(str)
    return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 校验经期表单：结束日期不能早于开始日期；返回错误提示，通过时返回空字符串 */
export function validatePeriodRange(startDate: string, endDate?: string | null): string {
    if (!startDate) return '请选择开始日期'
    if (endDate && endDate < startDate) return '结束日期不能早于开始日期'
    return ''
}

export function usePeriodData() {
    const periods = ref<PeriodRecord[]>([])
    const loading = ref(true)
    const settings = ref<PeriodSettings>({ ...DEFAULT_PERIOD_SETTINGS })

    /** 先从缓存快速恢复（瞬间渲染），再由 fetchData / loadSettings 拉取最新值覆盖 */
    function restoreFromCache() {
        const cached = getPCache('periods')
        if (cached) {
            periods.value = cached
            loading.value = false
        }
        try {
            const s = uni.getStorageSync(SETTINGS_STORAGE_KEY)
            if (s) settings.value = { ...settings.value, ...s }
        } catch (e) {
            /* 忽略 */
        }
    }

    async function fetchData() {
        try {
            const data = (await fetchAllRecords('periods', {
                orderBy: 'startDate',
                orderType: 'desc',
            })) as PeriodRecord[]
            periods.value = data
            setPCache('periods', data)
        } catch (e) {
            handleLoadError(e, periods.value.length > 0)
        } finally {
            loading.value = false
        }
    }

    /** 从 profiles 加载周期设置（经云函数） */
    async function loadSettings() {
        try {
            const p = await getProfile()
            if (p?.period_settings) {
                settings.value = { ...settings.value, ...p.period_settings }
                uni.setStorageSync(SETTINGS_STORAGE_KEY, settings.value)
            }
        } catch (e) {
            console.warn('[经期] 加载设置失败:', e)
        }
    }

    /** 保存周期设置：本地 Storage（快速读取）+ profiles（权威数据源） */
    async function saveSettings() {
        uni.setStorageSync(SETTINGS_STORAGE_KEY, settings.value)
        try {
            await saveProfile({ period_settings: settings.value })
        } catch (e) {
            console.warn('[经期] 保存设置失败:', e)
        }
    }

    return { periods, loading, settings, restoreFromCache, fetchData, loadSettings, saveSettings }
}
