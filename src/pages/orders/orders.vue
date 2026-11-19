<template>
    <page-bg overlay="light" tone="butter" />
    <scroll-view
        scroll-y
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage, 'photo-mode': isPhotoBg }"
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

        <!-- 今日菜单：今天要吃的每一餐和进度 -->
        <view class="today-card photo-glass ui-fade-up ui-d1" v-if="!loading">
            <view class="today-head">
                <text class="ui-eyebrow">TODAY</text>
                <text class="today-title">今日菜单</text>
            </view>
            <view v-if="todayMeals.length === 0" class="today-empty ui-press" @tap="goMenu">
                <text class="today-empty-text">今天还没点菜，去菜谱挑几道吧</text>
                <text class="today-empty-arrow">→</text>
            </view>
            <view class="today-meal" v-for="m in todayMeals" :key="m.key">
                <view class="today-meal-top">
                    <text class="today-meal-slot">{{ m.emoji }} {{ m.label }}</text>
                    <view class="today-counts">
                        <view class="today-count" :class="'today-count--' + st" v-for="st in m.statuses" :key="st">
                            <text>{{ ORDER_STATUS_MAP[st].label }} {{ m.counts[st] }}</text>
                        </view>
                    </view>
                </view>
                <text class="today-meal-dishes">{{ m.names }}</text>
            </view>
        </view>

        <!-- 统计概览 -->
        <view class="stats-row photo-glass ui-fade-up ui-d1">
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
            <view class="skeleton-card photo-glass" v-for="i in 3" :key="i">
                <view class="skeleton-bar"></view>
                <view class="skeleton-line short"></view>
            </view>
        </view>

        <view v-else-if="filteredByStatus.length === 0" class="empty-area ui-fade-up ui-d3 photo-empty">
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
                v-for="(g, gi) in listGroups"
                :key="g.key"
                :class="g.type === 'meal' ? 'meal-group' : 'single-group'"
            >
                <!-- 一餐的批次头：哪天哪一餐、备注、道数份数、整餐操作 -->
                <view
                    v-if="g.type === 'meal'"
                    class="meal-head photo-glass ui-fade-up"
                    :class="gi < 6 ? 'ui-d' + (gi + 1) : 'ui-d6'"
                >
                    <view class="meal-head-main">
                        <text class="meal-title">{{ g.dayLabel }} · {{ g.slotText }}</text>
                        <text class="meal-meta">{{ g.dishCount }} 道 · {{ g.servings }} 份</text>
                        <text class="meal-note" v-if="g.note">“{{ g.note }}”</text>
                    </view>
                    <view class="meal-ops" v-if="g.canStart || g.canFinish">
                        <view class="group-op group-op-start ui-press" v-if="g.canStart" @tap="handleGroupStatus(g, 'cooking')">
                            <text>全部开始</text>
                        </view>
                        <view
                            class="group-op group-op-done ui-press"
                            v-if="g.canFinish"
                            @tap="handleGroupStatus(g, 'done')"
                        >
                            <text>全部完成</text>
                        </view>
                    </view>
                </view>
                <view
                    class="order-row photo-glass ui-fade-up"
                    :class="['order-row--' + order.status, gi < 6 ? 'ui-d' + (gi + 1) : 'ui-d6']"
                    v-for="order in g.orders"
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
                        <view class="order-name-row">
                            <text class="order-name">{{ order.dishName || '未知菜品' }}</text>
                            <text class="order-servings" v-if="order.servings > 1">×{{ order.servings }}</text>
                        </view>
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
        </view>

        <view class="bottom-space"></view>
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
import { slotOf, MEAL_SLOTS } from '../../utils/menu'

const orders = ref([])
const loading = ref(true)
const filter = ref('')
const dateRange = ref('all')
const refreshing = ref(false)

// 背景从全局共享状态读取
const { bgImage, isPhotoBg } = useSharedBg()

const dateRanges = [
    { key: 'today', label: '今天' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'all', label: '全部' },
]

