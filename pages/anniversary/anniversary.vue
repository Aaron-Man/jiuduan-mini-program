<template>
    <page-bg tone="rose" />
    <scroll-view scroll-y class="page" :class="{ 'page--transparent': bgImage }">
        <view class="head ui-fade-up">
            <text class="ui-eyebrow">Moments that matter</text>
            <text class="ui-title">纪念日</text>
            <text class="ui-sub">{{ list.length ? `${list.length} 个值得记住的日子` : '把重要的日子都放在这里' }}</text>
        </view>

        <!-- 主卡片：最近的一个日子 -->
        <view v-if="featured" class="hero ui-fade-up ui-d1 ui-press" :style="{ background: themeOf(featured.color).grad }" @tap="openActions(featured)">
            <view class="hero-glow"></view>
            <text class="hero-spark hero-spark--1">✦</text>
            <text class="hero-spark hero-spark--2">✧</text>
            <view class="hero-top">
                <text class="hero-emoji">{{ featured.emoji || '💞' }}</text>
                <text class="hero-type" :style="{ color: themeOf(featured.color).ink }">{{ typeLabel(featured.type) }}</text>
            </view>
            <text class="hero-title" :style="{ color: themeOf(featured.color).ink }">{{ featured.title }}</text>
            <view class="hero-count">
                <text class="hero-prefix" :style="{ color: themeOf(featured.color).ink }">{{ featured.info.prefix }}</text>
                <text class="hero-num ui-serif" v-if="!featured.info.isToday">{{ featured.info.num }}</text>
                <text class="hero-unit" v-if="!featured.info.isToday">天</text>
                <text class="hero-today ui-serif" v-else>Today ✿</text>
            </view>
            <text class="hero-sub" :style="{ color: themeOf(featured.color).ink }">{{ featured.info.sub }}</text>
        </view>

        <!-- 列表 -->
        <view class="list">
            <view
                v-for="(item, idx) in rest"
                :key="item._id"
                class="row ui-card ui-fade-up ui-press"
                :class="'ui-d' + Math.min(idx + 2, 6)"
                @tap="openActions(item)"
            >
                <view class="row-icon" :style="{ background: themeOf(item.color).grad }">
                    <text>{{ item.emoji || '💞' }}</text>
                </view>
                <view class="row-body">
                    <view class="row-title-line">
                        <text class="row-title">{{ item.title }}</text>
                        <text class="row-home" v-if="item.showOnHome">首页</text>
                    </view>
                    <text class="row-sub">{{ typeLabel(item.type) }} · {{ item.info.sub }}</text>
                </view>
                <view class="row-count">
                    <text class="row-prefix">{{ item.info.isToday ? '' : item.info.prefix }}</text>
                    <text class="row-num ui-serif" v-if="!item.info.isToday">{{ item.info.num }}</text>
                    <text class="row-today" v-else>今天</text>
                </view>
            </view>
        </view>

        <view v-if="!loading && list.length === 0" class="empty ui-fade-up">
            <view class="empty-bubble"><text>🗓️</text></view>
            <text class="empty-title ui-serif">每一天都值得被记住</text>
            <text class="empty-hint">在一起的日子、家人的生日、期待的出发</text>
            <view class="ui-btn empty-btn" @tap="openForm()">添加第一个日子</view>
        </view>

        <view class="bottom-space"></view>
    </scroll-view>

    <view class="ui-fab ui-press" @tap="openForm()"><text>＋</text></view>

    <!-- 添加 / 编辑 -->
    <view class="mask" v-if="showForm" @tap="showForm = false">
        <view class="sheet" @tap.stop>
            <view class="sheet-handle"></view>
            <text class="sheet-title ui-serif">{{ form._id ? '编辑日子' : '新的日子' }}</text>

            <input class="field" v-model="form.title" placeholder="名字，例如：在一起、妈妈生日" maxlength="20" />

            <view class="seg">
                <view
                    v-for="t in ANNIVERSARY_TYPES"
                    :key="t.value"
                    class="seg-item"
                    :class="{ active: form.type === t.value }"
                    @tap="form.type = t.value"
                >
                    <text>{{ t.label }}</text>
                </view>
            </view>
            <text class="seg-hint">{{ typeHint }}</text>

            <picker mode="date" :value="form.date" @change="form.date = $event.detail.value">
                <view class="field field--pick">
                    <text :class="{ placeholder: !form.date }">{{ form.date || '选择日期' }}</text>
                    <text class="field-arrow">›</text>
                </view>
            </picker>

            <text class="label">图标</text>
            <view class="emoji-grid">
                <view
                    v-for="e in ANNIVERSARY_EMOJIS"
                    :key="e"
                    class="emoji-cell"
                    :class="{ active: form.emoji === e }"
                    @tap="form.emoji = e"
                    ><text>{{ e }}</text></view
                >
            </view>

            <text class="label">颜色</text>
            <view class="swatches">
                <view
                    v-for="c in THEME_COLORS"
                    :key="c.key"
                    class="swatch"
                    :class="{ active: form.color === c.key }"
                    :style="{ background: c.grad }"
                    @tap="form.color = c.key"
                ></view>
            </view>

            <view class="toggle-row" @tap="form.showOnHome = !form.showOnHome">
                <text>显示在首页</text>
                <view class="toggle" :class="{ on: form.showOnHome }"><view class="toggle-dot"></view></view>
            </view>

            <view class="ui-btn sheet-btn" :class="{ disabled: !canSubmit || submitting }" @tap="submit">
                {{ submitting ? '保存中…' : '保存' }}
            </view>
        </view>
    </view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed, onMounted } from 'vue'
