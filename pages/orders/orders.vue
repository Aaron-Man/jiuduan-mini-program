<template>
    <page-bg overlay="light" tone="butter" />
    <scroll-view
        scroll-y
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage }"
        refresher-enabled
        refresher-default-style="black"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <!-- 杂志式标题区 -->
        <view class="hero ui-fade-up">
            <text class="ui-eyebrow">ORDERS</text>
            <text class="ui-title hero-title">点菜单</text>
            <text class="ui-sub hero-sub">{{ dateFilteredOrders.length }} 份订单 · {{ stats.pending + stats.cooking }} 份待出餐</text>
        </view>

        <!-- 统计概览 -->
        <view class="stats-row ui-fade-up ui-d1">
            <view class="stat-item">
                <text class="stat-num">{{ stats.pending + stats.cooking }}</text>
                <view class="stat-label-row"><view class="stat-dot stat-dot--active"></view><text class="stat-label">进行中</text></view>
            </view>
            <view class="stat-divider"></view>
            <view class="stat-item">
                <text class="stat-num done">{{ stats.done }}</text>
                <view class="stat-label-row"><view class="stat-dot stat-dot--done"></view><text class="stat-label">已完成</text></view>
            </view>
            <view class="stat-divider"></view>
            <view class="stat-item">
                <text class="stat-num total">{{ dateFilteredOrders.length }}</text>
                <view class="stat-label-row"><view class="stat-dot"></view><text class="stat-label">全部</text></view>
            </view>
        </view>

        <!-- 日期分段 -->
        <view class="segment-row ui-fade-up ui-d2">
            <view
                class="segment-item"
                :class="{ active: dateRange === r.key }"
                v-for="r in dateRanges"
                :key="r.key"
                @tap="dateRange = r.key"
            >
                <text>{{ r.label }}</text>
            </view>
        </view>

        <!-- 状态筛选 -->
        <view class="filter-row ui-fade-up ui-d3">
            <scroll-view scroll-x class="filter-scroll">
                <view class="filter-tag" :class="{ active: filter === '' }" @tap="filter = ''">
                    全部 {{ dateFilteredOrders.length }}
                </view>
                <view
                    class="filter-tag"
                    :class="{ active: filter === key }"
                    v-for="(val, key) in ORDER_STATUS_MAP"
                    :key="key"
                    @tap="filter = key"
                >
                    {{ val.label }} <text v-if="getStatusCount(key) > 0">{{ getStatusCount(key) }}</text>
                </view>
            </scroll-view>
        </view>

        <!-- 订单列表 -->
        <view v-if="loading" class="loading-area">
            <view class="skeleton-card" v-for="i in 3" :key="i">
                <view class="skeleton-bar"></view>
                <view class="skeleton-line short"></view>
            </view>
        </view>

        <view v-else-if="filteredByStatus.length === 0" class="empty-area ui-fade-up ui-d3">
            <view class="empty-bubble"><text class="empty-emoji">🍽️</text></view>
            <text class="empty-text">{{ filter ? '该状态暂无订单' : '还没有订单' }}</text>
            <text class="empty-hint" v-if="!filter">去菜谱页面点一道菜吧</text>
        </view>

        <view v-else class="group">
            <view class="section-head ui-fade-up ui-d3">
                <text class="ui-eyebrow">TICKETS</text>
                <text class="group-label">订单列表</text>
            </view>
            <view
                class="order-row ui-fade-up"
                :class="['order-row--' + order.status, idx < 6 ? 'ui-d' + (idx + 1) : 'ui-d6']"
                v-for="(order, idx) in filteredByStatus"
                :key="order._id"
            >
                <!-- 左侧状态条 -->
                <view class="status-bar" :class="'bar-' + order.status"></view>
                <!-- 主体 -->
                <view class="order-body">
                    <view class="order-top">
                        <text class="order-time">{{ formatDateTime(order.createTime) }}</text>
                        <view class="status-pill" :class="'pill-' + order.status">
                            <text>{{ ORDER_STATUS_MAP[order.status]?.label || order.status }}</text>
                        </view>
                    </view>
                    <text class="order-name">{{ order.dishName || '未知菜品' }}</text>
                    <text class="order-note" v-if="order.note">“{{ order.note }}”</text>
                </view>
                <!-- 操作 -->
                <view class="order-ops">
                    <view
                        class="op-next ui-press"
                        v-if="getNextStatus(order.status)"
                        @tap="handleStatusChange(order._id, getNextStatus(order.status))"
                    >
                        <text>{{ getNextStatus(order.status) === 'cooking' ? '开始' : '完成' }}</text>
                    </view>
                    <view class="op-more ui-press" @tap="showActionSheet(order)">
                        <text>···</text>
                    </view>
                </view>
            </view>
        </view>

        <view class="bottom-space"></view>
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
    callFunction,
    formatRelativeTime,
    sendNotificationToAll,
    requestSubscribeFor,
    useSharedBg,
    getPCache,
    setPCache,
    clearPCache,
} from '../../utils/cloud'
import { ORDER_STATUS_MAP } from '../../utils/constants'
import { confirmDelete, handleLoadError } from '../../utils/contentActions'

