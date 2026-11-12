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
        <!-- ===== 标题区 ===== -->
        <view class="hero">
            <!-- 装饰元素 -->
            <view class="hero-deco hero-deco--bean1">🐷</view>
            <view class="hero-deco hero-deco--bean2">&#10047;</view>
            <view class="hero-deco hero-deco--ring"></view>
            <!-- 标题 -->
            <view class="hero-badge">
                <text class="hero-badge-icon">🐷</text>
            </view>
            <text class="hero-title">{{ spaceName }}</text>
            <view class="hero-sub">
                <text class="hero-greeting" v-if="greeting.text">{{ greeting.emoji }} {{ greeting.text }}</text>
                <text class="hero-dot" v-if="greeting.text">·</text>
                <text class="hero-date">{{ todayStr }}</text>
                <text class="hero-dot" v-if="daysTogether > 0">·</text>
                <text class="hero-love" v-if="daysTogether > 0">&#10084; {{ daysTogether }} 天</text>
            </view>
        </view>

        <!-- ===== 聚光灯区 ===== -->
        <view class="section" v-if="spotlightItems.length > 0">
            <view class="section-header">
                <view class="section-title-line"></view>
                <text class="section-title">置顶</text>
                <view class="section-title-line"></view>
            </view>
            <swiper
                class="spotlight-swiper"
                :circular="true"
                :autoplay="false"
                :indicator-dots="spotlightItems.length > 1"
                indicator-color="rgba(196,168,130,0.25)"
                indicator-active-color="#c68b59"
            >
                <swiper-item v-for="(item, idx) in spotlightItems" :key="idx" @tap="goTo(item.path)">
                    <view class="spotlight-card">
                        <!-- 左侧装饰条 -->
                        <view class="spotlight-bar"></view>
                        <view class="spotlight-content">
                            <view class="spotlight-header">
                                <view class="spotlight-source">
                                    <view class="spotlight-source-badge">{{ item.sourceIcon }}</view>
                                    <text class="spotlight-source-name">{{ item.sourceName }}</text>
                                </view>
                                <view class="spotlight-arrow">&#8250;</view>
                            </view>
                            <text class="spotlight-text">{{ item.text }}</text>
                            <text class="spotlight-sub" v-if="item.sub">{{ item.sub }}</text>
                        </view>
                    </view>
                </swiper-item>
            </swiper>
        </view>

        <!-- ===== 功能入口区 ===== -->
        <view class="section">
            <view class="section-header">
                <view class="section-title-line"></view>
                <text class="section-title">功能</text>
                <view class="section-title-line"></view>
            </view>
            <view class="nav-grid">
                <view class="nav-item" v-for="(func, idx) in navItems" :key="func.key" @tap="goTo(func.path)">
                    <view class="nav-icon" :class="'nav-icon--' + (idx % 6)">
                        <text class="nav-icon-text">{{ func.icon }}</text>
                    </view>
                    <text class="nav-name">{{ func.name }}</text>
                </view>
            </view>
        </view>

        <view class="bottom-space"></view>
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { navigateToPage } from '../../utils/constants'
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
    callFunction,
    getGreeting,
    formatRelativeTime,
    getProfile,
    setPCache,
    getPCache,
    clearPCache,
    useSharedBg,
} from '../../utils/cloud'

// 背景从全局共享状态读取，App 启动时已加载，无需每次进入页面重新加载
const { bgImage } = useSharedBg()

const greeting = ref({ text: '', emoji: '' })
const refreshing = ref(false)
const spotlightItems = ref([])

const coupleName = ref('')
const anniversaryDate = ref('')
const daysTogether = computed(() => {
    if (!anniversaryDate.value) return 0
    return Math.floor((Date.now() - new Date(anniversaryDate.value).getTime()) / 86400000)
})
const spaceName = computed(() => coupleName.value || '猪猪')

const navItems = [
    { key: 'status', icon: '🐷', name: '心情', path: '/pages/status/status' },
    { key: 'journal', icon: '📖', name: '日志', path: '/pages/journal/journal' },
    { key: 'period', icon: '🌸', name: '经期', path: '/pages/period/period' },
    { key: 'travel', icon: '🧋', name: '旅行', path: '/pages/travel/travel' },
    { key: 'memo', icon: '🍩', name: '备忘', path: '/pages/memo/memo' },
    { key: 'gallery', icon: '📸', name: '相册', path: '/pages/gallery/gallery' },
]

const todayStr = computed(() => {
    const d = new Date()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
})

let hasLoadedOnce = false

onMounted(() => {
    greeting.value = getGreeting()
    // 首次加载：先显示缓存，再并行拉取新数据
    loadCachedData()
    refreshAll()
    hasLoadedOnce = true
})