import { fetchAllRecords, dbAdd, dbUpdate, getPCache, setPCache, clearPCache, useSharedBg } from '../../utils/cloud'
import { THEME_COLORS, themeOf, ANNIVERSARY_EMOJIS } from '../../utils/constants'
import { ANNIVERSARY_TYPES, describeAnniversary } from '../../utils/anniversary'
import { confirmDelete, handleLoadError } from '../../utils/contentActions'

const { bgImage } = useSharedBg()

const raw = ref([])
const loading = ref(true)
const showForm = ref(false)
const submitting = ref(false)
const emptyForm = () => ({ _id: '', title: '', type: 'since', date: '', emoji: '💞', color: 'rose', showOnHome: false })
const form = ref(emptyForm())

// 按「最近到来」排序：即将到来的在前，纪念日在后
const list = computed(() =>
    raw.value.map(a => ({ ...a, info: describeAnniversary(a) })).sort((a, b) => a.info.sortKey - b.info.sortKey)
)
const featured = computed(() => list.value[0] || null)
const rest = computed(() => list.value.slice(1))

const typeLabel = t => (ANNIVERSARY_TYPES.find(x => x.value === t) || ANNIVERSARY_TYPES[0]).label
const typeHint = computed(() => (ANNIVERSARY_TYPES.find(x => x.value === form.value.type) || {}).hint || '')
const canSubmit = computed(() => form.value.title.trim() && form.value.date)

const fetchData = async () => {
    try {
        raw.value = await fetchAllRecords('anniversaries', { orderBy: 'createTime', orderType: 'desc' })
        setPCache('anniversaries', raw.value)
    } catch (e) {
        handleLoadError(e, raw.value.length > 0)
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    const cached = getPCache('anniversaries')
    if (cached) {
        raw.value = cached
        loading.value = false
    }
    fetchData()
})

const openForm = item => {
    form.value = item
        ? { _id: item._id, title: item.title, type: item.type || 'since', date: item.date, emoji: item.emoji || '💞', color: item.color || 'rose', showOnHome: !!item.showOnHome }
        : emptyForm()
    showForm.value = true
}

