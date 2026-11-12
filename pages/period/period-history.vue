<template>
    <page-bg tone="rose" />
    <scroll-view scroll-y class="page-scroll" :class="{ 'page-scroll--transparent': bgImage }">
        <!-- 杂志式标题区 -->
        <view class="mast ui-fade-up">
            <text class="ui-eyebrow">CYCLE ARCHIVE</text>
            <text class="ui-title mast-title">历史记录</text>
            <text class="ui-sub mast-sub">按月份整理的每一次经期</text>
        </view>

        <!-- 顶部统计卡片 -->
        <view class="section ui-fade-up ui-d1">
            <view class="summary-card">
                <view class="summary-header">
                    <text class="summary-title">经期概览</text>
                    <text class="summary-count">共 {{ periods.length }} 次记录</text>
                </view>
                <view class="summary-stats">
                    <view class="stat-item">
                        <view class="stat-icon ui-bubble--rose"><text>🌙</text></view>
                        <view class="stat-info">
                            <text class="stat-value">{{ avgCycleLen ? Math.round(avgCycleLen) : '--' }}</text>
                            <text class="stat-label">平均周期(天)</text>
                        </view>
                    </view>
                    <view class="stat-divider"></view>
                    <view class="stat-item">
                        <view class="stat-icon ui-bubble--peach"><text>🌸</text></view>
                        <view class="stat-info">
                            <text class="stat-value">{{ avgPeriodLen ? Math.round(avgPeriodLen) : '--' }}</text>
                            <text class="stat-label">平均经期(天)</text>
                        </view>
                    </view>
                    <view class="stat-divider"></view>
                    <view class="stat-item">
                        <view class="stat-icon regular" :class="regClass"><text>✦</text></view>
                        <view class="stat-info">
                            <text class="stat-value" :class="regClass">{{ regLabel }}</text>
                            <text class="stat-label">规律性</text>
                        </view>
                    </view>
                </view>
            </view>
        </view>

        <!-- 按年月分组的历史记录 -->
        <view
            class="section ui-fade-up"
            :class="'ui-d' + Math.min(groupIdx + 2, 6)"
            v-for="(group, groupIdx) in groupedHistory"
            :key="groupIdx"
        >
            <view class="group-header">
                <view class="gh-dot"></view>
                <text class="gh-title">{{ group.label }}</text>
                <text class="gh-count">{{ group.items.length }} 次</text>
            </view>
            <view class="history-cards">
                <view class="history-card ui-press" v-for="(p, idx) in group.items" :key="p._id" @tap="onTapRecord(p)">
                    <view class="hc-left">
                        <view class="hc-date-box" :class="{ active: !p.endDate }">
                            <text class="hc-day">{{ getDay(p.startDate) }}</text>
                            <text class="hc-month">{{ getMonth(p.startDate) }}月</text>
                        </view>
                        <view class="hc-line" v-if="p.endDate">
                            <view class="hc-line-bar" :style="{ height: getPeriodLen(p) * 12 + 'rpx' }"></view>
                        </view>
                        <view class="hc-arrow" v-if="p.endDate">
                            <text class="hc-arrow-icon">→</text>
                        </view>
                        <view class="hc-date-box end" v-if="p.endDate">
                            <text class="hc-day">{{ getDay(p.endDate) }}</text>
                            <text class="hc-month">{{ getMonth(p.endDate) }}月</text>
                        </view>
                        <view class="hc-ongoing" v-else>
                            <text class="hc-ongoing-text">进行中</text>
                        </view>
                    </view>
                    <view class="hc-right">
                        <view class="hc-tags">
                            <view class="hc-tag cycle" v-if="getCycleLen(p, group.globalIdx + idx)">
                                <text>{{ getCycleLen(p, group.globalIdx + idx) }}天周期</text>
                            </view>
                            <view class="hc-tag period" v-if="getPeriodLen(p)">
                                <text>{{ getPeriodLen(p) }}天经期</text>
                            </view>
                        </view>
                        <text class="hc-note" v-if="p.note">{{ p.note }}</text>
                        <view class="hc-actions">
                            <text class="hc-action edit" @tap.stop="editRecord(p)">编辑</text>
                            <text class="hc-action delete" @tap.stop="deleteRecord(p._id)">删除</text>
                        </view>
                    </view>
                </view>
            </view>
        </view>

        <!-- 空状态 -->
        <view v-if="!loading && periods.length === 0" class="empty-area ui-fade-up ui-d2">
            <view class="empty-card">
                <view class="empty-bubble"><text class="empty-emoji">📅</text></view>
                <text class="empty-title">还没有历史记录</text>
                <text class="empty-desc">记录经期后，这里会显示完整历史</text>
            </view>
        </view>

        <!-- 加载骨架 -->
        <view v-if="loading" class="section">
            <view class="skeleton-card" v-for="i in 3" :key="i">
                <view class="skeleton-bar"></view>
                <view class="skeleton-line short"></view>
            </view>
        </view>

        <view class="bottom-space"></view>

        <!-- 表单弹窗 -->
        <period-form-modal
            v-if="editingRecord"
            :record="editingRecord"
            @close="editingRecord = null"
            @saved="onFormSaved"
        />
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import PeriodFormModal from './components/period-form-modal.vue'
import { ref, computed, onMounted } from 'vue'
import { dbDelete, clearPCache, useSharedBg } from '../../utils/cloud'
import { usePeriodStats } from '../../utils/usePeriodStats'
import { usePeriodData, pad } from '../../utils/usePeriodData'