onShow(() => {
    // 非首次进入时：清除置顶缓存，强制拉取最新数据
    // 确保在其他页面修改置顶/首页标记后，回到首页立即生效
    if (hasLoadedOnce) {
        clearPCache('_homeSpotlight')
        fetchSpotlight()
    }
})

// 从持久化缓存快速恢复数据
const loadCachedData = () => {
    const cachedProfile = getPCache('_homeProfile')
    if (cachedProfile) {
        coupleName.value = cachedProfile.coupleName || ''
        anniversaryDate.value = cachedProfile.anniversaryDate || ''
    }
    const cachedSpotlight = getPCache('_homeSpotlight')
    if (cachedSpotlight) {
        spotlightItems.value = cachedSpotlight
    }
}

const fetchCoupleProfile = async () => {
    try {
        const p = await getProfile()
        if (p) {
            coupleName.value = p.couple_name || ''
            anniversaryDate.value = p.anniversary_date || ''
            // 缓存到持久化存储
            setPCache('_homeProfile', { coupleName: coupleName.value, anniversaryDate: anniversaryDate.value })
        }
    } catch (e) {
        console.warn('加载空间信息失败:', e)
    }
}

// 并行拉取所有数据（背景由全局共享状态提供，无需在此加载）
const refreshAll = async () => {
    await Promise.all([fetchCoupleProfile(), fetchSpotlight()])
}

const onRefresh = async () => {
    refreshing.value = true
    await refreshAll()
    refreshing.value = false
}

const fetchSpotlight = async () => {
    try {
        const res = await callFunction('db', {
            action: 'batchQueryMarked',
            collections: ['memos', 'statuses', 'journals', 'travels'],
        })
        const data = res?.data || {}
        const memos = data.memos || []
        const statuses = data.statuses || []
        const journals = data.journals || []
        const travels = data.travels || []
        const items = []
        // 备忘：置顶(isPinned) 和 首页显示(showOnHome) 都展示在聚光灯区
        memos.forEach(m => {
            const isPinned = m.isPinned === true
            items.push({
                type: 'memo',
                id: m._id,
                text: m.content,
                sub: isPinned ? '📌 置顶' : formatRelativeTime(m.createTime),
                sourceIcon: '📝',
                sourceName: '备忘',
                path: '/pages/memo/memo',
                isPinned,
            })
        })
        statuses.forEach(s => {
            items.push({
                type: 'status',
                id: s._id,
                text: s.content,
                sub: s.mood ? `${s.mood} · ${formatRelativeTime(s.createTime)}` : formatRelativeTime(s.createTime),
                sourceIcon: '🐷',
                sourceName: '心情',
                path: '/pages/status/status',
            })
        })
        journals.forEach(j => {
            items.push({
                type: 'journal',
                id: j._id,
                text: j.title,
                sub: j.content?.slice(0, 40) || '',
                sourceIcon: '📖',
                sourceName: '日志',
                path: '/pages/journal/journal',
            })
        })
        travels.forEach(t => {
            const dateRange = t.start_date || t.end_date ? `${t.start_date || '?'} ~ ${t.end_date || '?'}` : ''
            items.push({
                type: 'travel',
                id: t._id,
                text: `${t.title}`,
                sub: `📍 ${t.destination}${dateRange ? ' · ' + dateRange : ''}`,
                sourceIcon: '🌍',
                sourceName: '旅行',
                path: '/pages/travel/travel',
            })
        })
        spotlightItems.value = items
        // 缓存聚光灯数据（短 TTL，仅用于首次快速渲染）
        setPCache('_homeSpotlight', items, 60000)
    } catch (e) {
        console.error('首页置顶加载失败:', e)
        // 加载失败时清空置顶区，避免展示过期数据
        spotlightItems.value = []
    }
}

const goTo = url => navigateToPage(url)
</script>

<style scoped>
/* ===== 页面基础 ===== */
.page-scroll {
    height: 100vh;
    background: #f5f0eb;
}
.page-scroll--transparent {
    background: transparent;
}

