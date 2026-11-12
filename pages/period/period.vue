<template>
    <page-bg />
    <scroll-view
        scroll-y
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage }"
        refresher-enabled
        refresher-default-style="black"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <!-- ===== 当前状态 ===== -->
        <view class="section" v-if="periods.length > 0">
            <view class="hero-card">
                <view class="hero-left">
                    <view class="hero-circle" :class="heroClass">
                        <text class="hero-num">{{ heroNum }}</text>
                        <text class="hero-unit">{{ heroUnit }}</text>
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
        <view class="section">
            <view class="cal-card">
                <view class="cal-nav">
                    <text class="cal-month">{{ calYear }}年{{ pad(calMonth) }}月</text>
                    <view class="cal-arrows">
                        <text class="cal-arrow" @tap="prevMonth">‹</text>
                        <text class="cal-arrow" @tap="nextMonth">›</text>
                        <view class="cal-settings-btn" @tap="showSettings = !showSettings">
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
                        <view class="setting-icon cycle"><view class="si-ring"></view></view>
                        <text class="setting-label">周期长度</text>
                        <picker :range="cycleLenRange" :value="cycleLenIdx" @change="onCycleLenChange">
                            <view class="setting-pick">
                                <text class="setting-value">{{ settings.cycleLength }} 天</text>
                                <text class="setting-arrow">›</text>
                            </view>
                        </picker>
                    </view>
                    <view class="setting-divider"></view>
                    <view class="setting-row">
                        <view class="setting-icon period"><view class="si-drop"></view></view>
                        <text class="setting-label">经期长度</text>
                        <picker :range="periodLenRange" :value="periodLenIdx" @change="onPeriodLenChange">
                            <view class="setting-pick">
                                <text class="setting-value">{{ settings.periodLength }} 天</text>
                                <text class="setting-arrow">›</text>
                            </view>
                        </picker>
                    </view>
                    <view class="setting-divider"></view>
                    <view class="setting-row">
                        <view class="setting-icon remind"
                            ><view class="si-bell"></view><view class="si-clapper"></view
                        ></view>
                        <text class="setting-label">提前提醒</text>
                        <picker :range="remindDaysRange" :value="remindIdx" @change="onRemindChange">
                            <view class="setting-pick">
                                <text class="setting-value">{{ settings.remindDays }} 天</text>
                                <text class="setting-arrow">›</text>
                            </view>
                        </picker>
                    </view>
                </view>
            </view>
        </view>

        <!-- ===== 周期统计 ===== -->
        <view class="section" v-if="periods.length >= 1">
            <text class="sec-label">周期统计</text>
            <view class="stats-card">
                <view class="stats-grid">
                    <view class="stat-item">
                        <view class="stat-icon cycle"><view class="si-ring"></view></view>
                        <view class="stat-content">
                            <text class="stat-value accent">{{ avgCycleLen ? Math.round(avgCycleLen) : '--' }}</text>
                            <text class="stat-label">平均周期(天)</text>
                        </view>
                    </view>
                    <view class="stat-item">
                        <view class="stat-icon period"><view class="si-drop"></view></view>
                        <view class="stat-content">
                            <text class="stat-value">{{ avgPeriodLen ? Math.round(avgPeriodLen) : '--' }}</text>
                            <text class="stat-label">平均经期(天)</text>
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
        <view class="section">
            <view class="record-btn" @tap="openNewForm">
                <text>记录经期</text>
            </view>
        </view>

        <!-- ===== 历史记录入口 ===== -->
        <view class="section" v-if="periods.length > 0">
            <view class="history-entry" @tap="goToHistory">
                <view class="he-left">
                    <view class="he-icon"><view class="he-cal"></view><view class="he-dots"></view></view>
                    <view class="he-text">
                        <text class="he-title">历史记录</text>
                        <text class="he-desc">查看 {{ periods.length }} 次完整记录</text>
                    </view>
                </view>
                <text class="he-arrow">›</text>
            </view>
        </view>

        <!-- ===== 订阅 ===== -->
        <view class="section" v-if="periods.length >= 1">
            <view
                class="sub-card"
                @tap="
                    handleSubscribe('period_remind', {
                        cancelTitle: '取消订阅',
                        cancelContent: '确定取消经期提醒？取消后将不会收到推送',
                    })
                "
            >
                <view class="sub-bell-icon"><view class="sbi-body"></view><view class="sbi-clapper"></view></view>
                <view class="sub-body">
                    <text class="sub-title">周期提醒</text>
                    <text class="sub-desc">{{ subscribed ? '已订阅，将收到经期提醒' : '订阅后将收到经期提醒' }}</text>
                </view>
                <text class="sub-status" :class="{ on: subscribed }">{{ subscribed ? '已开启' : '开启' }}</text>
            </view>
        </view>

        <!-- ===== 空状态 ===== -->
        <view v-if="!loading && periods.length === 0" class="empty-area">
            <view class="empty-card">
                <text class="empty-emoji">🌸</text>
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
                <text class="modal-title">{{ displayDate(selectedDate) }}</text>
                <template v-if="modalRecord">
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
                    <view class="m-btn primary" v-if="!modalRecord.endDate" @tap="markEnded"
                        ><text>标记今天为结束日</text></view
                    >
                    <view class="m-btn secondary" @tap="editFromModal"><text>编辑记录</text></view>
                    <view class="m-btn danger" @tap="deleteFromModal"><text>删除记录</text></view>
                </template>
                <template v-else>
                    <view class="m-btn primary" v-if="!hasOpenPeriod" @tap="quickMarkStart"
                        ><text>标记为经期开始</text></view
                    >
                    <view class="m-btn primary" v-if="hasOpenPeriod" @tap="endOpenPeriod"
                        ><text>标记为经期结束</text></view
                    >
                    <view class="m-btn secondary" @tap="openFormWith(selectedDate)"><text>手动输入日期</text></view>
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
    background: #f5f0eb;
}
.page-scroll--transparent {
    background: transparent;
}

