<template>
    <page-bg tone="rose" />
    <scroll-view
        scroll-y
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage }"
        refresher-enabled
        refresher-default-style="black"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <!-- ===== 杂志式标题区 ===== -->
        <view class="mast ui-fade-up">
            <text class="ui-eyebrow">CYCLE</text>
            <text class="ui-title mast-title">经期管理</text>
            <text class="ui-sub mast-sub">周期 {{ settings.cycleLength }} 天 · 经期 {{ settings.periodLength }} 天</text>
        </view>

        <!-- ===== 当前状态 ===== -->
        <view class="section ui-fade-up ui-d1" v-if="periods.length > 0">
            <view class="hero-card">
                <view class="hero-left">
                    <view class="hero-ring" :class="heroClass">
                        <view class="hero-circle" :class="heroClass">
                            <text class="hero-num">{{ heroNum }}</text>
                            <text class="hero-unit">{{ heroUnit }}</text>
                        </view>
                    </view>
                </view>
                <view class="hero-right">
                    <text class="hero-title">{{ heroTitle }}</text>
                    <text class="hero-sub">{{ heroSub }}</text>
                    <text class="hero-hint" v-if="cycleWarning">{{ cycleWarning }}</text>
                </view>
            </view>
        </view>

        <!-- ===== 月历 ===== -->
        <view class="section ui-fade-up ui-d2">
            <view class="cal-card">
                <view class="cal-nav">
                    <view class="cal-month-wrap">
                        <text class="cal-year">{{ calYear }}</text>
                        <text class="cal-month">{{ pad(calMonth) }}<text class="cal-month-unit">月</text></text>
                    </view>
                    <view class="cal-arrows">
                        <text class="cal-arrow ui-press" @tap="prevMonth">‹</text>
                        <text class="cal-arrow ui-press" @tap="nextMonth">›</text>
                        <view class="cal-settings-btn ui-press" :class="{ active: showSettings }" @tap="showSettings = !showSettings">
                            <text class="cal-settings-btn-text">{{ showSettings ? '收起' : '设置' }}</text>
                        </view>
                    </view>
                </view>
                <view class="cal-header">
                    <text v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w" class="cal-wd">{{ w }}</text>
                </view>
                <view class="cal-row" v-for="(row, ri) in calRows" :key="ri">
                    <view v-for="c in row" :key="c._idx" class="cal-cell" :class="c.cls" @tap="onTapCell(c)">
                        <text v-if="c.d" class="cal-date">{{ c.d }}</text>
                    </view>
                </view>
                <view class="cal-legend">
                    <view class="cal-leg"><view class="cal-leg-dot period"></view><text>经期</text></view>
                    <view class="cal-leg"><view class="cal-leg-dot predict"></view><text>预测</text></view>
                    <view class="cal-leg"><view class="cal-leg-dot today"></view><text>今天</text></view>
                </view>
                <!-- 内嵌设置 -->
                <view class="cal-settings" v-if="showSettings">
                    <view class="setting-row">
                        <view class="setting-icon ui-bubble--rose"><text>🌙</text></view>
                        <text class="setting-label">周期长度</text>
                        <picker :range="cycleLenRange" :value="cycleLenIdx" @change="onCycleLenChange">
                            <view class="setting-pick ui-press">
                                <text class="setting-value">{{ settings.cycleLength }} 天</text>
                                <text class="setting-arrow">›</text>
                            </view>
                        </picker>
                    </view>
                    <view class="setting-divider"></view>
                    <view class="setting-row">
                        <view class="setting-icon ui-bubble--peach"><text>🌸</text></view>
                        <text class="setting-label">经期长度</text>
                        <picker :range="periodLenRange" :value="periodLenIdx" @change="onPeriodLenChange">
                            <view class="setting-pick ui-press">
                                <text class="setting-value">{{ settings.periodLength }} 天</text>
                                <text class="setting-arrow">›</text>
                            </view>
                        </picker>
                    </view>
                    <view class="setting-divider"></view>
                    <view class="setting-row">
                        <view class="setting-icon ui-bubble--butter"><text>🔔</text></view>
                        <text class="setting-label">提前提醒</text>
                        <picker :range="remindDaysRange" :value="remindIdx" @change="onRemindChange">
                            <view class="setting-pick ui-press">
                                <text class="setting-value">{{ settings.remindDays }} 天</text>
                                <text class="setting-arrow">›</text>
                            </view>
                        </picker>
                    </view>
                </view>
            </view>
        </view>

        <!-- ===== 周期统计 ===== -->
        <view class="section ui-fade-up ui-d3" v-if="periods.length >= 1">
            <view class="sec-head">
                <text class="ui-eyebrow">INSIGHTS</text>
                <text class="sec-label">周期统计</text>
            </view>
            <view class="stats-card">
                <view class="stats-grid">
                    <view class="stat-item stat-item--rose">
                        <text class="stat-label">平均周期</text>
                        <view class="stat-content">
                            <text class="stat-value accent">{{ avgCycleLen ? Math.round(avgCycleLen) : '--' }}</text>
                            <text class="stat-unit">天</text>
                        </view>
                    </view>
                    <view class="stat-item stat-item--peach">
                        <text class="stat-label">平均经期</text>
                        <view class="stat-content">
                            <text class="stat-value">{{ avgPeriodLen ? Math.round(avgPeriodLen) : '--' }}</text>
                            <text class="stat-unit">天</text>
                        </view>
                    </view>
                </view>
                <view class="stats-divider" v-if="periods.length >= 2"></view>
                <view class="stats-regular" v-if="periods.length >= 2">
                    <view class="regular-header">
                        <text class="regular-title">周期规律性</text>
                        <text class="regular-badge" :class="regClass">{{ regLabel }}</text>
                    </view>
                    <view class="regular-bar">
                        <view class="regular-fill" :class="regClass" :style="{ width: regScore + '%' }"></view>
                    </view>
                    <view class="regular-range" v-if="cycleRange.min">
                        <text class="range-text">最短 {{ cycleRange.min }} 天</text>
                        <text class="range-text">最长 {{ cycleRange.max }} 天</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- ===== 记录按钮 ===== -->
        <view class="section ui-fade-up ui-d4">
            <view class="record-btn ui-btn ui-press" @tap="openNewForm">
                <text>记录经期</text>
            </view>
        </view>

        <!-- ===== 历史记录入口 ===== -->
        <view class="section ui-fade-up ui-d5" v-if="periods.length > 0">
            <view class="history-entry ui-press" @tap="goToHistory">
                <view class="he-left">
                    <view class="he-icon ui-bubble ui-bubble--lilac"><text>📖</text></view>
                    <view class="he-text">
                        <text class="he-title">历史记录</text>
                        <text class="he-desc">查看 {{ periods.length }} 次完整记录</text>
                    </view>
                </view>
                <text class="he-arrow">›</text>
            </view>
        </view>

        <!-- ===== 订阅 ===== -->
        <view class="section ui-fade-up ui-d6" v-if="periods.length >= 1">
            <view
                class="sub-card ui-press"
                @tap="
                    handleSubscribe('period_remind', {
                        cancelTitle: '取消订阅',
                        cancelContent: '确定取消经期提醒？取消后将不会收到推送',
                    })
                "
            >
                <view class="sub-bell-icon ui-bubble ui-bubble--butter"><text>🔔</text></view>
                <view class="sub-body">
                    <text class="sub-title">周期提醒</text>
                    <text class="sub-desc">{{ subscribed ? '已订阅，将收到经期提醒' : '订阅后将收到经期提醒' }}</text>
                </view>
                <text class="sub-status" :class="{ on: subscribed }">{{ subscribed ? '已开启' : '开启' }}</text>
            </view>
        </view>

        <!-- ===== 空状态 ===== -->
        <view v-if="!loading && periods.length === 0" class="empty-area ui-fade-up ui-d1">
            <view class="empty-card">
                <view class="empty-bubble"><text class="empty-emoji">🌸</text></view>
                <text class="empty-title">还没有经期记录</text>
                <text class="empty-desc">点击上方按钮，记录第一次经期吧</text>
            </view>
        </view>

        <!-- ===== 加载骨架 ===== -->
        <view v-if="loading" class="section">
            <view class="skeleton-card" v-for="i in 3" :key="i">
                <view class="skeleton-bar"></view>
                <view class="skeleton-line short"></view>
            </view>
        </view>

        <view class="bottom-space"></view>

        <!-- ===== 日期弹窗 ===== -->
        <view class="modal-mask" v-if="showModal" @tap="showModal = false">
            <view class="modal-body" @tap.stop>
                <view class="modal-grip"></view>
                <text class="ui-eyebrow modal-eyebrow">SELECTED DAY</text>
                <text class="modal-title">{{ displayDate(selectedDate) }}</text>
                <template v-if="modalRecord">
                    <view class="m-info-card">
                        <view class="m-info"
                            ><text class="m-label">开始</text
                            ><text class="m-value">{{ displayDate(modalRecord.startDate) }}</text></view
                        >
                        <view class="m-info"
                            ><text class="m-label">结束</text
                            ><text class="m-value">{{
                                modalRecord.endDate ? displayDate(modalRecord.endDate) : '进行中'
                            }}</text></view
                        >
                        <view class="m-info" v-if="modalRecord.note"
                            ><text class="m-label">备注</text><text class="m-value">{{ modalRecord.note }}</text></view
                        >
                    </view>
                    <view class="m-btn primary ui-press" v-if="!modalRecord.endDate" @tap="markEnded"
                        ><text>标记今天为结束日</text></view
                    >
                    <view class="m-btn secondary ui-press" @tap="editFromModal"><text>编辑记录</text></view>
                    <view class="m-btn danger ui-press" @tap="deleteFromModal"><text>删除记录</text></view>
                </template>
                <template v-else>
                    <view class="m-btn primary ui-press" v-if="!hasOpenPeriod" @tap="quickMarkStart"
                        ><text>标记为经期开始</text></view
                    >
                    <view class="m-btn primary ui-press" v-if="hasOpenPeriod" @tap="endOpenPeriod"
                        ><text>标记为经期结束</text></view
                    >
                    <view class="m-btn secondary ui-press" @tap="openFormWith(selectedDate)"><text>手动输入日期</text></view>
                </template>
                <view class="m-cancel" @tap="showModal = false"><text>取消</text></view>
            </view>
        </view>

        <!-- ===== 表单弹窗 ===== -->
        <period-form-modal
            v-if="showForm"
            :record="editingRecord"
            :start-date="formStartDate"
            @close="closeForm"
            @saved="onFormSaved"
        />
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import PeriodFormModal from './components/period-form-modal.vue'
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { dbUpdate, dbDelete, clearPCache, useSharedBg } from '../../utils/cloud'
import { usePeriodStats } from '../../utils/usePeriodStats'
import { usePeriodData, pad, dateToStr, addDays, displayDate } from '../../utils/usePeriodData'
import { useSubscription } from '../../utils/useSubscription'

