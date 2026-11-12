<template>
    <page-bg tone="sunset" />
    <scroll-view
        scroll-y
        class="page"
        refresher-enabled
        refresher-default-style="black"
        refresher-background="transparent"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <view class="status-gap" :style="{ height: topGap + 'px' }"></view>

        <!-- ===== 顶部：日期 / 问候 / 家人头像 ===== -->
        <view class="top ui-fade-up">
            <view class="top-left">
                <text class="ui-eyebrow">{{ dateEyebrow }}</text>
                <text class="greet ui-serif">{{ greeting.text }}{{ myName ? '，' + myName : '' }}</text>
            </view>
            <view class="avatars ui-press" @tap="goTo('/pages/members/members')">
                <view v-for="(m, i) in members.slice(0, 4)" :key="m._id" class="avatar" :style="{ zIndex: 10 - i }">
                    <image v-if="m.avatarSrc" :src="m.avatarSrc" class="avatar-img" mode="aspectFill" />
                    <text v-else class="avatar-text">{{ (m.nickname || '家')[0] }}</text>
                </view>
                <view v-if="members.length > 4" class="avatar avatar--more"><text>+{{ members.length - 4 }}</text></view>
            </view>
        </view>

        <!-- ===== 主卡片：在一起的天数 ===== -->
        <view class="love ui-fade-up ui-d1 ui-press" @tap="goTo(daysTogether > 0 ? '/pages/anniversary/anniversary' : '/pages/settings/settings')">
            <view class="love-orb love-orb--1"></view>
            <view class="love-orb love-orb--2"></view>
            <text class="love-heart love-heart--1">♥</text>
            <text class="love-heart love-heart--2">♥</text>
            <text class="love-heart love-heart--3">✦</text>
            <text class="ui-eyebrow love-eyebrow">{{ spaceName }}</text>
            <template v-if="daysTogether > 0">
                <view class="love-count">
                    <text class="love-num ui-serif">{{ daysTogether }}</text>
                    <text class="love-unit">days</text>
                </view>
                <text class="love-caption">在一起的第 {{ daysTogether }} 天</text>
                <view class="love-chip">
                    <text>距第 {{ milestone.target }} 天还有 {{ milestone.remain }} 天</text>
                </view>
            </template>
            <template v-else>
                <text class="love-empty ui-serif">从哪一天开始，我们成了一家人？</text>
                <view class="love-chip"><text>去设置纪念日 ›</text></view>
            </template>
        </view>

        <!-- ===== 每日一句 ===== -->
        <view class="quote ui-card ui-fade-up ui-d2 ui-press" @tap="nextQuote">
            <text class="quote-mark ui-serif">“</text>
            <text class="quote-text ui-serif">{{ quote.text }}</text>
            <view class="quote-foot">
                <text class="quote-origin">— {{ quote.author ? quote.author + ' · ' : '' }}{{ quote.origin }}</text>
                <text class="quote-shuffle">换一句 ↻</text>
            </view>
        </view>

        <!-- ===== 即将到来 ===== -->
        <view class="block ui-fade-up ui-d3" v-if="upcoming.length">
            <view class="block-head">
                <text class="block-title ui-serif">即将到来</text>
                <text class="block-more" @tap="goTo('/pages/anniversary/anniversary')">全部 ›</text>
            </view>
            <scroll-view scroll-x class="hscroll" :show-scrollbar="false">
                <view
                    v-for="u in upcoming"
                    :key="u.key"
                    class="soon ui-press"
                    :style="{ background: u.grad }"
                    @tap="goTo(u.path)"
                >
                    <text class="soon-emoji">{{ u.emoji }}</text>
                    <view class="soon-count">
                        <text class="soon-num ui-serif" v-if="u.days > 0">{{ u.days }}</text>
                        <text class="soon-today ui-serif" v-else>今天</text>
                        <text class="soon-unit" v-if="u.days > 0">天后</text>
                    </view>
                    <text class="soon-title">{{ u.title }}</text>
                </view>
            </scroll-view>
        </view>

        <!-- ===== 便当格：相册 / 心愿 / 胶囊 ===== -->
        <view class="bento ui-fade-up ui-d4">
            <view class="tile tile--photo ui-press" @tap="goTo('/pages/gallery/gallery')">
                <image v-if="coverPhoto" :src="coverPhoto" class="tile-photo" mode="aspectFill" />
                <view v-else class="tile-photo tile-photo--empty"><text>📷</text></view>
                <view class="tile-shade"></view>
                <view class="tile-photo-text">
                    <text class="tile-eyebrow tile-eyebrow--light">Moments</text>
                    <text class="tile-big ui-serif tile-big--light">{{ counts.photos }}</text>
                    <text class="tile-label tile-label--light">张家庭照片</text>
                </view>
            </view>
            <view class="bento-col">
                <view class="tile tile--wish ui-press" @tap="goTo('/pages/wish/wish')">
                    <text class="tile-eyebrow">Wishes</text>
                    <view class="tile-row">
                        <text class="tile-big ui-serif">{{ wishPercent }}<text class="tile-pct">%</text></text>
                        <text class="tile-emoji">🌠</text>
                    </view>
                    <view class="mini-bar"><view class="mini-bar-fill" :style="{ width: wishPercent + '%' }"></view></view>
                    <text class="tile-label">心愿已实现 {{ counts.wishDone }}/{{ counts.wishes }}</text>
                </view>
                <view class="tile tile--capsule ui-press" @tap="goTo('/pages/capsule/capsule')">
                    <text class="tile-eyebrow">Capsule</text>
                    <view class="tile-row">
                        <text class="tile-big ui-serif">{{ counts.capsules }}</text>
                        <text class="tile-emoji">💌</text>
                    </view>
                    <text class="tile-label">封写给未来的信</text>
                </view>
            </view>
        </view>

        <!-- ===== 功能入口 ===== -->
        <view class="apps ui-fade-up ui-d5">
            <view v-for="a in apps" :key="a.key" class="app ui-press" @tap="goTo(a.path)">
                <view class="ui-bubble" :class="'ui-bubble--' + a.color"><text>{{ a.icon }}</text></view>
                <text class="app-name">{{ a.name }}</text>
            </view>
        </view>

        <!-- ===== 置顶 ===== -->
        <view class="block ui-fade-up ui-d5" v-if="spotlightItems.length">
            <view class="block-head">
                <text class="block-title ui-serif">置顶</text>
                <text class="block-sub">{{ spotlightItems.length }} 条</text>
            </view>
            <scroll-view scroll-x class="hscroll" :show-scrollbar="false">
                <view v-for="item in spotlightItems" :key="item.type + item.id" class="pin ui-card ui-press" @tap="goTo(item.path)">
                    <view class="pin-head">
                        <text class="pin-badge">{{ item.sourceIcon }} {{ item.sourceName }}</text>
                        <text class="pin-flag" v-if="item.isPinned">📌</text>
                    </view>
                    <text class="pin-text">{{ item.text }}</text>
                    <text class="pin-sub" v-if="item.sub">{{ item.sub }}</text>
                </view>
            </scroll-view>
        </view>

        <!-- ===== 家人动态 ===== -->
        <view class="block ui-fade-up ui-d6">
            <view class="block-head">
                <text class="block-title ui-serif">家人动态</text>
                <text class="block-more" @tap="goTo('/pages/status/status')">发心情 ›</text>
            </view>
            <view v-if="feed.length" class="feed">
                <view v-for="f in feed" :key="f.key" class="post ui-card ui-press" @tap="goTo(f.path)">
                    <view class="post-head">
                        <view class="post-avatar">
                            <image v-if="f.avatar" :src="f.avatar" class="avatar-img" mode="aspectFill" />
                            <text v-else>{{ f.icon }}</text>
                        </view>
                        <view class="post-who">
                            <text class="post-name">{{ f.name }}</text>
                            <text class="post-meta">{{ f.kind }} · {{ f.time }}</text>
                        </view>
                        <text class="post-mood" v-if="f.mood">{{ f.mood }}</text>
                    </view>
                    <text class="post-title ui-serif" v-if="f.title">{{ f.title }}</text>
                    <text class="post-text" v-if="f.text">{{ f.text }}</text>
                    <image v-if="f.image" :src="f.image" class="post-image" mode="aspectFill" lazy-load />
                </view>
            </view>
            <view v-else class="feed-empty ui-card">
                <text class="feed-empty-emoji">🌿</text>
                <text class="feed-empty-text">今天还很安静，发一条心情打个招呼吧</text>
            </view>
        </view>

        <view class="bottom-space"></view>
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { navigateToPage, MOOD_OPTIONS, themeOf } from '../../utils/constants'
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
    callFunction,
    getGreeting,
    formatRelativeTime,
    getProfile,
    getTempFileURL,
    resolveFileUrls,
    setPCache,
    getPCache,
    clearPCache,
} from '../../utils/cloud'
import { describeAnniversary, nextMilestone, parseDate, diffDays } from '../../utils/anniversary'
import { quotes } from '../../data/quotes'