/* ===== Hero 标题区 ===== */
.hero {
    position: relative;
    padding: 140rpx 48rpx 40rpx;
    text-align: center;
    overflow: hidden;
}
/* 装饰元素 */
.hero-deco {
    position: absolute;
    pointer-events: none;
    opacity: 0.06;
}
.hero-deco--bean1 {
    top: 80rpx;
    left: 40rpx;
    font-size: 120rpx;
    transform: rotate(-20deg);
    color: #3c2413;
}
.hero-deco--bean2 {
    top: 100rpx;
    right: 50rpx;
    font-size: 80rpx;
    transform: rotate(15deg);
    color: #8b6f47;
}
.hero-deco--ring {
    bottom: 10rpx;
    right: -40rpx;
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    border: 40rpx solid #c68b59;
    opacity: 0.04;
}
/* 徽章 */
.hero-badge {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #c68b59 0%, #8b6f47 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24rpx;
    box-shadow: 0 8rpx 32rpx rgba(139, 111, 71, 0.25);
}
.hero-badge-icon {
    font-size: 44rpx;
    filter: brightness(0) invert(1);
}
/* 标题 */
.hero-title {
    font-size: 72rpx;
    font-weight: 800;
    color: #3c2413;
    display: block;
    letter-spacing: 0.12em;
    text-shadow: 0 2rpx 8rpx rgba(60, 36, 19, 0.08);
}
.hero-sub {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    margin-top: 20rpx;
    flex-wrap: wrap;
    padding: 12rpx 24rpx;
    background: rgba(255, 255, 255, 0.45);
    border-radius: 40rpx;
    backdrop-filter: blur(10px);
}
.hero-greeting {
    font-size: 26rpx;
    color: #8b6f47;
}
.hero-dot {
    font-size: 22rpx;
    color: #c4a882;
}
.hero-date {
    font-size: 26rpx;
    color: #8b6f47;
}
.hero-love {
    font-size: 24rpx;
    color: #c68b59;
    font-weight: 600;
}

/* ===== 通用区块 ===== */
.section {
    padding: 0 32rpx 36rpx;
}
.section-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20rpx;
    margin-bottom: 28rpx;
}
.section-title {
    font-size: 26rpx;
    color: #8b6f47;
    font-weight: 600;
    letter-spacing: 4rpx;
}
.section-title-line {
    width: 60rpx;
    height: 1rpx;
    background: linear-gradient(90deg, transparent, rgba(139, 111, 71, 0.3));
}
.section-title-line:last-child {
    background: linear-gradient(90deg, rgba(139, 111, 71, 0.3), transparent);
}

/* ===== 聚光灯区标题 ===== */
.spotlight-swiper {
    height: 186rpx;
}
.spotlight-card {
    display: flex;
    flex-direction: row;
    border-radius: 28rpx;
    overflow: hidden;
    height: 100%;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px);
    box-shadow: 0 8rpx 40rpx rgba(60, 36, 19, 0.06);
}
/* 左侧渐变装饰条 */
.spotlight-bar {
    width: 8rpx;
    flex-shrink: 0;
    background: linear-gradient(180deg, #c68b59 0%, #8b6f47 60%, rgba(139, 111, 71, 0.2) 100%);
    border-radius: 8rpx 0 0 8rpx;
}
.spotlight-content {
    flex: 1;
    padding: 24rpx 28rpx;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
}
.spotlight-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10rpx;
}
.spotlight-source {
    display: flex;
    align-items: center;
    gap: 12rpx;
}
.spotlight-source-badge {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(198, 139, 89, 0.15) 0%, rgba(139, 111, 71, 0.1) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    flex-shrink: 0;
}
.spotlight-source-name {
    font-size: 24rpx;
    color: #8b6f47;
    font-weight: 600;
    letter-spacing: 1rpx;
}
.spotlight-arrow {
    font-size: 40rpx;
    color: #c4a882;
    font-weight: 300;
    line-height: 1;
}
.spotlight-text {
    font-size: 28rpx;
    color: #3c2413;
    display: block;
    line-height: 1.5;
    font-weight: 500;
    word-break: break-all;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.spotlight-sub {
    font-size: 22rpx;
    color: #a08060;
    display: block;
    margin-top: 6rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ===== 功能入口区 ===== */
.nav-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20rpx;
}
.nav-item {
    width: calc(33.333% - 14rpx);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32rpx 0 26rpx;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 28rpx;
    box-shadow: 0 4rpx 20rpx rgba(60, 36, 19, 0.04);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    backdrop-filter: blur(8px);
}
.nav-item:active {
    transform: scale(0.92);
    box-shadow: 0 2rpx 8rpx rgba(60, 36, 19, 0.06);
}
.nav-icon {
    width: 92rpx;
    height: 92rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.nav-icon-text {
    font-size: 40rpx;
}
/* 六个图标各自不同的渐变底色 */
.nav-icon--0 {
    background: linear-gradient(135deg, #d4a574 0%, #c68b59 100%);
}
.nav-icon--1 {
    background: linear-gradient(135deg, #a08060 0%, #8b6f47 100%);
}
.nav-icon--2 {
    background: linear-gradient(135deg, #e8b4b8 0%, #d4908a 100%);
}
.nav-icon--3 {
    background: linear-gradient(135deg, #8bb8a0 0%, #6a9e80 100%);
}
.nav-icon--4 {
    background: linear-gradient(135deg, #b8a88b 0%, #a09070 100%);
}
.nav-icon--5 {
    background: linear-gradient(135deg, #9bb0c4 0%, #7a96b0 100%);
}
.nav-name {
    font-size: 24rpx;
    color: #5c3d2e;
    letter-spacing: 1rpx;
    font-weight: 600;
}

.bottom-space {
    height: 60rpx;
}
</style>
