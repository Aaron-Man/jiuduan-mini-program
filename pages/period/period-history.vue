<template>
    <page-bg />
    <scroll-view scroll-y class="page-scroll" :class="{ 'page-scroll--transparent': bgImage }">
        <!-- 顶部统计卡片 -->
        <view class="section">
            <view class="summary-card">
                <view class="summary-header">
                    <text class="summary-title">经期概览</text>
                    <text class="summary-count">共 {{ periods.length }} 次记录</text>
                </view>
                <view class="summary-stats">
                    <view class="stat-item">
                        <view class="stat-icon cycle"><view class="si-ring"></view></view>
                        <view class="stat-info">
                            <text class="stat-value">{{ avgCycleLen ? Math.round(avgCycleLen) : '--' }}</text>
                            <text class="stat-label">平均周期(天)</text>
                        </view>
                    </view>
                    <view class="stat-divider"></view>
                    <view class="stat-item">
                        <view class="stat-icon period"><view class="si-drop"></view></view>
                        <view class="stat-info">
                            <text class="stat-value">{{ avgPeriodLen ? Math.round(avgPeriodLen) : '--' }}</text>
                            <text class="stat-label">平均经期(天)</text>
                        </view>
                    </view>
                    <view class="stat-divider"></view>
                    <view class="stat-item">
                        <view class="stat-icon regular" :class="regClass"></view>
                        <view class="stat-info">
                            <text class="stat-value" :class="regClass">{{ regLabel }}</text>
                            <text class="stat-label">规律性</text>
                        </view>
                    </view>
                </view>
            </view>
        </view>

        <!-- 按年月分组的历史记录 -->
        <view class="section" v-for="(group, groupIdx) in groupedHistory" :key="groupIdx">
            <view class="group-header">
                <view class="gh-dot"></view>
                <text class="gh-title">{{ group.label }}</text>
                <text class="gh-count">{{ group.items.length }} 次</text>
            </view>
            <view class="history-cards">
                <view class="history-card" v-for="(p, idx) in group.items" :key="p._id" @tap="onTapRecord(p)">
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
        <view v-if="!loading && periods.length === 0" class="empty-area">
            <view class="empty-card">
                <text class="empty-emoji">📅</text>
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
    background: #f5f0eb;
}
.page-scroll--transparent {
    background: transparent;
}
.section {
    padding: 0 28rpx;
    margin-bottom: 24rpx;
    padding-top: 24rpx;
}

/* 统计卡片 */
.summary-card {
    background: linear-gradient(135deg, #fff 0%, #fdf2f6 100%);
    border-radius: 28rpx;
    padding: 32rpx;
    box-shadow: 0 8rpx 32rpx rgba(212, 135, 154, 0.12);
    border: 2rpx solid rgba(212, 135, 154, 0.15);
}
.summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28rpx;
}
.summary-title {
    font-size: 34rpx;
    font-weight: 700;
    color: #d4879a;
    letter-spacing: 1rpx;
}
.summary-count {
    font-size: 24rpx;
    color: #8e8e93;
}
.summary-stats {
    display: flex;
    align-items: center;
}
.stat-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16rpx;
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
    background: linear-gradient(135deg, rgba(212, 135, 154, 0.15) 0%, rgba(212, 135, 154, 0.08) 100%);
}
.stat-icon.period {
    background: linear-gradient(135deg, rgba(232, 143, 163, 0.15) 0%, rgba(232, 143, 163, 0.08) 100%);
}
.stat-icon.regular {
    background: linear-gradient(135deg, rgba(168, 197, 160, 0.15) 0%, rgba(168, 197, 160, 0.08) 100%);
}
.stat-icon.regular.warn {
    background: linear-gradient(135deg, rgba(212, 165, 116, 0.15) 0%, rgba(212, 165, 116, 0.08) 100%);
}
.stat-icon.regular.bad {
    background: linear-gradient(135deg, rgba(255, 59, 48, 0.15) 0%, rgba(255, 59, 48, 0.08) 100%);
}
.si-ring {
    width: 26rpx;
    height: 26rpx;
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
    width: 18rpx;
    height: 22rpx;
    background: #e88fa3;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
}
.stat-info {
    display: flex;
    flex-direction: column;
}
.stat-value {
    font-size: 36rpx;
    font-weight: 700;
    color: #1c1c1e;
    line-height: 1.2;
}
.stat-value.good {
    color: #a8c5a0;
    font-size: 28rpx;
}
.stat-value.warn {
    color: #d4a574;
    font-size: 28rpx;
}
.stat-value.bad {
    color: #ff3b30;
    font-size: 28rpx;
}
.stat-label {
    font-size: 22rpx;
    color: #8e8e93;
    margin-top: 4rpx;
}
.stat-divider {
    width: 1rpx;
    height: 64rpx;
    background: rgba(212, 135, 154, 0.12);
    margin: 0 12rpx;
}