// 自定义导航：顶部留出状态栏 / 胶囊按钮的高度
const topGap = (() => {
    try {
        const rect = uni.getMenuButtonBoundingClientRect()
        if (rect && rect.bottom) return rect.bottom + 4
    } catch (e) {}
    try {
        return (uni.getSystemInfoSync().statusBarHeight || 20) + 12
    } catch (e) {
        return 32
    }
})()

const greeting = ref(getGreeting())
const refreshing = ref(false)
const myName = ref((uni.getStorageSync('auth_user') || {}).nickname || '')

const coupleName = ref('')
const anniversaryDate = ref('')
const members = ref([])
const anniversaries = ref([])
const travels = ref([])
const spotlightItems = ref([])
const feed = ref([])
const coverPhoto = ref('')
const counts = ref({ photos: 0, wishes: 0, wishDone: 0, capsules: 0 })

const spaceName = computed(() => coupleName.value || 'Our little home')
const daysTogether = computed(() => {
    if (!anniversaryDate.value) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.max(diffDays(parseDate(anniversaryDate.value), today) + 1, 0)
})
const milestone = computed(() => nextMilestone(daysTogether.value))
const wishPercent = computed(() => (counts.value.wishes ? Math.round((counts.value.wishDone / counts.value.wishes) * 100) : 0))