const { periods, loading, settings, restoreFromCache, fetchData, loadSettings, saveSettings } = usePeriodData()
const refreshing = ref(false)
const showModal = ref(false)
const showSettings = ref(false)
const showForm = ref(false)
// 表单弹窗：editingRecord 为空时新增，formStartDate 为新增时预填的开始日期
const editingRecord = ref(null)
const formStartDate = ref('')
const selectedDate = ref(null)
const selectedRecord = ref(null)

const now = new Date()
const calYear = ref(now.getFullYear())
const calMonth = ref(now.getMonth() + 1)
const { getCycleLengths, avgCycleLen, avgPeriodLen, regLabel, regClass, regScore, cycleRange } = usePeriodStats(
    periods,
    settings
)
const { subscribedTypes, loadSubscription, handleSubscribe } = useSubscription()
const subscribed = computed(() => subscribedTypes.value.includes('period_remind'))

const { bgImage } = useSharedBg()

const cycleLenRange = Array.from({ length: 23 }, (_, i) => `${i + 18} 天`)
const periodLenRange = Array.from({ length: 10 }, (_, i) => `${i + 2} 天`)
const remindDaysRange = Array.from({ length: 7 }, (_, i) => `${i + 1} 天`)
const cycleLenIdx = computed(() => settings.value.cycleLength - 18)
const periodLenIdx = computed(() => settings.value.periodLength - 2)
const remindIdx = computed(() => settings.value.remindDays - 1)