const { periods, loading, settings, restoreFromCache, fetchData, loadSettings } = usePeriodData()
// 正在编辑的记录（不为空时显示表单弹窗）
const editingRecord = ref(null)

const { avgCycleLen, avgPeriodLen, regLabel, regClass, getCycleLen, getPeriodLen } = usePeriodStats(periods, settings)

const { bgImage } = useSharedBg()

onMounted(() => {
    restoreFromCache()
    fetchData()
    loadSettings()
})

// 工具函数
function getDay(str) {
    return new Date(str).getDate()
}
function getMonth(str) {
    return new Date(str).getMonth() + 1
}

// 按年月分组
const groupedHistory = computed(() => {
    const groups = {}
    periods.value.forEach((p, idx) => {
        const d = new Date(p.startDate)
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
        const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
        if (!groups[key]) groups[key] = { key, label, items: [], globalIdx: idx }
        groups[key].items.push(p)
    })
    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key))
})

// 交互
const onTapRecord = p => editRecord(p)

const editRecord = p => {
    editingRecord.value = p
}
const onFormSaved = async () => {
    editingRecord.value = null
    await fetchData()
}

const deleteRecord = id => {
    uni.showModal({
        title: '确认',
        content: '确定删除这条记录？',
        success: async r => {
            if (!r.confirm) return
            clearPCache('periods')
            try {
                await dbDelete('periods', id)
                await fetchData()
                uni.showToast({ title: '已删除', icon: 'success' })
            } catch (e) {
                uni.showToast({ title: '删除失败', icon: 'none' })
            }
        },
    })
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

/* 标题区 */
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

.section {
    padding: 0 32rpx;
    margin-bottom: 12rpx;
    padding-top: 28rpx;
}

/* 统计卡片 */
.summary-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    padding: 36rpx 32rpx 32rpx;
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.summary-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 32rpx;
}
.summary-title {
    font-family: var(--font-serif);
    font-size: 38rpx;
    font-weight: 700;
    color: var(--ink);
}
.summary-count {
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.06em;
}
.summary-stats {
    display: flex;
    align-items: center;
}
.stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14rpx;
}
.stat-icon {
    width: 72rpx;
    height: 72rpx;
    border-radius: 26rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 32rpx;
}
.stat-icon.regular {
    background: var(--sage);
    color: #4f7a5b;
}
.stat-icon.regular.warn {
    background: var(--butter);
    color: #9a7430;
}
.stat-icon.regular.bad {
    background: rgba(224, 122, 95, 0.18);
    color: var(--coral);
}
.stat-info {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.stat-value {
    font-family: var(--font-serif);
    font-size: 52rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.1;
}
.stat-value.good {
    color: #4f7a5b;
    font-size: 32rpx;
    line-height: 1.6;
}
.stat-value.warn {
    color: #9a7430;
    font-size: 32rpx;
    line-height: 1.6;
}
.stat-value.bad {
    color: var(--coral);
    font-size: 32rpx;
    line-height: 1.6;
}
.stat-label {
    font-size: 20rpx;
    color: var(--muted);
    margin-top: 6rpx;
    letter-spacing: 0.06em;
}
.stat-divider {
    width: 1rpx;
    height: 96rpx;
    background: var(--line);
    margin: 0 8rpx;
}

/* 分组头部 */
.group-header {
    display: flex;
    align-items: baseline;
    gap: 14rpx;
    margin-bottom: 20rpx;
    padding: 0 12rpx;
}
.gh-dot {
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background: linear-gradient(150deg, #f0b7c0 0%, #e595a4 100%);
    align-self: center;
}
.gh-title {
    font-family: var(--font-serif);
    font-size: 34rpx;
    font-weight: 700;
    color: var(--ink);
    flex: 1;
}
.gh-count {
    font-size: 20rpx;
    color: var(--muted);
    letter-spacing: 0.2em;
}

/* 历史卡片 */
.history-cards {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}
.history-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    padding: 28rpx;
    box-shadow: var(--shadow-soft);
    display: flex;
    gap: 24rpx;
}
.hc-left {
    display: flex;
    align-items: center;
    gap: 12rpx;
    flex-shrink: 0;
}
.hc-date-box {
    width: 92rpx;
    height: 92rpx;
    border-radius: 50%;
    background: rgba(235, 178, 184, 0.22);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
.hc-date-box.active {
    background: linear-gradient(150deg, #e895a5 0%, #d6788c 100%);
    box-shadow: 0 14rpx 28rpx -14rpx rgba(214, 120, 140, 0.8);
}
.hc-date-box.active .hc-day,
.hc-date-box.active .hc-month {
    color: #fff;
}
.hc-date-box.end {
    background: rgba(255, 255, 255, 0.85);
    border: 2rpx solid var(--line);
    box-sizing: border-box;
}
.hc-day {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1;
}
.hc-month {
    font-size: 18rpx;
    color: var(--muted);
    margin-top: 4rpx;
}
.hc-line {
    width: 8rpx;
    height: 60rpx;
    background: rgba(30, 26, 23, 0.06);
    border-radius: 999rpx;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
}
.hc-line-bar {
    width: 100%;
    background: linear-gradient(180deg, #f0b7c0 0%, #e595a4 100%);
    border-radius: 999rpx;
    min-height: 8rpx;
}
.hc-arrow {
    display: flex;
    align-items: center;
}
.hc-arrow-icon {
    font-size: 26rpx;
    color: var(--faint);
    font-weight: 300;
}
.hc-ongoing {
    padding: 8rpx 18rpx;
    background: var(--ink);
    border-radius: 999rpx;
}
.hc-ongoing-text {
    font-size: 20rpx;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.1em;
}
.hc-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
}
.hc-tags {
    display: flex;
    gap: 10rpx;
    flex-wrap: wrap;
}
.hc-tag {
    padding: 6rpx 18rpx;
    border-radius: 999rpx;
}
.hc-tag.cycle {
    background: rgba(235, 178, 184, 0.35);
}
.hc-tag.period {
    background: rgba(212, 200, 240, 0.45);
}
.hc-tag text {
    font-size: 22rpx;
    color: var(--ink-2);
}
.hc-note {
    font-family: var(--font-serif);
    font-size: 24rpx;
    color: var(--ink-2);
    line-height: 1.5;
    font-style: italic;
}
.hc-actions {
    display: flex;
    gap: 12rpx;
    margin-top: 4rpx;
}
.hc-action {
    font-size: 22rpx;
    padding: 6rpx 20rpx;
    border-radius: 999rpx;
}
.hc-action.edit {
    color: var(--ink);
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
}
.hc-action.delete {
    color: var(--coral);
}

/* 空状态 */
.empty-area {
    padding: 40rpx 32rpx;
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

/* 骨架 */
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

.bottom-space {
    height: calc(80rpx + env(safe-area-inset-bottom));
}
</style>