const pad = n => (n < 10 ? '0' + n : '' + n)
const dayKeyOf = t => {
    const d = new Date(t)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// 每次进入页面时刷新「今天」，避免跨过零点后还按昨天统计
const todayKey = ref(dayKeyOf(Date.now()))

onShow(() => {
    todayKey.value = dayKeyOf(Date.now())
    // 缓存优先：先快速显示缓存
    const cached = getPCache('orders')
    if (cached) {
        orders.value = cached
        loading.value = false
    }
    fetchOrders()
})

// 点菜篮下单后会发这个事件；页面已在后台时也能及时刷新
const onOrdersChanged = () => fetchOrders()
onMounted(() => uni.$on('orders:changed', onOrdersChanged))
onUnmounted(() => uni.$off('orders:changed', onOrdersChanged))

const onRefresh = async () => {
    refreshing.value = true
    await fetchOrders()
    refreshing.value = false
}

// 下单后 orders:changed 和 onShow 几乎同时触发，共用同一次请求
let inflight = null
const fetchOrders = () => {
    if (!inflight) inflight = loadOrders().finally(() => (inflight = null))
    return inflight
}

const loadOrders = async () => {
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
    const tomorrow = new Date(today.getTime() + 86400000)
    return orders.value.filter(o => {
        // 按「哪一餐」算日期：昨天点的今天晚餐算今天；旧订单没有用餐日期，按下单时间
        const d = o.meal_date ? new Date(o.meal_date.replace(/-/g, '/')) : new Date(o.createTime)
        switch (dateRange.value) {
            case 'today':
                return d >= today && d < tomorrow
            case 'week': {
                // 本周从周一开始
                const monday = new Date(today)
                monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
                return d >= monday
            }
            case 'month':
                return d >= new Date(today.getFullYear(), today.getMonth(), 1)
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
        const res = await callFunction('order', { action: 'updateOrderStatus', id, status })
        if (res?.code) throw new Error(res.msg)
        // 取消订单会改变菜品的「已点次数」
        clearPCache('menu')
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
        cacheKeys: ['orders', 'menu'],
        onDone: fetchOrders,
    })

const formatDateTime = t => formatRelativeTime(t)

const goMenu = () => uni.switchTab({ url: '/pages/menu/menu' })

// ===== 按餐分组 =====
// 一餐的日期：新订单有 meal_date，旧订单按下单时间
const mealDayOf = o => (/^\d{4}-\d{2}-\d{2}$/.test(o.meal_date || '') ? o.meal_date : dayKeyOf(o.createTime))

const dayLabelOf = key => {
    const [y, m, d] = key.split('-').map(Number)
    const [ty, tm, td] = todayKey.value.split('-').map(Number)
    const diff = Math.round((new Date(y, m - 1, d) - new Date(ty, tm - 1, td)) / 86400000)
    const near = { '-1': '昨天', 0: '今天', 1: '明天', 2: '后天' }[diff]
    if (near) return near
    return y === ty ? `${m}月${d}日` : `${y}年${m}月${d}日`
}

const slotTextOf = key => {
    const s = slotOf(key)
    return s ? `${s.emoji} ${s.label}` : '🍽️ 一餐'
}

// 每个批次的全部订单（不受筛选影响），整餐操作和道数统计都按整批算
const batchMap = computed(() => {
    const map = {}
    for (const o of orders.value) {
        if (!o.batch_id) continue
        ;(map[o.batch_id] = map[o.batch_id] || []).push(o)
    }
    return map
})

const listGroups = computed(() => {
    const groups = []
    const byBatch = {}
    for (const o of filteredByStatus.value) {
        if (!o.batch_id) {
            groups.push({ key: 'o_' + o._id, type: 'single', orders: [o] })
            continue
        }
        if (byBatch[o.batch_id]) {
            byBatch[o.batch_id].orders.push(o)
            continue
        }
        const all = batchMap.value[o.batch_id] || [o]
        const live = all.filter(x => x.status !== 'cancelled')
        const counted = live.length ? live : all
        const g = {
            key: 'b_' + o.batch_id,
            type: 'meal',
            orders: [o],
            all,
            dayLabel: dayLabelOf(mealDayOf(o)),
            slotText: slotTextOf(o.meal_slot),
            note: o.batch_note || '',
            dishCount: counted.length,
            servings: counted.reduce((n, x) => n + (x.servings || 1), 0),
            canStart: all.some(x => x.status === 'pending'),
            canFinish: all.some(x => x.status === 'pending' || x.status === 'cooking'),
        }
        byBatch[o.batch_id] = g
        groups.push(g)
    }
    return groups
})

// 今日菜单：今天要吃的订单按餐次汇总，旧订单（没有餐次）归到「单点」
const todayMeals = computed(() => {
    const buckets = {}
    for (const o of orders.value) {
        if (mealDayOf(o) !== todayKey.value) continue
        const key = slotOf(o.meal_slot) ? o.meal_slot : 'single'
        ;(buckets[key] = buckets[key] || []).push(o)
    }
    const order = [...MEAL_SLOTS.map(s => s.key), 'single']
    return order
        .filter(k => buckets[k])
        .map(k => {
            const list = buckets[k]
            const s = slotOf(k)
            const counts = { pending: 0, cooking: 0, done: 0, cancelled: 0 }
            list.forEach(o => counts[o.status] !== undefined && counts[o.status]++)
            const names = list
                .filter(o => o.status !== 'cancelled')
                .map(o => (o.dishName || '菜品') + (o.servings > 1 ? ' ×' + o.servings : ''))
            return {
                key: k,
                emoji: s ? s.emoji : '🥢',
                label: s ? s.label : '单点',
                counts,
                statuses: Object.keys(counts).filter(st => counts[st] > 0),
                names: names.length ? names.join('、') : '都已取消',
            }
        })
})

// 整餐一起开始 / 完成：逐条调用原有的状态接口，只给家人发一条通知
const groupBusy = ref(false)
const handleGroupStatus = async (group, status) => {
    if (groupBusy.value) return
    const from = status === 'cooking' ? ['pending'] : ['pending', 'cooking']
    const targets = group.all.filter(o => from.includes(o.status))
    if (!targets.length) return
    // 和单条一样，订阅弹窗必须在点击里同步发起
    requestSubscribeFor('order')
    groupBusy.value = true
    clearPCache('orders')
    try {
        const results = await Promise.all(
            targets.map(o =>
                callFunction('order', { action: 'updateOrderStatus', id: o._id, status }).catch(() => ({ code: -1 }))
            )
        )
        const okOrders = targets.filter((o, i) => !results[i]?.code)
        const failed = targets.length - okOrders.length
        if (failed) uni.showToast({ title: `${failed} 道菜更新失败`, icon: 'none' })
        else uni.vibrateShort({ type: 'light' })
        fetchOrders()
        if (okOrders.length) {
            const currentUser = uni.getStorageSync('auth_user')
            const statusLabel = ORDER_STATUS_MAP[status]?.label || status
            const first = okOrders[0].dishName || '菜品'
            sendNotificationToAll(
                'order_update',
                currentUser?._id,
                {
                    dishName: okOrders.length > 1 ? `${first} 等 ${okOrders.length} 道菜` : first,
                    status,
                    note: `${group.dayLabel}${slotOf(group.all[0].meal_slot)?.label || ''}已更新为${statusLabel}`,
                },
                '/pages/orders/orders'
            )
        }
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    } finally {
        groupBusy.value = false
    }
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

/* 今日菜单 */
.today-card {
    margin: 32rpx 32rpx 0;
    padding: 32rpx 32rpx 12rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.today-head {
    display: flex;
    flex-direction: column;
    margin-bottom: 12rpx;
}
.today-title {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 6rpx;
}
.today-empty {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 0 28rpx;
}
.today-empty-text {
    font-size: 26rpx;
    color: var(--ink-2);
    letter-spacing: 0.04em;
}
.today-empty-arrow {
    font-size: 28rpx;
    color: var(--muted);
}
.today-meal {
    padding: 20rpx 0;
    border-top: 1rpx solid var(--line);
}
.today-meal-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
}
.today-meal-slot {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--ink);
    flex-shrink: 0;
}
.today-counts {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10rpx;
}
.today-count {
    padding: 4rpx 16rpx;
    border-radius: 999rpx;
    font-size: 20rpx;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink);
}
.today-count--pending {
    background: var(--butter);
}
.today-count--cooking {
    background: var(--peach);
}
.today-count--done {
    background: var(--sage);
}
.today-count--cancelled {
    background: var(--bg-2);
    color: var(--muted);
}
.today-meal-dishes {
    display: block;
    margin-top: 10rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
/* 数量用正体数字，斜体衬线的「1」很像「/」 */
.filter-tag text {
    font-size: 22rpx;
    font-weight: 600;
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

/* 一餐一组 */
.meal-group {
    margin-bottom: 36rpx;
}
.meal-head {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 24rpx 28rpx;
    margin-bottom: 16rpx;
    background: rgba(255, 255, 255, 0.55);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    box-shadow: var(--shadow-soft);
}
.meal-head-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.meal-title {
    font-family: var(--font-serif);
    font-size: 32rpx;
    font-weight: 700;
    color: var(--ink);
}
.meal-meta {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.08em;
}
.meal-note {
    margin-top: 8rpx;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 24rpx;
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.meal-ops {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
    flex-shrink: 0;
}
.group-op {
    height: 56rpx;
    line-height: 56rpx;
    padding: 0 24rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    letter-spacing: 0.1em;
}
.group-op-start {
    background: var(--peach);
    color: var(--ink);
}
.group-op-done {
    background: var(--ink);
    color: #fff;
}
/* 同一餐的菜卡片挨得近一点，看得出是一组 */
.meal-group .order-row {
    margin-bottom: 14rpx;
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
.order-name-row {
    display: flex;
    align-items: baseline;
    gap: 12rpx;
    min-width: 0;
}
.order-servings {
    flex-shrink: 0;
    font-size: 26rpx;
    font-weight: 700;
    color: var(--coral);
    letter-spacing: 0.04em;
}
.order-name {
    display: block;
    min-width: 0;
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
    font-size: 28rpx;
    font-weight: 700;
    line-height: 1;
    color: var(--ink-2);
    letter-spacing: 0;
    margin-top: -8rpx;
}

.bottom-space {
    height: 120rpx;
}

/* 照片背景：页面样式在 app.wxss 之后加载，同优先级会盖住全局玻璃规则，这里提高一级 */
.photo-mode .photo-glass {
    background: var(--glass);
    border-color: var(--glass-border);
    box-shadow: var(--glass-shadow);
}
/* 直接压在照片上的分组标题、空状态文字改白字 */
.photo-mode .group-label,
.photo-mode .empty-text {
    color: var(--photo-text);
    text-shadow: var(--photo-shadow);
}
.photo-mode .empty-hint {
    color: var(--photo-text-2);
    text-shadow: var(--photo-shadow);
}
/* 照片上的分段控件底和未选中的筛选标签：玻璃底，避免半透明白发灰 */
.photo-mode .segment-row,
.photo-mode .filter-tag {
    background: var(--glass-strong);
    border-color: transparent;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}
.photo-mode .filter-tag.active {
    background: var(--ink);
}
</style>