const dateEyebrow = computed(() => {
    const d = new Date()
    const w = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]
    return `${w} · ${m} ${d.getDate()}`
})

// 每日一句：按日期固定，点击可以换一句
const dayIndex = Math.floor(Date.now() / 86400000)
const quoteIdx = ref(dayIndex % quotes.length)
const quote = computed(() => quotes[quoteIdx.value] || { text: '', origin: '' })
const nextQuote = () => {
    quoteIdx.value = (quoteIdx.value + 1 + Math.floor(Math.random() * 7)) % quotes.length
}

const apps = [
    { key: 'status', icon: '🫧', name: '心情', color: 'peach', path: '/pages/status/status' },
    { key: 'journal', icon: '📖', name: '日志', color: 'lilac', path: '/pages/journal/journal' },
    { key: 'travel', icon: '✈️', name: '旅行', color: 'sky', path: '/pages/travel/travel' },
    { key: 'memo', icon: '📝', name: '备忘', color: 'butter', path: '/pages/memo/memo' },
    { key: 'anniversary', icon: '🗓️', name: '纪念日', color: 'rose', path: '/pages/anniversary/anniversary' },
    { key: 'period', icon: '🌸', name: '经期', color: 'rose', path: '/pages/period/period' },
    { key: 'menu', icon: '🍳', name: '菜谱', color: 'peach', path: '/pages/menu/menu' },
    { key: 'members', icon: '👨‍👩‍👧', name: '家人', color: 'sage', path: '/pages/members/members' },
]

// 即将到来：纪念日（倒数 / 每年）+ 计划中的旅行，60 天以内
const upcoming = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const list = []
    anniversaries.value.forEach(a => {
        if (a.type !== 'countdown' && a.type !== 'yearly') return
        const info = describeAnniversary(a, today)
        if (info.prefix === '已经过去' || info.num > 60) return
        list.push({ key: 'a' + a._id, emoji: a.emoji || '🗓️', title: a.title, days: info.num, grad: themeOf(a.color).grad, path: '/pages/anniversary/anniversary' })
    })
    travels.value.forEach(t => {
        if (!t.start_date || t.status === 'completed') return
        const days = diffDays(today, parseDate(t.start_date))
        if (days < 0 || days > 60) return
        list.push({ key: 't' + t._id, emoji: '✈️', title: t.title || t.destination, days, grad: themeOf('sky').grad, path: '/pages/travel/travel' })
    })
    return list.sort((a, b) => a.days - b.days)
})