const orders = ref([])
const loading = ref(true)
const filter = ref('')
const dateRange = ref('all')
const refreshing = ref(false)

// 背景从全局共享状态读取
const { bgImage } = useSharedBg()

const dateRanges = [
    { key: 'today', label: '今天' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'all', label: '全部' },
]

onShow(() => {
    // 缓存优先：先快速显示缓存
    const cached = getPCache('orders')
    if (cached) {
        orders.value = cached
        loading.value = false
    }
    fetchOrders()
})

const onRefresh = async () => {
    refreshing.value = true
    await fetchOrders()
    refreshing.value = false
}

const fetchOrders = async () => {
    try {
        const res = await callFunction('order', { action: 'listOrders' })
        if (!Array.isArray(res?.data)) throw new Error(res?.msg || '加载订单失败')
        const data = res.data
        orders.value = data
        setPCache('orders', data)
    } catch (e) {
        handleLoadError(e, orders.value.length > 0)
    } finally {
        loading.value = false
    }
}

const dateFilteredOrders = computed(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return orders.value.filter(o => {
        const d = new Date(o.createTime)
        switch (dateRange.value) {
            case 'today':
                return d >= today
            case 'week':
                return d >= new Date(today.getTime() - 7 * 86400000)
            case 'month':
                return d >= new Date(today.getTime() - 30 * 86400000)
            default:
                return true
        }
    })
})

const filteredByStatus = computed(() => {
    return filter.value ? dateFilteredOrders.value.filter(o => o.status === filter.value) : dateFilteredOrders.value
})

const stats = computed(() => {
    const list = dateFilteredOrders.value
    return {
        pending: list.filter(o => o.status === 'pending').length,
        cooking: list.filter(o => o.status === 'cooking').length,
        done: list.filter(o => o.status === 'done').length,
    }
})

const getStatusCount = status => {
    return dateFilteredOrders.value.filter(o => o.status === status).length
}

const getNextStatus = current => {
    const flow = { pending: 'cooking', cooking: 'done' }
    return flow[current] || null
}

const handleStatusChange = async (id, status, { subscribe = true } = {}) => {
    // 状态变更前先请求订阅授权，确保用户能收到后续每次变更的通知。
    // 订阅弹窗只能在用户点击事件中同步发起，从 ActionSheet 回调进入时不能调用（会被微信拒绝）
    if (subscribe) requestSubscribeFor('order')
    clearPCache('orders')
    try {
        const order = orders.value.find(o => o._id === id)
        await callFunction('order', { action: 'updateOrderStatus', id, status })
        uni.vibrateShort({ type: 'light' })
        fetchOrders()
        // 通知其他用户订单状态变更
        if (order) {
            const currentUser = uni.getStorageSync('auth_user')
            const statusLabel = ORDER_STATUS_MAP[status]?.label || status
            sendNotificationToAll(
                'order_update',
                currentUser?._id,
                {
                    dishName: order.dishName || '菜品',
                    status: status,
                    note: `状态已更新为${statusLabel}`,
                },
                '/pages/orders/orders'
            )
        }
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    }
}