// 从历史页编辑/删除记录后返回时需要刷新（首次显示由 onMounted 负责加载）
let _shownOnce = false
onShow(() => {
    if (_shownOnce) {
        fetchData()
        loadSettings()
    }
    _shownOnce = true
})

onMounted(() => {
    restoreFromCache()
    fetchData()
    loadSubscription()
    loadSettings()
})

const onRefresh = async () => {
    refreshing.value = true
    await fetchData()
    refreshing.value = false
}

// ===== 日历数据 =====
const periodDateMap = computed(() => {
    const map = {}
    for (const p of periods.value) {
        const end = p.endDate || dateToStr(new Date())
        let cur = new Date(p.startDate),
            endD = new Date(end),
            day = 1
        while (cur <= endD) {
            map[dateToStr(cur)] = { record: p, day }
            cur.setDate(cur.getDate() + 1)
            day++
        }
    }
    return map
})

const predictionRange = computed(() => {
    if (!periods.value.length || !avgCycleLen.value) return null
    const latest = periods.value[0]
    const predicted = addDays(latest.startDate, Math.round(avgCycleLen.value))
    return { start: predicted, end: addDays(predicted, (settings.value.periodLength || 5) - 1), predicted }
})

// 按行组织日历数据（每行7个）
const calRows = computed(() => {
    const y = calYear.value,
        m = calMonth.value
    const firstDow = new Date(y, m - 1, 1).getDay()
    const daysInMonth = new Date(y, m, 0).getDate()
    const pMap = periodDateMap.value,
        pred = predictionRange.value
    const todayStr = dateToStr(new Date())

    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push({ d: 0, cls: 'empty', _idx: cells.length })
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${pad(m)}-${pad(d)}`
        const cls = []
        if (pMap[ds]) {
            cls.push('period')
            if (pMap[ds].record.startDate === ds) cls.push('start')
        } else if (pred && ds >= pred.start && ds <= pred.end) {
            cls.push('predict')
            if (ds === pred.predicted) cls.push('pstart')
        }
        const isToday = ds === todayStr
        if (isToday) cls.push('today')
        cells.push({ d, ds, cls: cls.join(' '), isToday, _idx: cells.length })
    }
    const totalCells = firstDow + daysInMonth
    const numRows = Math.ceil(totalCells / 7)
    while (cells.length < numRows * 7) cells.push({ d: 0, cls: 'empty', _idx: cells.length })

    const rows = []
    for (let r = 0; r < numRows; r++) rows.push(cells.slice(r * 7, (r + 1) * 7))
    return rows
})

// Hero card
const nextPredicted = computed(() => {
    if (!periods.value.length || !avgCycleLen.value) return null
    return addDays(periods.value[0].startDate, Math.round(avgCycleLen.value))
})
const daysUntilNext = computed(() =>
    nextPredicted.value ? Math.ceil((new Date(nextPredicted.value) - new Date(dateToStr(new Date()))) / 86400000) : 999
)
const latestOnPeriod = computed(() => periods.value.length > 0 && !periods.value[0].endDate)
const currentPeriodDay = computed(() =>
    latestOnPeriod.value
        ? Math.floor((new Date(dateToStr(new Date())) - new Date(periods.value[0].startDate)) / 86400000) + 1
        : 0
)
const hasOpenPeriod = computed(() => periods.value.length > 0 && !periods.value[0].endDate)

const heroClass = computed(() =>
    latestOnPeriod.value
        ? 'on-period'
        : daysUntilNext.value <= 0
          ? 'overdue'
          : daysUntilNext.value <= 3
            ? 'urgent'
            : 'normal'
)
const heroNum = computed(() =>
    latestOnPeriod.value ? currentPeriodDay.value : daysUntilNext.value > 0 ? daysUntilNext.value : '!'
)
const heroUnit = computed(() => (latestOnPeriod.value ? '天' : daysUntilNext.value > 0 ? '天' : ''))
const heroTitle = computed(() =>
    latestOnPeriod.value
        ? `经期第 ${currentPeriodDay.value} 天`
        : daysUntilNext.value > 0
          ? `距离下次 ${daysUntilNext.value} 天`
          : `已推迟 ${Math.abs(daysUntilNext.value)} 天`
)
const heroSub = computed(() =>
    nextPredicted.value
        ? `预计 ${displayDate(nextPredicted.value)}`
        : avgCycleLen.value
          ? `平均周期 ${Math.round(avgCycleLen.value)} 天`
          : '记录更多数据后可预测'
)
const cycleWarning = computed(() => {
    const l = getCycleLengths()
    if (l.length < 3) return ''
    const recent = l[0],
        avg = l.slice(1).reduce((a, b) => a + b, 0) / (l.length - 1),
        diff = recent - avg
    if (Math.abs(diff) >= 7)
        return diff > 0 ? `最近周期偏长 ${Math.round(diff)} 天` : `最近周期偏短 ${Math.round(Math.abs(diff))} 天`
    return ''
})

// ===== 交互 =====
const modalRecord = computed(() => selectedRecord.value)

const onTapCell = c => {
    if (!c.d) return
    selectedDate.value = c.ds
    selectedRecord.value = periodDateMap.value[c.ds]?.record || null
    showModal.value = true
}

const goToHistory = () => {
    uni.navigateTo({ url: '/pages/period/period-history' })
}

const quickMarkStart = () => {
    showModal.value = false
    openForm(null, selectedDate.value)
}
// 把记录 r 的结束日标记为当前选中日期（不能早于开始日期）
const setEndDate = async r => {
    if (selectedDate.value < r.startDate) {
        uni.showToast({ title: '结束日期不能早于开始日期', icon: 'none' })
        return
    }
    clearPCache('periods')
    try {
        await dbUpdate('periods', r._id, { endDate: selectedDate.value, updateTime: new Date() })
        fetchData()
        uni.showToast({ title: '已标记', icon: 'success' })
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    }
}
const markEnded = () => {
    showModal.value = false
    const r = selectedRecord.value
    if (!r) return
    setEndDate(r)
}
const endOpenPeriod = () => {
    showModal.value = false
    const r = periods.value[0]
    if (!r || r.endDate) return
    setEndDate(r)
}
const openForm = (record, startDate = '') => {
    editingRecord.value = record
    formStartDate.value = startDate
    showForm.value = true
}
const closeForm = () => {
    showForm.value = false
    editingRecord.value = null
}
const onFormSaved = () => {
    closeForm()
    fetchData()
}
const openFormWith = ds => {
    showModal.value = false
    openForm(null, ds || '')
}
const editFromModal = () => {
    const r = modalRecord.value
    showModal.value = false
    editRecord(r)
}
const deleteFromModal = () => {
    const r = modalRecord.value
    showModal.value = false
    deleteRecord(r._id)
}
const openNewForm = () => openForm(null, dateToStr(new Date()))
const editRecord = p => openForm(p)
const deleteRecord = id => {
    showModal.value = false
    uni.showModal({
        title: '确认',
        content: '确定删除？',
        success: async r => {
            if (r.confirm) {
                clearPCache('periods')
                try {
                    await dbDelete('periods', id)
                    fetchData()
                } catch (e) {
                    uni.showToast({ title: '删除失败', icon: 'none' })
                }
            }
        },
    })
}

const onCycleLenChange = e => {
    settings.value.cycleLength = parseInt(e.detail.value) + 18
    saveSettings()
}
const onPeriodLenChange = e => {
    settings.value.periodLength = parseInt(e.detail.value) + 2
    saveSettings()
}
const onRemindChange = e => {
    settings.value.remindDays = parseInt(e.detail.value) + 1
    saveSettings()
}
// 保存设置：Storage 缓存（快速读取）+ 云函数持久化（权威数据源）

const prevMonth = () => {
    if (calMonth.value === 1) {
        calMonth.value = 12
        calYear.value--
    } else calMonth.value--
}
const nextMonth = () => {
    if (calMonth.value === 12) {
        calMonth.value = 1
        calYear.value++
    } else calMonth.value++
}
</script>

<style scoped>
.page-scroll {
    height: 100vh;
    background: transparent;
}
.page-scroll--transparent {
    background: transparent;
}

/* ===== 标题区 ===== */
.mast {
    padding: 40rpx 44rpx 8rpx;
    display: flex;
    flex-direction: column;
}
.mast-title {
    margin-top: 12rpx;
}
.mast-sub {
    margin-top: 10rpx;
    letter-spacing: 0.04em;
}

/* Section */
.section {
    padding: 0 32rpx;
    margin-bottom: 8rpx;
    padding-top: 28rpx;
}
.sec-head {
    display: flex;
    flex-direction: column;
    margin: 0 12rpx 20rpx;
}
.sec-label {
    font-family: var(--font-serif);
    font-size: 38rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
    margin-top: 6rpx;
}

/* ===== Hero Card ===== */
.hero-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 56rpx 40rpx 48rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    text-align: center;
}
.hero-left {
    flex-shrink: 0;
}
/* 柔和渐变色环 */
.hero-ring {
    width: 300rpx;
    height: 300rpx;
    border-radius: 50%;
    padding: 14rpx;
    box-sizing: border-box;
    background: linear-gradient(145deg, #f6c9d0 0%, #f9dccb 45%, #dccff3 100%);
    box-shadow: 0 30rpx 60rpx -28rpx rgba(214, 120, 140, 0.55);
}
.hero-ring.urgent {
    background: linear-gradient(145deg, #f2a9b4 0%, #f6c3b2 55%, #f5e3b3 100%);
}
.hero-ring.overdue {
    background: linear-gradient(145deg, #e07a5f 0%, #ef9f95 55%, #f4c7b4 100%);
}
.hero-ring.on-period {
    background: linear-gradient(145deg, #e48c9c 0%, #ebb2b8 55%, #f4c7b4 100%);
}
.hero-circle {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #fffaf7;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 4rpx 18rpx rgba(214, 120, 140, 0.12);
}
.hero-circle.on-period {
    background: linear-gradient(160deg, #e895a5 0%, #d9798d 100%);
    box-shadow: inset 0 4rpx 18rpx rgba(255, 255, 255, 0.25);
}
.hero-circle.on-period .hero-num,
.hero-circle.on-period .hero-unit {
    color: #fff;
}
.hero-circle.urgent {
    background: #fff7f4;
}
.hero-circle.overdue {
    background: #fff5f2;
}
.hero-circle.overdue .hero-num {
    color: var(--coral);
}
.hero-num {
    font-family: var(--font-serif);
    font-size: 120rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1;
    letter-spacing: -0.03em;
}
.hero-unit {
    font-size: 22rpx;
    color: var(--muted);
    margin-top: 10rpx;
    letter-spacing: 0.3em;
}
.hero-right {
    margin-top: 40rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.hero-title {
    font-family: var(--font-serif);
    font-size: 40rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
    letter-spacing: 0.02em;
}
.hero-sub {
    font-size: 24rpx;
    color: var(--muted);
    display: block;
    margin-top: 10rpx;
    letter-spacing: 0.06em;
}
.hero-hint {
    display: inline-block;
    font-size: 22rpx;
    color: var(--plum);
    background: rgba(212, 200, 240, 0.55);
    padding: 8rpx 24rpx;
    border-radius: 999rpx;
    margin-top: 20rpx;
}

/* ===== 月历 ===== */
.cal-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    padding: 40rpx 20rpx 28rpx;
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.cal-nav {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 28rpx;
    padding: 0 16rpx;
}
.cal-month-wrap {
    display: flex;
    flex-direction: column;
}
.cal-year {
    font-size: 20rpx;
    letter-spacing: 0.32em;
    color: var(--muted);
    font-weight: 600;
}
.cal-month {
    font-family: var(--font-serif);
    font-size: 64rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.05;
}
.cal-month-unit {
    font-family: var(--font-sans);
    font-size: 26rpx;
    font-weight: 500;
    color: var(--ink-2);
    margin-left: 6rpx;
}
.cal-arrows {
    display: flex;
    align-items: center;
    gap: 14rpx;
    padding-bottom: 6rpx;
}
.cal-arrow {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36rpx;
    color: var(--ink);
    line-height: 1;
}
.cal-settings-btn {
    height: 60rpx;
    padding: 0 26rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
    display: flex;
    align-items: center;
}
.cal-settings-btn.active {
    background: var(--ink);
    border-color: var(--ink);
}
.cal-settings-btn-text {
    font-size: 22rpx;
    color: var(--ink-2);
    font-weight: 600;
    letter-spacing: 0.08em;
}
.cal-settings-btn.active .cal-settings-btn-text {
    color: #fff;
}
.cal-header {
    display: flex;
}
.cal-wd {
    width: 14.285%;
    text-align: center;
    font-size: 20rpx;
    color: var(--muted);
    font-weight: 600;
    letter-spacing: 0.1em;
    padding-bottom: 14rpx;
}
.cal-row {
    display: flex;
}
.cal-cell {
    width: 14.285%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8rpx 0;
    text-align: center;
}
.cal-date {
    width: 68rpx;
    height: 68rpx;
    border-radius: 50%;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif);
    font-size: 28rpx;
    font-weight: 600;
    color: var(--ink-2);
    box-sizing: border-box;
    transition: all 0.2s;
}
.cal-cell:active .cal-date {
    background: rgba(30, 26, 23, 0.05);
}
/* 经期：玫瑰色实心圆 */
.cal-cell.period .cal-date {
    background: linear-gradient(150deg, #f0b7c0 0%, #e595a4 100%);
    color: #fff;
    box-shadow: 0 10rpx 20rpx -10rpx rgba(214, 120, 140, 0.7);
}
.cal-cell.period.start .cal-date {
    background: linear-gradient(150deg, #e895a5 0%, #d6788c 100%);
    font-weight: 700;
}
/* 预测：玫瑰色虚线圆环 */
.cal-cell.predict .cal-date {
    background: rgba(235, 178, 184, 0.12);
    border: 3rpx dashed var(--rose);
    color: #c9788a;
}
.cal-cell.predict.pstart .cal-date {
    border-style: solid;
    border-color: #e595a4;
}
/* 今天：墨色圆环 */
.cal-cell.today .cal-date {
    border: 3rpx solid var(--ink);
    background: rgba(255, 255, 255, 0.85);
    color: var(--ink);
    font-weight: 700;
}
.cal-cell.today.period .cal-date {
    background: linear-gradient(150deg, #e895a5 0%, #d6788c 100%);
    border-color: var(--ink);
    color: #fff;
    box-shadow: 0 10rpx 24rpx -10rpx rgba(214, 120, 140, 0.8);
}
.cal-cell.today.predict .cal-date {
    border-style: solid;
    border-color: var(--ink);
}
.cal-cell.empty {
    padding: 8rpx 0;
}
.cal-cell.empty .cal-date {
    background: transparent;
}
.cal-legend {
    display: flex;
    justify-content: center;
    gap: 40rpx;
    margin: 24rpx 16rpx 0;
    padding-top: 24rpx;
    border-top: 1rpx solid var(--line);
}
.cal-leg {
    display: flex;
    align-items: center;
    gap: 10rpx;
}
.cal-leg text {
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.06em;
}
.cal-leg-dot {
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    box-sizing: border-box;
}
.cal-leg-dot.period {
    background: linear-gradient(150deg, #f0b7c0 0%, #e595a4 100%);
}
.cal-leg-dot.predict {
    background: rgba(235, 178, 184, 0.12);
    border: 2rpx dashed #e595a4;
}
.cal-leg-dot.today {
    background: #fff;
    border: 3rpx solid var(--ink);
}
/* 内嵌设置 */
.cal-settings {
    margin: 24rpx 4rpx 0;
    padding: 12rpx 16rpx;
    background: rgba(255, 255, 255, 0.6);
    border-radius: var(--r-l);
    border: 1rpx solid var(--line);
}
.setting-row {
    display: flex;
    align-items: center;
    padding: 16rpx 8rpx;
    gap: 20rpx;
}
.setting-label {
    font-size: 27rpx;
    color: var(--ink);
    font-weight: 500;
    flex: 1;
}
.setting-pick {
    display: flex;
    align-items: center;
    gap: 8rpx;
    background: var(--ink);
    border-radius: 999rpx;
    padding: 10rpx 24rpx;
}
.setting-value {
    font-size: 24rpx;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.04em;
}
.setting-arrow {
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 300;
}
.setting-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 8rpx 0 84rpx;
}
.setting-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 30rpx;
}

/* ===== Stats Card ===== */
.stats-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    padding: 32rpx;
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.stats-grid {
    display: flex;
    gap: 20rpx;
}
.stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 28rpx 28rpx 24rpx;
    border-radius: var(--r-l);
}
.stat-item--rose {
    background: linear-gradient(150deg, rgba(242, 184, 192, 0.55) 0%, rgba(249, 215, 195, 0.45) 100%);
}
.stat-item--peach {
    background: linear-gradient(150deg, rgba(249, 215, 195, 0.55) 0%, rgba(214, 197, 242, 0.4) 100%);
}
.stat-content {
    display: flex;
    align-items: baseline;
    margin-top: 12rpx;
}
.stat-value {
    font-family: var(--font-serif);
    font-size: 72rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1;
}
.stat-value.accent {
    color: var(--ink);
}
.stat-unit {
    font-size: 22rpx;
    color: var(--ink-2);
    margin-left: 8rpx;
}
.stat-label {
    font-size: 22rpx;
    color: var(--ink-2);
    letter-spacing: 0.08em;
}
.stats-divider {
    height: 1rpx;
    background: var(--line);
    margin: 28rpx 0 24rpx;
}
.stats-regular {
    padding: 0 4rpx;
}
.regular-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18rpx;
}
.regular-title {
    font-size: 26rpx;
    color: var(--ink);
    font-weight: 600;
}
.regular-badge {
    font-size: 22rpx;
    padding: 6rpx 20rpx;
    border-radius: 999rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
}
.regular-badge.good {
    background: var(--sage);
    color: #4f7a5b;
}
.regular-badge.warn {
    background: var(--butter);
    color: #9a7430;
}
.regular-badge.bad {
    background: rgba(224, 122, 95, 0.16);
    color: var(--coral);
}
.regular-bar {
    height: 14rpx;
    background: rgba(30, 26, 23, 0.06);
    border-radius: 999rpx;
    overflow: hidden;
}
.regular-fill {
    height: 100%;
    border-radius: 999rpx;
    transition: width 0.3s ease;
}
.regular-fill.good {
    background: linear-gradient(90deg, #b5d3bd 0%, #8fbf9d 100%);
}
.regular-fill.warn {
    background: linear-gradient(90deg, #f5e3b3 0%, #e8c37a 100%);
}
.regular-fill.bad {
    background: linear-gradient(90deg, #f4c7b4 0%, #e07a5f 100%);
}
.regular-range {
    display: flex;
    justify-content: space-between;
    margin-top: 14rpx;
}
.range-text {
    font-size: 22rpx;
    color: var(--muted);
}

/* ===== History Entry ===== */
.history-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28rpx 32rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    box-shadow: var(--shadow-soft);
}
.he-left {
    display: flex;
    align-items: center;
    gap: 24rpx;
}
.he-icon {
    width: 80rpx;
    height: 80rpx;
    border-radius: 28rpx;
    font-size: 36rpx;
}
.he-text {
    display: flex;
    flex-direction: column;
}
.he-title {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--ink);
}
.he-desc {
    font-size: 22rpx;
    color: var(--muted);
    margin-top: 4rpx;
}
.he-arrow {
    font-size: 40rpx;
    color: var(--faint);
    font-weight: 300;
}

/* ===== Record Button ===== */
.record-btn {
    height: 104rpx;
    font-size: 30rpx;
    letter-spacing: 0.2em;
}

/* ===== Subscribe Card ===== */
.sub-card {
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 28rpx 32rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    box-shadow: var(--shadow-soft);
}
.sub-bell-icon {
    width: 80rpx;
    height: 80rpx;
    border-radius: 28rpx;
    font-size: 36rpx;
    flex-shrink: 0;
}
.sub-body {
    flex: 1;
}
.sub-title {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--ink);
    display: block;
}
.sub-desc {
    font-size: 22rpx;
    color: var(--muted);
    display: block;
    margin-top: 4rpx;
}
.sub-status {
    font-size: 22rpx;
    font-weight: 600;
    color: #fff;
    background: var(--ink);
    padding: 10rpx 26rpx;
    border-radius: 999rpx;
    letter-spacing: 0.08em;
    flex-shrink: 0;
}
.sub-status.on {
    color: #4f7a5b;
    background: var(--sage);
}

/* ===== Modal ===== */
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(30, 26, 23, 0.35);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.modal-body {
    width: 100%;
    background: var(--card-solid);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    padding: 20rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.modal-grip {
    width: 72rpx;
    height: 8rpx;
    border-radius: 999rpx;
    background: var(--bg-2);
    margin: 0 auto 28rpx;
}
.modal-eyebrow {
    text-align: center;
}
.modal-title {
    font-family: var(--font-serif);
    font-size: 48rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
    text-align: center;
    margin: 8rpx 0 32rpx;
}
.m-info-card {
    background: var(--bg);
    border-radius: var(--r-l);
    padding: 12rpx 28rpx;
    margin-bottom: 12rpx;
}
.m-info {
    display: flex;
    align-items: center;
    padding: 18rpx 0;
}
.m-info + .m-info {
    border-top: 1rpx solid var(--line);
}
.m-label {
    font-size: 24rpx;
    color: var(--muted);
    width: 120rpx;
    flex-shrink: 0;
    letter-spacing: 0.08em;
}
.m-value {
    font-size: 28rpx;
    color: var(--ink);
    font-weight: 500;
    flex: 1;
}
.m-btn {
    height: 96rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 18rpx;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
}
.m-btn.primary {
    background: var(--ink);
    color: #fff;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.m-btn.secondary {
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
    color: var(--ink);
}
.m-btn.danger {
    background: transparent;
    color: var(--coral);
}
.m-cancel {
    padding: 20rpx;
    text-align: center;
    margin-top: 4rpx;
}
.m-cancel text {
    font-size: 26rpx;
    color: var(--muted);
    letter-spacing: 0.1em;
}

/* ===== Skeleton ===== */
.skeleton-card {
    background: var(--card);
    border-radius: var(--r-l);
    padding: 32rpx;
    margin-bottom: 20rpx;
    border: 1rpx solid var(--card-border);
}
.skeleton-bar {
    height: 32rpx;
    background: linear-gradient(90deg, rgba(235, 178, 184, 0.25) 25%, rgba(255, 255, 255, 0.6) 50%, rgba(235, 178, 184, 0.25) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 999rpx;
    margin-bottom: 18rpx;
}
.skeleton-line {
    height: 24rpx;
    background: linear-gradient(90deg, rgba(235, 178, 184, 0.25) 25%, rgba(255, 255, 255, 0.6) 50%, rgba(235, 178, 184, 0.25) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 999rpx;
}
.skeleton-line.short {
    width: 40%;
}
@keyframes shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}

/* ===== Empty ===== */
.empty-area {
    padding: 32rpx 32rpx 40rpx;
}
.empty-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    padding: 72rpx 40rpx 64rpx;
    text-align: center;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    align-items: center;
}
.empty-bubble {
    width: 168rpx;
    height: 168rpx;
    border-radius: 50%;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 32rpx;
    box-shadow: 0 24rpx 48rpx -24rpx rgba(214, 120, 140, 0.55);
}
.empty-emoji {
    font-size: 80rpx;
}
.empty-title {
    font-family: var(--font-serif);
    font-size: 38rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
    margin-bottom: 12rpx;
}
.empty-desc {
    font-size: 24rpx;
    color: var(--muted);
    display: block;
}

.bottom-space {
    height: calc(80rpx + env(safe-area-inset-bottom));
}
</style>