const moodEmoji = label => (MOOD_OPTIONS.find(m => m.label === label) || {}).emoji || ''

// ===== 数据加载 =====
const query = (collection, extra = {}) =>
    callFunction('db', { action: 'query', collection, withCount: false, ...extra }).then(r => (Array.isArray(r?.data) ? r.data : []))

const loadProfile = async () => {
    const p = await getProfile()
    if (p) {
        coupleName.value = p.couple_name || ''
        anniversaryDate.value = p.anniversary_date || ''
    }
}

const loadMembers = async () => {
    const res = await callFunction('auth', { action: 'listMembers' })
    const list = res?.success ? res.members || [] : []
    const ids = list.map(m => m.avatar_url).filter(u => u && u.startsWith('cloud://'))
    const urls = ids.length ? await getTempFileURL(ids) : []
    const map = {}
    urls.forEach(u => {
        if (u.tempFileURL) map[u.fileID] = u.tempFileURL
    })
    members.value = list.map(m => ({ ...m, avatarSrc: map[m.avatar_url] || (m.avatar_url && !m.avatar_url.startsWith('cloud://') ? m.avatar_url : '') }))
}

const loadCounters = async () => {
    const [annis, trips, wishes, capsules, photos] = await Promise.all([
        query('anniversaries', { limit: 100 }),
        query('travels', { orderBy: 'start_date', orderType: 'asc', limit: 30 }),
        query('wishes', { limit: 100 }),
        callFunction('db', { action: 'batchCount', collections: ['capsules', 'gallery_photos'] }),
        query('gallery_photos', { orderBy: 'createTime', orderType: 'desc', limit: 1 }),
    ])
    anniversaries.value = annis
    travels.value = trips
    const c = capsules?.data || {}
    counts.value = {
        photos: c.gallery_photos || 0,
        capsules: c.capsules || 0,
        wishes: wishes.length,
        wishDone: wishes.filter(w => w.done).length,
    }
    if (photos[0]) {
        await resolveFileUrls(photos, 'fileID', 'displayUrl')
        const f = photos[0].fileID || ''
        coverPhoto.value = photos[0].displayUrl || (f.startsWith('cloud://') ? '' : f)
    }
}

const loadFeed = async () => {
    const [statuses, journals] = await Promise.all([
        query('statuses', { orderBy: 'createTime', orderType: 'desc', limit: 5 }),
        query('journals', { orderBy: 'createTime', orderType: 'desc', limit: 3 }),
    ])
    await resolveFileUrls(statuses, 'imageUrl', 'displayImageUrl')
    const who = openid => members.value.find(m => m.openid && m.openid === openid)
    const items = [
        ...statuses.map(s => ({
            key: 's' + s._id,
            ts: new Date(s.createTime).getTime() || 0,
            kind: '心情',
            icon: '🫧',
            text: s.content,
            mood: moodEmoji(s.mood),
            image: s.displayImageUrl || (s.imageUrl && !s.imageUrl.startsWith('cloud://') ? s.imageUrl : ''),
            path: '/pages/status/status',
            owner: s.owner_openid,
        })),
        ...journals.map(j => ({
            key: 'j' + j._id,
            ts: new Date(j.createTime).getTime() || 0,
            kind: '日志',
            icon: '📖',
            title: j.title,
            text: (j.content || '').slice(0, 60),
            mood: j.mood || '',
            path: '/pages/journal/journal',
            owner: j.owner_openid,
        })),
    ]
    feed.value = items
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 5)
        .map(f => {
            const m = who(f.owner)
            return { ...f, name: m ? m.nickname : '家人', avatar: m ? m.avatarSrc : '', time: formatRelativeTime(f.ts) }
        })
}