const showActionSheet = order => {
    const items = []
    if (order.status !== 'pending' && order.status !== 'cancelled') {
        items.push('撤销到上一步')
    }
    if (order.status === 'pending') {
        items.push('直接完成')
    }
    if (order.status !== 'cancelled' && order.status !== 'done') {
        items.push('取消订单')
    }
    items.push('删除订单')

    uni.showActionSheet({
        itemList: items,
        success: async res => {
            const action = items[res.tapIndex]
            if (action === '撤销到上一步') {
                const reverse = { cooking: 'pending', done: 'cooking' }
                const prev = reverse[order.status]
                if (prev) await handleStatusChange(order._id, prev, { subscribe: false })
            } else if (action === '直接完成') {
                await handleStatusChange(order._id, 'done', { subscribe: false })
            } else if (action === '取消订单') {
                await handleStatusChange(order._id, 'cancelled', { subscribe: false })
            } else if (action === '删除订单') {
                handleDelete(order._id)
            }
        },
    })
}

const handleDelete = id =>
    confirmDelete({
        content: '确定删除这条订单？',
        remove: async () => {
            const res = await callFunction('order', { action: 'deleteOrder', id })
            if (res?.code) throw new Error(res.msg)
        },
        cacheKeys: 'orders',
        onDone: fetchOrders,
    })

const formatDateTime = t => formatRelativeTime(t)
</script>

<style scoped>
.page-scroll {
    height: 100vh;
    background: transparent;
}
.page-scroll--transparent {
    background: transparent;
}

/* Hero */
.hero {
    padding: 48rpx 40rpx 8rpx;
    display: flex;
    flex-direction: column;
}
.hero-title {
    display: block;
    margin-top: 12rpx;
    font-size: 64rpx;
    letter-spacing: 0.02em;
}
.hero-sub {
    display: block;
    margin-top: 12rpx;
    letter-spacing: 0.06em;
}

/* Stats */
.stats-row {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 40rpx 24rpx 36rpx;
    margin: 32rpx 32rpx 0;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.stat-num {
    font-family: var(--font-serif);
    font-size: 72rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.1;
    letter-spacing: -0.02em;
}
.stat-num.done {
    color: var(--ink);
}
.stat-num.total {
    color: var(--ink-2);
    font-style: italic;
}
.stat-label-row {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-top: 12rpx;
}
.stat-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
    background: var(--faint);
}
.stat-dot--active {
    background: var(--peach);
}
.stat-dot--done {
    background: var(--sage);
}
.stat-label {
    font-size: 20rpx;
    color: var(--muted);
    letter-spacing: 0.24em;
    font-weight: 600;
}
.stat-divider {
    width: 1rpx;
    height: 80rpx;
    background: var(--line);
}

/* Segment */
.segment-row {
    display: flex;
    padding: 8rpx;
    margin: 28rpx 32rpx 0;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 999rpx;
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
}
.segment-item {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    font-size: 26rpx;
    color: var(--muted);
    border-radius: 999rpx;
    letter-spacing: 0.08em;
    transition:
        background 0.25s,
        color 0.25s;
}
.segment-item text {
    display: block;
}
.segment-item.active {
    color: #fff;
    font-weight: 600;
    background: var(--ink);
    box-shadow: 0 12rpx 24rpx -12rpx rgba(30, 26, 23, 0.6);
}

/* Filter */
.filter-row {
    padding: 24rpx 0 0;
}
.filter-scroll {
    white-space: nowrap;
    padding: 0 32rpx;
    box-sizing: border-box;
}
.filter-tag {
    display: inline-block;
    padding: 12rpx 28rpx;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 999rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    margin-right: 14rpx;
    border: 1rpx solid var(--line);
    letter-spacing: 0.04em;
}
.filter-tag.active {
    background: var(--ink);
    color: #fff;
    border-color: var(--ink);
}
.filter-tag text {
    font-family: var(--font-serif);
    font-size: 22rpx;
    font-style: italic;
    opacity: 0.7;
    margin-left: 4rpx;
}