/* 分组头部 */
.group-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 16rpx;
    padding: 0 8rpx;
}
.gh-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 6rpx;
    background: linear-gradient(135deg, #e88fa3 0%, #d4879a 100%);
}
.gh-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #d4879a;
    flex: 1;
}
.gh-count {
    font-size: 22rpx;
    color: #8e8e93;
}

/* 历史卡片 */
.history-cards {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
}
.history-card {
    background: #fff;
    border-radius: 24rpx;
    padding: 24rpx;
    box-shadow: 0 4rpx 20rpx rgba(212, 135, 154, 0.08);
    border: 1rpx solid rgba(212, 135, 154, 0.1);
    display: flex;
    gap: 20rpx;
}
.history-card:active {
    background: rgba(212, 135, 154, 0.02);
}
.hc-left {
    display: flex;
    align-items: center;
    gap: 12rpx;
    flex-shrink: 0;
}
.hc-date-box {
    width: 80rpx;
    height: 80rpx;
    border-radius: 20rpx;
    background: linear-gradient(135deg, #fdf2f6 0%, #fce8ef 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2rpx solid rgba(212, 135, 154, 0.15);
}
.hc-date-box.active {
    background: linear-gradient(135deg, #e88fa3 0%, #d4879a 100%);
    border-color: transparent;
}
.hc-date-box.active .hc-day,
.hc-date-box.active .hc-month {
    color: #fff;
}
.hc-date-box.end {
    background: #fdf2f6;
}
.hc-day {
    font-size: 32rpx;
    font-weight: 700;
    color: #d4879a;
    line-height: 1;
}
.hc-month {
    font-size: 18rpx;
    color: #8e8e93;
    margin-top: 4rpx;
}
.hc-line {
    width: 8rpx;
    height: 60rpx;
    background: rgba(212, 135, 154, 0.1);
    border-radius: 4rpx;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
}
.hc-line-bar {
    width: 100%;
    background: linear-gradient(180deg, #e88fa3 0%, #d4879a 100%);
    border-radius: 4rpx;
    min-height: 8rpx;
}
.hc-arrow {
    display: flex;
    align-items: center;
}
.hc-arrow-icon {
    font-size: 28rpx;
    color: #d4879a;
    font-weight: 300;
}
.hc-ongoing {
    padding: 8rpx 16rpx;
    background: rgba(212, 135, 154, 0.08);
    border-radius: 12rpx;
}
.hc-ongoing-text {
    font-size: 20rpx;
    color: #d4879a;
    font-weight: 500;
}
.hc-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
}
.hc-tags {
    display: flex;
    gap: 8rpx;
    flex-wrap: wrap;
}
.hc-tag {
    padding: 6rpx 16rpx;
    border-radius: 16rpx;
}
.hc-tag.cycle {
    background: rgba(212, 135, 154, 0.1);
}
.hc-tag.period {
    background: rgba(142, 142, 147, 0.08);
}
.hc-tag text {
    font-size: 22rpx;
    color: #3a3a3c;
}
.hc-note {
    font-size: 24rpx;
    color: #8e8e93;
    line-height: 1.5;
    font-style: italic;
}
.hc-actions {
    display: flex;
    gap: 16rpx;
    margin-top: 4rpx;
}
.hc-action {
    font-size: 22rpx;
    padding: 6rpx 16rpx;
    border-radius: 12rpx;
}
.hc-action.edit {
    color: #d4879a;
    background: rgba(212, 135, 154, 0.08);
}
.hc-action.delete {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.06);
}

/* 空状态 */
.empty-area {
    padding: 80rpx 28rpx;
}
.empty-card {
    background: #fff;
    border-radius: 32rpx;
    padding: 80rpx 40rpx;
    text-align: center;
    box-shadow: 0 4rpx 24rpx rgba(212, 135, 154, 0.1);
    border: 1rpx solid rgba(212, 135, 154, 0.1);
}
.empty-emoji {
    font-size: 100rpx;
    display: block;
    margin-bottom: 24rpx;
}
.empty-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #1c1c1e;
    display: block;
    margin-bottom: 12rpx;
}
.empty-desc {
    font-size: 26rpx;
    color: #c7c7cc;
    display: block;
}

/* 骨架 */
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

.bottom-space {
    height: 80rpx;
}
</style>