const fetchSpotlight = async () => {
    const res = await callFunction('db', { action: 'batchQueryMarked', collections: ['memos', 'statuses', 'journals', 'travels'] })
    const data = res?.data || {}
    const items = []
    ;(data.memos || []).forEach(m =>
        items.push({ type: 'memo', id: m._id, text: m.content, sub: formatRelativeTime(m.createTime), sourceIcon: '📝', sourceName: '备忘', path: '/pages/memo/memo', isPinned: m.isPinned === true })
    )
    ;(data.statuses || []).forEach(s =>
        items.push({ type: 'status', id: s._id, text: s.content, sub: formatRelativeTime(s.createTime), sourceIcon: '🫧', sourceName: '心情', path: '/pages/status/status' })
    )
    ;(data.journals || []).forEach(j =>
        items.push({ type: 'journal', id: j._id, text: j.title, sub: (j.content || '').slice(0, 40), sourceIcon: '📖', sourceName: '日志', path: '/pages/journal/journal' })
    )
    ;(data.travels || []).forEach(t =>
        items.push({ type: 'travel', id: t._id, text: t.title, sub: `📍 ${t.destination || ''}`, sourceIcon: '✈️', sourceName: '旅行', path: '/pages/travel/travel' })
    )
    spotlightItems.value = items
}

const CACHE_KEY = '_home'
const saveCache = () =>
    setPCache(CACHE_KEY, {
        coupleName: coupleName.value,
        anniversaryDate: anniversaryDate.value,
        members: members.value,
        anniversaries: anniversaries.value,
        travels: travels.value,
        spotlightItems: spotlightItems.value,
        feed: feed.value,
        coverPhoto: coverPhoto.value,
        counts: counts.value,
    })

const restoreCache = () => {
    const c = getPCache(CACHE_KEY)
    if (!c) return
    coupleName.value = c.coupleName || ''
    anniversaryDate.value = c.anniversaryDate || ''
    members.value = c.members || []
    anniversaries.value = c.anniversaries || []
    travels.value = c.travels || []
    spotlightItems.value = c.spotlightItems || []
    feed.value = c.feed || []
    coverPhoto.value = c.coverPhoto || ''
    counts.value = c.counts || counts.value
}

const refreshAll = async () => {
    // 各模块互不依赖，单个失败不影响其他模块
    const safe = p => p.catch(e => console.warn('[首页] 加载失败:', e))
    await Promise.all([safe(loadProfile()), safe(loadMembers()), safe(loadCounters()), safe(fetchSpotlight())])
    // 动态需要用成员信息显示头像和昵称
    await safe(loadFeed())
    saveCache()
}

let loadedOnce = false
onMounted(() => {
    restoreCache()
    refreshAll()
    loadedOnce = true
})

onShow(() => {
    greeting.value = getGreeting()
    myName.value = (uni.getStorageSync('auth_user') || {}).nickname || ''
    // 从其他页面返回时刷新（例如刚发了心情、改了纪念日）
    if (loadedOnce) refreshAll()
})

const onRefresh = async () => {
    refreshing.value = true
    clearPCache(CACHE_KEY)
    await refreshAll()
    refreshing.value = false
}

const goTo = url => navigateToPage(url)
</script>

<style scoped>
.page {
    height: 100vh;
    background: transparent;
}

/* 顶部 */
.top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 20rpx 40rpx 28rpx;
}
.top-left {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    min-width: 0;
}
.greet {
    font-size: 48rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.2;
}
.avatars {
    display: flex;
    flex-direction: row;
    padding-left: 20rpx;
}
.avatar {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    margin-left: -20rpx;
    border: 4rpx solid #fff;
    background: var(--grad-dawn);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-soft);
    position: relative;
}
.avatar-img {
    width: 100%;
    height: 100%;
}
.avatar-text {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--ink-2);
}
.avatar--more {
    background: var(--ink);
    color: #fff;
    font-size: 22rpx;
}