const openActions = item => {
    const actions = ['编辑', item.showOnHome ? '不在首页显示' : '显示在首页', '删除']
    uni.showActionSheet({
        itemList: actions,
        success: async ({ tapIndex }) => {
            if (tapIndex === 0) openForm(item)
            else if (tapIndex === 1) toggleHome(item)
            else if (tapIndex === 2)
                confirmDelete({
                    content: `删除「${item.title}」？`,
                    collection: 'anniversaries',
                    id: item._id,
                    cacheKeys: ['anniversaries', '_homeSpotlight'],
                    onDone: fetchData,
                })
        },
    })
}

const toggleHome = async item => {
    try {
        await dbUpdate('anniversaries', item._id, { showOnHome: !item.showOnHome })
        clearPCache('_homeSpotlight')
        fetchData()
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    }
}

const submit = async () => {
    if (!canSubmit.value || submitting.value) return
    submitting.value = true
    const { _id, ...fields } = form.value
    const data = { ...fields, title: fields.title.trim() }
    try {
        if (_id) await dbUpdate('anniversaries', _id, { ...data, updateTime: new Date() })
        else await dbAdd('anniversaries', { ...data, createTime: new Date() })
        showForm.value = false
        clearPCache('anniversaries')
        clearPCache('_homeSpotlight')
        uni.vibrateShort({ type: 'light' })
        uni.showToast({ title: '已保存', icon: 'success' })
        fetchData()
    } catch (e) {
        uni.showToast({ title: '保存失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
.page {
    height: 100vh;
    background: transparent;
}
.head {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    padding: 40rpx 40rpx 32rpx;
}

/* 主卡片 */
.hero {
    position: relative;
    margin: 0 32rpx 32rpx;
    padding: 44rpx 44rpx 40rpx;
    border-radius: var(--r-xl);
    overflow: hidden;
    box-shadow: var(--shadow);
}
.hero-glow {
    position: absolute;
    top: -120rpx;
    right: -120rpx;
    width: 360rpx;
    height: 360rpx;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0) 70%);
}
.hero-spark {
    position: absolute;
    color: rgba(255, 255, 255, 0.9);
    animation: twinkle 3s ease-in-out infinite;
}
.hero-spark--1 {
    top: 48rpx;
    right: 64rpx;
    font-size: 36rpx;
}
.hero-spark--2 {
    top: 140rpx;
    right: 150rpx;
    font-size: 24rpx;
    animation-delay: 1.2s;
}
@keyframes twinkle {
    0%,
    100% {
        opacity: 0.3;
        transform: scale(0.8);
    }
    50% {
        opacity: 1;
        transform: scale(1.15);
    }
}
.hero-top {
    display: flex;
    align-items: center;
    gap: 16rpx;
}
.hero-emoji {
    font-size: 48rpx;
}
.hero-type {
    font-size: 22rpx;
    letter-spacing: 0.2em;
    padding: 6rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.55);
}
.hero-title {
    display: block;
    margin-top: 24rpx;
    font-size: 34rpx;
    font-weight: 600;
}
.hero-count {
    display: flex;
    align-items: baseline;
    gap: 12rpx;
    margin-top: 8rpx;
}
.hero-prefix {
    font-size: 26rpx;
}
.hero-num {
    font-size: 160rpx;
    line-height: 1;
    font-weight: 700;
    color: var(--ink);
}
.hero-unit {
    font-size: 30rpx;
    color: var(--ink-2);
}
.hero-today {
    font-size: 96rpx;
    color: var(--ink);
    line-height: 1.1;
}
.hero-sub {
    display: block;
    margin-top: 12rpx;
    font-size: 22rpx;
    opacity: 0.85;
}

/* 列表 */
.list {
    padding: 0 32rpx;
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}
.row {
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 28rpx;
}
.row-icon {
    width: 88rpx;
    height: 88rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    flex-shrink: 0;
}
.row-body {
    flex: 1;
    min-width: 0;
}
.row-title-line {
    display: flex;
    align-items: center;
    gap: 12rpx;
}
.row-title {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.row-home {
    font-size: 18rpx;
    padding: 2rpx 12rpx;
    border-radius: 999rpx;
    background: var(--ink);
    color: #fff;
    flex-shrink: 0;
}
.row-sub {
    display: block;
    margin-top: 6rpx;
    font-size: 22rpx;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.row-count {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
}
.row-prefix {
    font-size: 20rpx;
    color: var(--muted);
}
.row-num {
    font-size: 56rpx;
    line-height: 1.05;
    font-weight: 700;
    color: var(--ink);
}
.row-today {
    font-size: 26rpx;
    font-weight: 700;
    color: var(--coral);
}

/* 空状态 */
.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80rpx 48rpx;
    gap: 16rpx;
}
.empty-bubble {
    width: 168rpx;
    height: 168rpx;
    border-radius: 50%;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 72rpx;
    box-shadow: var(--shadow-soft);
}
.empty-title {
    font-size: 40rpx;
    font-weight: 700;
    margin-top: 16rpx;
}
.empty-hint {
    font-size: 24rpx;
    color: var(--muted);
}
.empty-btn {
    margin-top: 24rpx;
}
.bottom-space {
    height: 220rpx;
}

/* 底部弹层 */
.mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(30, 26, 23, 0.35);
    z-index: 200;
    display: flex;
    align-items: flex-end;
}
.sheet {
    width: 100%;
    max-height: 88vh;
    overflow-y: auto;
    background: var(--card-solid);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    padding: 20rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    animation: sheet-up 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes sheet-up {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}
.sheet-handle {
    width: 72rpx;
    height: 8rpx;
    border-radius: 8rpx;
    background: var(--faint);
    margin: 0 auto 24rpx;
}
.sheet-title {
    display: block;
    font-size: 44rpx;
    font-weight: 700;
    margin-bottom: 28rpx;
}
.field {
    height: 96rpx;
    padding: 0 28rpx;
    border-radius: var(--r-m);
    background: var(--bg);
    font-size: 28rpx;
    color: var(--ink);
    margin-bottom: 20rpx;
}
.field--pick {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.placeholder {
    color: var(--faint);
}
.field-arrow {
    font-size: 40rpx;
    color: var(--faint);
}
.seg {
    display: flex;
    padding: 8rpx;
    border-radius: 999rpx;
    background: var(--bg);
}
.seg-item {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    border-radius: 999rpx;
    font-size: 26rpx;
    color: var(--ink-2);
}
.seg-item.active {
    background: var(--ink);
    color: #fff;
    font-weight: 600;
}
.seg-hint {
    display: block;
    font-size: 22rpx;
    color: var(--muted);
    margin: 12rpx 8rpx 20rpx;
}
.label {
    display: block;
    font-size: 22rpx;
    letter-spacing: 0.2em;
    color: var(--muted);
    margin: 12rpx 0 16rpx;
}
.emoji-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
}
.emoji-cell {
    width: 80rpx;
    height: 80rpx;
    border-radius: 24rpx;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    border: 3rpx solid transparent;
}
.emoji-cell.active {
    border-color: var(--ink);
    background: #fff;
}
.swatches {
    display: flex;
    gap: 20rpx;
}
.swatch {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    border: 4rpx solid #fff;
    box-shadow: 0 0 0 2rpx var(--line);
}
.swatch.active {
    box-shadow: 0 0 0 4rpx var(--ink);
}
.toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 32rpx 0 8rpx;
    font-size: 28rpx;
    color: var(--ink);
}
.toggle {
    width: 96rpx;
    height: 56rpx;
    border-radius: 999rpx;
    background: var(--bg-2);
    position: relative;
    transition: background 0.25s;
}
.toggle.on {
    background: var(--ink);
}
.toggle-dot {
    position: absolute;
    top: 6rpx;
    left: 6rpx;
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toggle.on .toggle-dot {
    transform: translateX(40rpx);
}
.sheet-btn {
    margin-top: 36rpx;
}
</style>