/* Group */
.group {
    padding: 40rpx 32rpx 0;
}
.section-head {
    display: flex;
    flex-direction: column;
    padding: 0 8rpx;
    margin-bottom: 20rpx;
}
.group-label {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
    margin-top: 6rpx;
}

/* Skeleton */
.loading-area {
    padding: 32rpx;
}
.skeleton-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    padding: 32rpx;
    margin-bottom: 24rpx;
    box-shadow: var(--shadow-soft);
}
.skeleton-bar {
    height: 32rpx;
    width: 60%;
    background: linear-gradient(90deg, var(--bg-2) 25%, var(--bg) 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 999rpx;
    margin-bottom: 20rpx;
}
.skeleton-line {
    height: 22rpx;
    background: linear-gradient(90deg, var(--bg-2) 25%, var(--bg) 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 999rpx;
}
.skeleton-line.short {
    width: 36%;
}
@keyframes shimmer {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}

/* Empty */
.empty-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 140rpx 0 120rpx;
}
.empty-bubble {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    background: var(--butter);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-soft);
    margin-bottom: 36rpx;
}
.empty-emoji {
    font-size: 88rpx;
}
.empty-text {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
}
.empty-hint {
    font-size: 24rpx;
    color: var(--muted);
    display: block;
    margin-top: 12rpx;
    letter-spacing: 0.06em;
}

/* Order Ticket */
.order-row {
    position: relative;
    display: flex;
    align-items: stretch;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    margin-bottom: 24rpx;
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    overflow: hidden;
}
.order-row--cancelled .order-body,
.order-row--cancelled .order-ops {
    opacity: 0.55;
}
.order-row--cancelled .order-name {
    text-decoration: line-through;
    color: var(--muted);
}

/* Status Bar */
.status-bar {
    width: 12rpx;
    flex-shrink: 0;
}
.bar-pending {
    background: var(--butter);
}
.bar-cooking {
    background: var(--peach);
}
.bar-done {
    background: var(--sage);
}
.bar-cancelled {
    background: var(--faint);
}

/* Order Body */
.order-body {
    flex: 1;
    padding: 28rpx 24rpx 28rpx 28rpx;
    min-width: 0;
}
.order-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10rpx;
}
.order-time {
    font-size: 20rpx;
    color: var(--muted);
    letter-spacing: 0.16em;
}
.status-pill {
    padding: 6rpx 20rpx;
    border-radius: 999rpx;
    font-size: 20rpx;
    font-weight: 600;
    letter-spacing: 0.08em;
    flex-shrink: 0;
    margin-left: 12rpx;
}
.pill-pending {
    background: var(--butter);
    color: var(--ink);
}
.pill-cooking {
    background: var(--peach);
    color: var(--ink);
}
.pill-done {
    background: var(--sage);
    color: var(--ink);
}
.pill-cancelled {
    background: var(--bg-2);
    color: var(--muted);
}
.order-name {
    display: block;
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.order-note {
    display: block;
    margin-top: 10rpx;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 24rpx;
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Order Ops (ticket stub) */
.order-ops {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24rpx 24rpx;
    gap: 14rpx;
    flex-shrink: 0;
    min-width: 128rpx;
    border-left: 2rpx dashed var(--line);
}
.order-ops::before,
.order-ops::after {
    content: '';
    position: absolute;
    left: -16rpx;
    width: 28rpx;
    height: 28rpx;
    border-radius: 50%;
    background: var(--bg);
}
.order-ops::before {
    top: -14rpx;
}
.order-ops::after {
    bottom: -14rpx;
}
.op-next {
    height: 60rpx;
    line-height: 60rpx;
    padding: 0 28rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-size: 24rpx;
    font-weight: 600;
    white-space: nowrap;
    letter-spacing: 0.12em;
    box-shadow: 0 12rpx 24rpx -12rpx rgba(30, 26, 23, 0.6);
}
.op-more {
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
}
.op-more text {
    font-size: 24rpx;
    color: var(--ink-2);
    letter-spacing: -4rpx;
}

.bottom-space {
    height: 120rpx;
}
</style>