/* 主卡片 */
.love {
    position: relative;
    margin: 0 32rpx;
    padding: 48rpx 44rpx 44rpx;
    border-radius: var(--r-xl);
    background: var(--grad-sunset);
    overflow: hidden;
    box-shadow: 0 40rpx 80rpx -36rpx rgba(214, 120, 140, 0.55);
}
.love-orb {
    position: absolute;
    border-radius: 50%;
}
.love-orb--1 {
    width: 420rpx;
    height: 420rpx;
    top: -180rpx;
    right: -120rpx;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 70%);
    animation: orb 8s ease-in-out infinite alternate;
}
.love-orb--2 {
    width: 300rpx;
    height: 300rpx;
    bottom: -140rpx;
    left: -80rpx;
    background: radial-gradient(circle, rgba(255, 236, 214, 0.8) 0%, rgba(255, 236, 214, 0) 70%);
    animation: orb 10s ease-in-out infinite alternate-reverse;
}
@keyframes orb {
    to {
        transform: translate(-40rpx, 30rpx) scale(1.15);
    }
}
.love-heart {
    position: absolute;
    color: rgba(255, 255, 255, 0.85);
    animation: rise 6s ease-in-out infinite;
}
.love-heart--1 {
    right: 72rpx;
    top: 64rpx;
    font-size: 40rpx;
}
.love-heart--2 {
    right: 160rpx;
    top: 150rpx;
    font-size: 24rpx;
    animation-delay: 2s;
}
.love-heart--3 {
    right: 56rpx;
    top: 210rpx;
    font-size: 22rpx;
    animation-delay: 3.5s;
}
@keyframes rise {
    0%,
    100% {
        opacity: 0.35;
        transform: translateY(0) scale(0.9);
    }
    50% {
        opacity: 1;
        transform: translateY(-16rpx) scale(1.1);
    }
}
.love-eyebrow {
    position: relative;
    color: rgba(30, 26, 23, 0.55);
}
.love-count {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 12rpx;
    margin-top: 12rpx;
}
.love-num {
    font-size: 180rpx;
    line-height: 1;
    font-weight: 700;
    color: var(--ink);
}
.love-unit {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 40rpx;
    color: var(--ink-2);
}
.love-caption {
    position: relative;
    display: block;
    font-size: 26rpx;
    color: var(--ink-2);
    margin-top: 8rpx;
}
.love-empty {
    position: relative;
    display: block;
    font-size: 44rpx;
    font-weight: 700;
    line-height: 1.3;
    margin: 20rpx 0 8rpx;
    padding-right: 80rpx;
}
.love-chip {
    position: relative;
    display: inline-flex;
    margin-top: 24rpx;
    padding: 10rpx 24rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.6);
    font-size: 22rpx;
    color: var(--ink-2);
}

/* 每日一句 */
.quote {
    position: relative;
    margin: 28rpx 32rpx 0;
    padding: 40rpx 44rpx 32rpx;
}
.quote-mark {
    position: absolute;
    top: -8rpx;
    left: 28rpx;
    font-size: 140rpx;
    line-height: 1;
    color: rgba(224, 122, 95, 0.25);
}
.quote-text {
    position: relative;
    display: block;
    font-size: 34rpx;
    line-height: 1.6;
    color: var(--ink);
    font-style: italic;
}
.quote-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20rpx;
}
.quote-origin {
    font-size: 22rpx;
    color: var(--muted);
}
.quote-shuffle {
    font-size: 22rpx;
    color: var(--ink-2);
}

/* 区块 */
.block {
    margin-top: 48rpx;
}
.block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 40rpx 20rpx;
}
.block-title {
    font-size: 40rpx;
    font-weight: 700;
    color: var(--ink);
}
.block-more,
.block-sub {
    font-size: 24rpx;
    color: var(--muted);
}
.hscroll {
    white-space: nowrap;
    padding: 0 32rpx;
    box-sizing: border-box;
}