/* Section */
.section {
    padding: 0 28rpx;
    margin-bottom: 16rpx;
    padding-top: 24rpx;
}
.sec-label {
    font-size: 26rpx;
    color: #d4879a;
    display: block;
    margin-bottom: 12rpx;
    margin-left: 8rpx;
    letter-spacing: 2rpx;
    font-weight: 600;
}

/* ===== Hero Card ===== */
.hero-card {
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 32rpx 28rpx;
    background: linear-gradient(135deg, #fdf2f6 0%, #fce8ef 50%, #fdf0f8 100%);
    border-radius: 24rpx;
    border: 1rpx solid rgba(212, 135, 154, 0.15);
}
.hero-left {
    flex-shrink: 0;
}
.hero-circle {
    width: 96rpx;
    height: 96rpx;
    border-radius: 48rpx;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4rpx 24rpx rgba(212, 135, 154, 0.15);
}
.hero-circle.on-period {
    background: linear-gradient(135deg, #e88fa3 0%, #d4879a 100%);
}
.hero-circle.on-period .hero-num,
.hero-circle.on-period .hero-unit {
    color: #fff;
}
.hero-circle.urgent {
    background: linear-gradient(135deg, #fce8ef 0%, #f8dce4 100%);
}
.hero-circle.overdue {
    background: linear-gradient(135deg, #ffe0e0 0%, #ffd0d0 100%);
}
.hero-circle.overdue .hero-num {
    color: #ff3b30;
}
.hero-num {
    font-size: 38rpx;
    font-weight: 700;
    color: #d4879a;
    line-height: 1;
}
.hero-unit {
    font-size: 18rpx;
    color: #8e8e93;
    margin-top: 2rpx;
}
.hero-right {
    flex: 1;
}
.hero-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #1c1c1e;
    display: block;
    letter-spacing: 0.5rpx;
}
.hero-sub {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-top: 6rpx;
}
.hero-hint {
    font-size: 22rpx;
    color: #d4a060;
    display: block;
    margin-top: 6rpx;
}

/* ===== 月历 ===== */
.cal-card {
    background: #fff;
    border-radius: 24rpx;
    padding: 28rpx 16rpx 20rpx;
    box-shadow: 0 4rpx 24rpx rgba(212, 135, 154, 0.08);
    border: 1rpx solid rgba(212, 135, 154, 0.1);
}
.cal-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;
    padding: 0 12rpx;
}
.cal-month {
    font-size: 30rpx;
    font-weight: 600;
    color: #d4879a;
    letter-spacing: 1rpx;
}
.cal-arrows {
    display: flex;
    gap: 20rpx;
}
.cal-arrow {
    font-size: 40rpx;
    color: #d4879a;
    font-weight: 300;
    line-height: 1;
    padding: 0 4rpx;
}
.cal-settings-btn {
    background: linear-gradient(135deg, #fce8ef 0%, #f8dce4 100%);
    border-radius: 20rpx;
    padding: 6rpx 20rpx;
    border: 1rpx solid rgba(212, 135, 154, 0.2);
}
.cal-settings-btn-text {
    font-size: 22rpx;
    color: #d4879a;
    font-weight: 500;
}
.cal-header {
    display: flex;
}
.cal-wd {
    width: 14.285%;
    text-align: center;
    font-size: 22rpx;
    color: #c0a0ac;
    font-weight: 500;
    padding-bottom: 12rpx;
}
.cal-row {
    display: flex;
}
.cal-cell {
    width: 14.285%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6rpx 0;
}
.cal-date {
    width: 60rpx;
    height: 60rpx;
    border-radius: 16rpx;
    background: #faf5f7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 600;
    color: #2c2c2e;
    transition: all 0.2s;
}
.cal-cell.period .cal-date {
    background: linear-gradient(135deg, #e88fa3 0%, #d4879a 100%);
    color: #fff;
    box-shadow: 0 4rpx 12rpx rgba(212, 135, 154, 0.3);
}
.cal-cell.period.start .cal-date {
    border-radius: 16rpx 8rpx 8rpx 16rpx;
}
.cal-cell.predict .cal-date {
    background: #fdf0f5;
    border: 2rpx dashed rgba(212, 135, 154, 0.35);
    color: #d4a0b0;
}
.cal-cell.predict.pstart .cal-date {
    border-style: solid;
    border-color: rgba(212, 135, 154, 0.5);
}
.cal-cell.today .cal-date {
    border: 3rpx solid #d4879a;
    background: #fff;
    color: #d4879a;
}
.cal-cell.today.period .cal-date {
    background: linear-gradient(135deg, #e88fa3 0%, #d4879a 100%);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 4rpx 16rpx rgba(212, 135, 154, 0.4);
}
.cal-cell.empty .cal-date {
    background: transparent;
}
.cal-legend {
    display: flex;
    justify-content: center;
    gap: 32rpx;
    margin-top: 16rpx;
    padding-top: 16rpx;
    border-top: 1rpx solid rgba(212, 135, 154, 0.08);
}
.cal-leg {
    display: flex;
    align-items: center;
    gap: 8rpx;
}
.cal-leg text {
    font-size: 22rpx;
    color: #c7c7cc;
}
.cal-leg-dot {
    width: 14rpx;
    height: 14rpx;
    border-radius: 4rpx;
}
.cal-leg-dot.period {
    background: linear-gradient(135deg, #e88fa3, #d4879a);
}
.cal-leg-dot.predict {
    background: #fdf0f5;
    border: 1rpx dashed rgba(212, 135, 154, 0.4);
}
.cal-leg-dot.today {
    background: #fff;
    border: 2rpx solid #d4879a;
    border-radius: 50%;
}
/* 内嵌设置 */
.cal-settings {
    margin-top: 16rpx;
    padding-top: 16rpx;
    border-top: 1rpx solid rgba(212, 135, 154, 0.08);
}
.setting-row {
    display: flex;
    align-items: center;
    padding: 12rpx 12rpx;
    gap: 16rpx;
}
.setting-label {
    font-size: 26rpx;
    color: #3a3a3c;
    flex: 1;
}
.setting-pick {
    display: flex;
    align-items: center;
    gap: 8rpx;
    background: #fdf0f5;
    border-radius: 16rpx;
    padding: 8rpx 20rpx;
}
.setting-value {
    font-size: 26rpx;
    color: #d4879a;
    font-weight: 600;
}
.setting-arrow {
    font-size: 28rpx;
    color: #d4879a;
    font-weight: 300;
}
.setting-divider {
    height: 1rpx;
    background: rgba(212, 135, 154, 0.08);
    margin: 0 12rpx;
}

/* Setting Icons */
.setting-icon {
    width: 48rpx;
    height: 48rpx;
    border-radius: 14rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
}
.setting-icon.cycle {
    background: rgba(212, 135, 154, 0.1);
}
.setting-icon.period {
    background: rgba(232, 143, 163, 0.1);
}
.setting-icon.remind {
    background: rgba(212, 160, 96, 0.1);
}
.si-ring {
    width: 22rpx;
    height: 22rpx;
    border: 3rpx solid #d4879a;
    border-radius: 50%;
    position: relative;
}
.si-ring::after {
    content: '';
    position: absolute;
    top: -5rpx;
    right: -3rpx;
    width: 8rpx;
    height: 8rpx;
    background: #d4879a;
    border-radius: 4rpx;
}
.si-drop {
    width: 16rpx;
    height: 20rpx;
    background: #e88fa3;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
}
.si-bell {
    width: 18rpx;
    height: 16rpx;
    background: #d4a060;
    border-radius: 10rpx 10rpx 0 0;
}
.si-clapper {
    width: 6rpx;
    height: 4rpx;
    background: #d4a060;
    border-radius: 0 0 4rpx 4rpx;
    margin-top: 1rpx;
}

/* ===== Stats Card ===== */
.stats-card {
    background: #fff;
    border-radius: 24rpx;
    padding: 28rpx;
    box-shadow: 0 4rpx 20rpx rgba(212, 135, 154, 0.08);
    border: 1rpx solid rgba(212, 135, 154, 0.1);
}
.stats-grid {
    display: flex;
    gap: 20rpx;
}
.stat-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 16rpx;
    background: linear-gradient(135deg, #fdf2f6 0%, #fce8ef 100%);
    border-radius: 20rpx;
}
.stat-icon {
    width: 56rpx;
    height: 56rpx;
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.stat-icon.cycle {
    background: rgba(212, 135, 154, 0.15);
}
.stat-icon.period {
    background: rgba(232, 143, 163, 0.15);
}
.stat-content {
    display: flex;
    flex-direction: column;
}
.stat-value {
    font-size: 36rpx;
    font-weight: 700;
    color: #1c1c1e;
    line-height: 1.2;
}
.stat-value.accent {
    color: #d4879a;
}
.stat-label {
    font-size: 22rpx;
    color: #8e8e93;
    margin-top: 4rpx;
}
.stats-divider {
    height: 1rpx;
    background: rgba(212, 135, 154, 0.1);
    margin: 20rpx 0;
}
.stats-regular {
    padding: 8rpx 0;
}
.regular-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;
}
.regular-title {
    font-size: 26rpx;
    color: #3a3a3c;
    font-weight: 500;
}
.regular-badge {
    font-size: 22rpx;
    padding: 6rpx 16rpx;
    border-radius: 16rpx;
    font-weight: 600;
}
.regular-badge.good {
    background: rgba(168, 197, 160, 0.15);
    color: #a8c5a0;
}
.regular-badge.warn {
    background: rgba(212, 165, 116, 0.15);
    color: #d4a574;
}
.regular-badge.bad {
    background: rgba(255, 59, 48, 0.1);
    color: #ff3b30;
}
.regular-bar {
    height: 12rpx;
    background: rgba(212, 135, 154, 0.08);
    border-radius: 6rpx;
    overflow: hidden;
}
.regular-fill {
    height: 100%;
    border-radius: 6rpx;
    transition: width 0.3s ease;
}
.regular-fill.good {
    background: linear-gradient(90deg, #a8c5a0 0%, #c5e0bc 100%);
}
.regular-fill.warn {
    background: linear-gradient(90deg, #d4a574 0%, #e8c5a0 100%);
}
.regular-fill.bad {
    background: linear-gradient(90deg, #ff3b30 0%, #ff6b6b 100%);
}
.regular-range {
    display: flex;
    justify-content: space-between;
    margin-top: 12rpx;
}
.range-text {
    font-size: 22rpx;
    color: #8e8e93;
}

/* ===== History Entry ===== */
.history-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28rpx;
    background: linear-gradient(135deg, #fff 0%, #fdf2f6 100%);
    border-radius: 24rpx;
    box-shadow: 0 4rpx 20rpx rgba(212, 135, 154, 0.08);
    border: 1rpx solid rgba(212, 135, 154, 0.1);
}
.history-entry:active {
    background: rgba(212, 135, 154, 0.03);
}
.he-left {
    display: flex;
    align-items: center;
    gap: 20rpx;
}
.he-icon {
    width: 56rpx;
    height: 56rpx;
    border-radius: 16rpx;
    background: linear-gradient(135deg, rgba(212, 135, 154, 0.15) 0%, rgba(232, 143, 163, 0.15) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}
.he-cal {
    width: 24rpx;
    height: 22rpx;
    border: 2.5rpx solid #d4879a;
    border-radius: 4rpx;
    position: relative;
}
.he-cal::before {
    content: '';
    position: absolute;
    top: -6rpx;
    left: 3rpx;
    width: 4rpx;
    height: 6rpx;
    background: #d4879a;
    border-radius: 2rpx;
}
.he-cal::after {
    content: '';
    position: absolute;
    top: -6rpx;
    right: 3rpx;
    width: 4rpx;
    height: 6rpx;
    background: #d4879a;
    border-radius: 2rpx;
}
.he-dots {
    position: absolute;
    top: 24rpx;
    left: 14rpx;
    width: 4rpx;
    height: 4rpx;
    background: #d4879a;
    border-radius: 2rpx;
    box-shadow:
        6rpx 0 0 #d4879a,
        0 6rpx 0 #d4879a,
        6rpx 6rpx 0 #d4879a;
}
.he-text {
    display: flex;
    flex-direction: column;
}
.he-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #1c1c1e;
}
.he-desc {
    font-size: 22rpx;
    color: #8e8e93;
    margin-top: 4rpx;
}
.he-arrow {
    font-size: 40rpx;
    color: #d4879a;
    font-weight: 300;
}

/* ===== Record Button ===== */
.record-btn {
    padding: 24rpx;
    background: linear-gradient(135deg, #e88fa3 0%, #d4879a 100%);
    color: #fff;
    border-radius: 24rpx;
    text-align: center;
    font-size: 30rpx;
    font-weight: 500;
    letter-spacing: 2rpx;
    box-shadow: 0 4rpx 20rpx rgba(212, 135, 154, 0.2);
}
.record-btn:active {
    opacity: 0.85;
    transform: scale(0.98);
}

/* ===== Subscribe Card ===== */
.sub-card {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 28rpx;
    background: #fff;
    border-radius: 24rpx;
    box-shadow: 0 4rpx 20rpx rgba(212, 135, 154, 0.08);
    border: 1rpx solid rgba(212, 135, 154, 0.1);
}
.sub-card:active {
    background: rgba(212, 135, 154, 0.03);
}
.sub-bell-icon {
    width: 48rpx;
    height: 48rpx;
    border-radius: 14rpx;
    background: rgba(212, 160, 96, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.sbi-body {
    width: 22rpx;
    height: 20rpx;
    background: #d4a060;
    border-radius: 12rpx 12rpx 0 0;
}
.sbi-clapper {
    width: 8rpx;
    height: 5rpx;
    background: #d4a060;
    border-radius: 0 0 4rpx 4rpx;
}
.sub-body {
    flex: 1;
}
.sub-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #1c1c1e;
    display: block;
}
.sub-desc {
    font-size: 22rpx;
    color: #8e8e93;
    display: block;
    margin-top: 4rpx;
}
.sub-status {
    font-size: 24rpx;
    color: #8e8e93;
    flex-shrink: 0;
}
.sub-status.on {
    color: #a8c5a0;
}

/* ===== Modal ===== */
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.modal-body {
    width: 100%;
    background: #fff;
    border-radius: 32rpx 32rpx 0 0;
    padding: 40rpx 32rpx 60rpx;
}
.modal-title {
    font-size: 36rpx;
    font-weight: 700;
    color: #d4879a;
    display: block;
    text-align: center;
    margin-bottom: 32rpx;
}
.m-info {
    display: flex;
    align-items: center;
    padding: 16rpx 0;
}
.m-label {
    font-size: 26rpx;
    color: #8e8e93;
    width: 120rpx;
    flex-shrink: 0;
}
.m-value {
    font-size: 28rpx;
    color: #1c1c1e;
    flex: 1;
}
.m-btn {
    padding: 24rpx;
    border-radius: 20rpx;
    text-align: center;
    margin-top: 16rpx;
    font-size: 30rpx;
    font-weight: 500;
    letter-spacing: 1rpx;
}
.m-btn.primary {
    background: linear-gradient(135deg, #e88fa3 0%, #d4879a 100%);
    color: #fff;
}
.m-btn.secondary {
    background: rgba(212, 135, 154, 0.08);
    color: #3a3a3c;
}
.m-btn.danger {
    background: rgba(255, 59, 48, 0.08);
    color: #ff3b30;
}
.m-btn:active {
    opacity: 0.8;
}
.m-cancel {
    padding: 20rpx;
    text-align: center;
    margin-top: 16rpx;
}
.m-cancel text {
    font-size: 28rpx;
    color: #8e8e93;
}

/* ===== Skeleton ===== */
.skeleton-card {
    background: #fff;
    border-radius: 24rpx;
    padding: 28rpx;
    margin-bottom: 16rpx;
}
.skeleton-bar {
    height: 32rpx;
    background: linear-gradient(90deg, #fce8ef 25%, #fdf0f8 50%, #fce8ef 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8rpx;
    margin-bottom: 16rpx;
}
.skeleton-line {
    height: 24rpx;
    background: linear-gradient(90deg, #fce8ef 25%, #fdf0f8 50%, #fce8ef 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8rpx;
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
    padding: 40rpx 28rpx 80rpx;
}
.empty-card {
    background: #fff;
    border-radius: 32rpx;
    padding: 60rpx 40rpx;
    text-align: center;
    box-shadow: 0 4rpx 24rpx rgba(212, 135, 154, 0.1);
    border: 1rpx solid rgba(212, 135, 154, 0.1);
}
.empty-emoji {
    font-size: 80rpx;
    display: block;
    margin-bottom: 24rpx;
}
.empty-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #1c1c1e;
    display: block;
    margin-bottom: 12rpx;
}
.empty-desc {
    font-size: 26rpx;
    color: #c7c7cc;
    display: block;
    margin-bottom: 40rpx;
}

.bottom-space {
    height: 80rpx;
}
</style>