/* 即将到来 */
.soon {
    display: inline-flex;
    flex-direction: column;
    vertical-align: top;
    width: 240rpx;
    height: 260rpx;
    margin-right: 20rpx;
    padding: 28rpx;
    box-sizing: border-box;
    border-radius: var(--r-l);
    box-shadow: var(--shadow-soft);
    white-space: normal;
}
.soon-emoji {
    font-size: 44rpx;
}
.soon-count {
    display: flex;
    align-items: baseline;
    gap: 6rpx;
    margin-top: auto;
}
.soon-num {
    font-size: 72rpx;
    font-weight: 700;
    line-height: 1;
    color: var(--ink);
}
.soon-today {
    font-size: 52rpx;
    font-weight: 700;
    color: var(--coral);
}
.soon-unit {
    font-size: 22rpx;
    color: var(--ink-2);
}
.soon-title {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 便当格 */
.bento {
    display: flex;
    gap: 20rpx;
    margin: 48rpx 32rpx 0;
    height: 440rpx;
}
.bento-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}
.tile {
    position: relative;
    border-radius: var(--r-l);
    overflow: hidden;
    box-shadow: var(--shadow);
    box-sizing: border-box;
}
.tile--photo {
    flex: 1.05;
}
.tile-photo {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
.tile-photo--empty {
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 80rpx;
}
.tile-shade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 60%;
    background: linear-gradient(180deg, rgba(30, 26, 23, 0) 0%, rgba(30, 26, 23, 0.55) 100%);
}
.tile-photo-text {
    position: absolute;
    left: 28rpx;
    bottom: 28rpx;
    display: flex;
    flex-direction: column;
}
.tile--wish,
.tile--capsule {
    flex: 1;
    padding: 24rpx 26rpx;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 1rpx solid var(--card-border);
}
.tile--wish {
    background: linear-gradient(135deg, rgba(227, 241, 230, 0.95) 0%, rgba(207, 227, 243, 0.95) 100%);
}
.tile--capsule {
    background: linear-gradient(135deg, rgba(235, 228, 249, 0.95) 0%, rgba(248, 211, 216, 0.9) 100%);
}
.tile-eyebrow {
    font-size: 18rpx;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(30, 26, 23, 0.5);
    font-weight: 600;
}
.tile-eyebrow--light {
    color: rgba(255, 255, 255, 0.8);
}
.tile-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: auto;
}
.tile-big {
    font-size: 64rpx;
    font-weight: 700;
    line-height: 1.05;
    color: var(--ink);
}
.tile-big--light {
    color: #fff;
    font-size: 80rpx;
}
.tile-pct {
    font-size: 30rpx;
}
.tile-emoji {
    font-size: 40rpx;
}
.tile-label {
    font-size: 20rpx;
    color: var(--ink-2);
    margin-top: 6rpx;
}
.tile-label--light {
    color: rgba(255, 255, 255, 0.9);
    font-size: 22rpx;
}
.mini-bar {
    height: 10rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.7);
    margin-top: 10rpx;
    overflow: hidden;
}
.mini-bar-fill {
    height: 100%;
    border-radius: 999rpx;
    background: var(--ink);
}

/* 功能入口 */
.apps {
    display: flex;
    flex-wrap: wrap;
    margin: 40rpx 24rpx 0;
    padding: 32rpx 8rpx 8rpx;
    border-radius: var(--r-xl);
    background: var(--card);
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
}
.app {
    width: 25%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 28rpx;
}
.app-name {
    font-size: 22rpx;
    color: var(--ink-2);
    letter-spacing: 0.04em;
}

/* 置顶 */
.pin {
    display: inline-flex;
    flex-direction: column;
    vertical-align: top;
    width: 460rpx;
    margin-right: 20rpx;
    padding: 28rpx 30rpx;
    box-sizing: border-box;
    white-space: normal;
}
.pin-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.pin-badge {
    font-size: 20rpx;
    letter-spacing: 0.1em;
    color: var(--muted);
}
.pin-flag {
    font-size: 24rpx;
}
.pin-text {
    margin-top: 12rpx;
    font-size: 28rpx;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.pin-sub {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 动态 */
.feed {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
    padding: 0 32rpx;
}
.post {
    padding: 28rpx 30rpx;
}
.post-head {
    display: flex;
    align-items: center;
    gap: 18rpx;
}
.post-avatar {
    width: 68rpx;
    height: 68rpx;
    border-radius: 50%;
    overflow: hidden;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    flex-shrink: 0;
}
.post-who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.post-name {
    font-size: 26rpx;
    font-weight: 600;
    color: var(--ink);
}
.post-meta {
    font-size: 20rpx;
    color: var(--muted);
}
.post-mood {
    font-size: 40rpx;
}
.post-title {
    display: block;
    margin-top: 18rpx;
    font-size: 34rpx;
    font-weight: 700;
    color: var(--ink);
}
.post-text {
    display: block;
    margin-top: 12rpx;
    font-size: 28rpx;
    line-height: 1.65;
    color: var(--ink-2);
}
.post-image {
    display: block;
    width: 100%;
    height: 380rpx;
    margin-top: 20rpx;
    border-radius: var(--r-m);
}
.feed-empty {
    margin: 0 32rpx;
    padding: 48rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
}
.feed-empty-emoji {
    font-size: 56rpx;
}
.feed-empty-text {
    font-size: 24rpx;
    color: var(--muted);
}
.bottom-space {
    height: 80rpx;
}
</style>
