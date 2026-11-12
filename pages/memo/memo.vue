<template>
    <page-bg tone="butter" />
    <scroll-view
        :scroll-y="!dragging"
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage }"
        refresher-enabled
        refresher-default-style="black"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <!-- 杂志式标题区 -->
        <view class="hero ui-fade-up">
            <view class="hero-text">
                <text class="ui-eyebrow">NOTES</text>
                <text class="ui-title hero-title">备忘</text>
                <text class="ui-sub hero-sub">{{
                    list.length ? list.length + ' 张便签 · 长按可拖动排序' : '记下要一起记住的小事'
                }}</text>
            </view>
            <view class="hero-btn ui-press" :class="{ 'hero-btn--ghost': showForm }" @tap="showForm = !showForm">
                <text>{{ showForm ? '取消' : '+ 新建' }}</text>
            </view>
        </view>

        <!-- 表单 -->
        <view class="group ui-fade-up" v-if="showForm">
            <text class="group-label">{{ editingId ? '编辑备忘' : '新建备忘' }}</text>
            <view class="group-card">
                <view class="cell-v">
                    <textarea class="cell-textarea" v-model="content" placeholder="写下要记住的事..." />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <text class="cell-icon">🎨</text>
                    <view class="color-row">
                        <view
                            v-for="c in MEMO_COLORS"
                            :key="c"
                            class="color-dot"
                            :class="{ active: color === c }"
                            :style="{ background: c }"
                            @tap="color = c"
                        />
                    </view>
                </view>
            </view>
            <view class="submit-btn ui-press" @tap="handleSubmit" :class="{ disabled: submitting || !content.trim() }">
                <text>{{ submitting ? '保存中...' : editingId ? '保存修改' : '保存备忘' }}</text>
            </view>
        </view>

        <!-- 列表 -->
        <view v-if="loading" class="loading-area">
            <view class="skeleton-card" v-for="i in 3" :key="i">
                <view class="skeleton-bar"></view>
                <view class="skeleton-line short"></view>
            </view>
        </view>

        <view v-else-if="list.length === 0" class="empty-area ui-fade-up ui-d2">
            <view class="empty-bubble">
                <text class="empty-emoji">📝</text>
            </view>
            <text class="empty-text">还没有备忘</text>
            <text class="empty-hint">记下重要的事吧</text>
        </view>

        <view v-else class="group">
            <view class="section-head ui-fade-up ui-d1">
                <text class="group-label">全部备忘</text>
                <view class="section-line"></view>
            </view>
            <view class="board">
                <view
                    class="memo-row"
                    v-for="(m, idx) in list"
                    :key="m._id"
                    :class="[idx % 2 ? 'tilt-r' : 'tilt-l', 'ui-d' + Math.min(idx + 1, 6), { dragging: dragIndex === idx }]"
                    :style="
                        dragIndex === idx
                            ? {
                                  transform: 'translateY(' + dragOffset + 'px)',
                                  zIndex: 10,
                                  boxShadow: '0 40rpx 60rpx -24rpx rgba(80,56,36,0.4)',
                              }
                            : {}
                    "
                    @touchstart="onDragStart($event, idx)"
                    @touchmove="onDragMove($event)"
                    @touchend="onDragEnd()"
                >
                    <view class="memo-paper" :style="{ background: m.color || '#fef8e7' }"></view>
                    <view class="memo-tape"></view>
                    <view class="memo-body">
                        <text class="memo-content">{{ m.content }}</text>
                        <view class="memo-bottom">
                            <text class="memo-time">{{ formatDate(m.createTime) }}</text>
                            <view class="memo-actions">
                                <text class="memo-pin" v-if="m.isPinned">📌</text>
                                <text class="memo-act" @tap="editMemo(m)">编辑</text>
                                <text class="memo-act" @tap="togglePin(m)">{{ m.isPinned ? '取消置顶' : '置顶' }}</text>
                                <text
                                    class="memo-act"
                                    :class="{ active: m.showOnHome }"
                                    @tap="handleToggleShowOnHome(m)"
                                    >{{ m.showOnHome ? '★ 首页' : '☆ 首页' }}</text
                                >
                                <text class="memo-act del" @tap="handleDelete(m._id)">删除</text>
                            </view>
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
import { ref, onMounted } from 'vue'
import {
    fetchAllRecords,
    dbUpdate,
    dbAdd,
    formatRelativeTime,
    clearPCache,
    getPCache,
    setPCache,
    useSharedBg,
    requestSubscribeFor,
    sendNotificationToAll,
} from '../../utils/cloud'
import { MEMO_COLORS } from '../../utils/constants'
import { useListDrag, sortByManualOrder } from '../../utils/useDragSort'
import { confirmDelete, toggleShowOnHome, handleLoadError } from '../../utils/contentActions'

const list = ref([])
const loading = ref(true)
const showForm = ref(false)
const content = ref('')
const color = ref(MEMO_COLORS[0])
const submitting = ref(false)
const editingId = ref(null)
const refreshing = ref(false)

const { bgImage } = useSharedBg()

onMounted(() => {
    // 缓存优先：先快速显示
    const cached = getPCache('memos')
    if (cached) {
        list.value = cached
        loading.value = false
    }
    fetchData()
})

const onRefresh = async () => {
    refreshing.value = true
    await fetchData()
    refreshing.value = false
}

const fetchData = async () => {
    try {
        // 置顶在前；同组内按手动排序，未排序的按创建时间倒序
        const sorted = sortByManualOrder(await fetchAllRecords('memos', { orderBy: 'createTime', orderType: 'desc' }))
        const data = [...sorted.filter(m => m.isPinned), ...sorted.filter(m => !m.isPinned)]
        list.value = data
        setPCache('memos', data)
    } catch (e) {
        handleLoadError(e, list.value.length > 0)
    } finally {
        loading.value = false
    }
}

const handleSubmit = async () => {
    if (!content.value.trim() || submitting.value) return
    submitting.value = true
    const isEditing = !!editingId.value
    if (!isEditing) requestSubscribeFor('content')
    clearPCache('memos')
    try {
        if (isEditing) {
            await dbUpdate('memos', editingId.value, { content: content.value.trim(), color: color.value })
        } else {
            await dbAdd('memos', {
                content: content.value.trim(),
                color: color.value,
                isPinned: false,
                sort_order: list.value.length,
                createTime: new Date(),
            })
        }
        const savedText = content.value.trim()
        content.value = ''
        color.value = MEMO_COLORS[0]
        editingId.value = null
        showForm.value = false
        uni.vibrateShort({ type: 'light' })
        uni.showToast({ title: isEditing ? '已更新' : '保存成功', icon: 'success' })
        fetchData()
        if (!isEditing) {
            const currentUser = uni.getStorageSync('auth_user')
            sendNotificationToAll(
                'content_update',
                currentUser?._id,
                {
                    title: '新备忘发布',
                    contentType: '备忘录',
                    summary: savedText.slice(0, 20) || '快来看看吧',
                },
                '/pages/memo/memo'
            )
        }
    } catch (e) {
        uni.showToast({ title: '保存失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}

const editMemo = m => {
    content.value = m.content
    color.value = m.color || MEMO_COLORS[0]
    editingId.value = m._id
    showForm.value = true
}

// --- 拖拽排序 ---
const { dragging, dragIndex, dragOffset, onDragStart, onDragMove, onDragEnd } = useListDrag(list, {
    collection: 'memos',
    orderField: 'manual_order',
})

const togglePin = async m => {
    try {
        await dbUpdate('memos', m._id, { isPinned: !m.isPinned })
        m.isPinned = !m.isPinned
        clearPCache('_homeSpotlight')
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    }
}

const handleToggleShowOnHome = item => toggleShowOnHome('memos', item)

const handleDelete = id =>
    confirmDelete({
        content: '确定删除这条备忘？',
        collection: 'memos',
        id,
        cacheKeys: 'memos',
        onDone: () => {
            list.value = list.value.filter(x => x._id !== id)
        },
    })

const formatDate = t => formatRelativeTime(t)
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
.hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 56rpx 40rpx 36rpx;
}
.hero-text {
    flex: 1;
    min-width: 0;
}
.hero-text .ui-eyebrow {
    display: block;
}
.hero-title {
    display: block;
    margin-top: 12rpx;
    font-size: 76rpx;
    letter-spacing: 0.04em;
}
.hero-sub {
    display: block;
    margin-top: 14rpx;
    letter-spacing: 0.06em;
}
.hero-btn {
    flex-shrink: 0;
    margin-left: 24rpx;
    margin-bottom: 8rpx;
    height: 76rpx;
    line-height: 76rpx;
    padding: 0 36rpx;
    border-radius: 999rpx;
    background: var(--ink);
    color: #fff;
    font-size: 26rpx;
    font-weight: 600;
    letter-spacing: 0.08em;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.hero-btn--ghost {
    background: rgba(255, 255, 255, 0.7);
    color: var(--ink);
    border: 1rpx solid var(--line);
    box-shadow: none;
}

/* 分组 */
.group {
    padding: 0 32rpx;
    margin-bottom: 16rpx;
}
.group-label {
    display: block;
    margin: 0 0 20rpx 8rpx;
    font-size: 20rpx;
    font-weight: 600;
    letter-spacing: 0.32em;
    color: var(--muted);
}
.group-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    overflow: hidden;
}
.section-head {
    display: flex;
    align-items: center;
    gap: 20rpx;
    margin: 8rpx 0 24rpx;
}
.section-head .group-label {
    margin: 0 0 0 8rpx;
}
.section-line {
    flex: 1;
    height: 1rpx;
    background: var(--line);
}

/* 表单 */
.cell-v {
    padding: 32rpx 36rpx;
}
.cell-textarea {
    width: 100%;
    min-height: 200rpx;
    font-size: 30rpx;
    color: var(--ink);
    background: transparent;
    border: none;
    padding: 0;
    box-sizing: border-box;
    line-height: 1.9;
}
.cell-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 36rpx;
}
.cell-h {
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 28rpx 36rpx;
}
.cell-icon {
    width: 64rpx;
    height: 64rpx;
    flex-shrink: 0;
    border-radius: 22rpx;
    background: rgba(245, 227, 179, 0.6);
    text-align: center;
    line-height: 64rpx;
    font-size: 30rpx;
}
.color-row {
    display: flex;
    flex-wrap: wrap;
    gap: 22rpx;
}
.color-dot {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    border: 1rpx solid rgba(30, 26, 23, 0.1);
    box-shadow: 0 6rpx 14rpx -8rpx rgba(80, 56, 36, 0.35);
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
}
.color-dot.active {
    transform: scale(1.12);
    box-shadow: 0 0 0 5rpx #fff, 0 0 0 8rpx var(--ink);
}

.submit-btn {
    margin-top: 32rpx;
    height: 96rpx;
    line-height: 96rpx;
    padding: 0;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    text-align: center;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.1em;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.submit-btn.disabled {
    opacity: 0.35;
}

/* 骨架屏 */
.loading-area {
    padding: 8rpx 32rpx;
}
.skeleton-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    padding: 36rpx;
    margin-bottom: 24rpx;
}
.skeleton-bar,
.skeleton-line {
    background: linear-gradient(90deg, var(--bg-2) 25%, #f8f4ef 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 999rpx;
}
.skeleton-bar {
    height: 30rpx;
    margin-bottom: 20rpx;
}
.skeleton-line {
    height: 22rpx;
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

/* 空状态 */
.empty-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 120rpx 0 120rpx;
}
.empty-bubble {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #fdf3d8 0%, #f5e3b3 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-soft);
    margin-bottom: 40rpx;
}
.empty-emoji {
    font-size: 88rpx;
}
.empty-text {
    font-family: var(--font-serif);
    font-size: 38rpx;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: 0.06em;
}
.empty-hint {
    font-size: 24rpx;
    color: var(--muted);
    margin-top: 12rpx;
    letter-spacing: 0.06em;
}

/* 便签 */
.board {
    padding: 12rpx 8rpx 0;
}
/* 入场只做淡入：倾斜方向随位置变化，避免拖拽换位时重播位移动画 */
@keyframes note-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
.memo-row {
    position: relative;
    margin-bottom: 40rpx;
    padding: 52rpx 40rpx 30rpx;
    border-radius: 10rpx 10rpx 44rpx 10rpx;
    box-shadow:
        0 28rpx 40rpx -28rpx rgba(80, 56, 36, 0.38),
        0 4rpx 10rpx rgba(80, 56, 36, 0.06);
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s;
    animation-name: note-in;
    animation-duration: 0.6s;
    animation-timing-function: ease-out;
    animation-fill-mode: backwards;
}
.memo-row.tilt-l {
    transform: rotate(-1.2deg);
    margin-right: 24rpx;
}
.memo-row.tilt-r {
    transform: rotate(1deg);
    margin-left: 24rpx;
}
.memo-row.dragging {
    opacity: 0.96;
    transition: none;
}
/* 纸张底色（取自每条便签的颜色） */
.memo-paper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: inherit;
    z-index: 0;
}
.memo-paper::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: inherit;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 40%, rgba(120, 90, 50, 0.05) 100%);
    border: 1rpx solid rgba(120, 90, 50, 0.08);
}
/* 顶部胶带 */
.memo-tape {
    position: absolute;
    top: -16rpx;
    left: 50%;
    width: 150rpx;
    height: 40rpx;
    margin-left: -75rpx;
    background: rgba(255, 255, 255, 0.55);
    border-left: 1rpx dashed rgba(120, 90, 50, 0.12);
    border-right: 1rpx dashed rgba(120, 90, 50, 0.12);
    box-shadow: 0 4rpx 10rpx -4rpx rgba(80, 56, 36, 0.18);
    transform: rotate(-2deg);
    z-index: 2;
}
.tilt-r .memo-tape {
    transform: rotate(3deg);
}
.memo-body {
    position: relative;
    z-index: 1;
}
.memo-content {
    display: block;
    font-family: var(--font-serif);
    font-size: 32rpx;
    line-height: 1.85;
    color: var(--ink);
    letter-spacing: 0.02em;
    white-space: pre-wrap;
    word-break: break-all;
}
.memo-bottom {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
    margin-top: 28rpx;
    padding-top: 20rpx;
    border-top: 1rpx dashed rgba(120, 90, 50, 0.18);
}
.memo-time {
    font-size: 20rpx;
    color: var(--muted);
    letter-spacing: 0.12em;
}
.memo-actions {
    display: flex;
    gap: 10rpx;
    align-items: center;
}
.memo-pin {
    font-size: 26rpx;
}
.memo-act {
    font-size: 22rpx;
    color: var(--ink-2);
    padding: 6rpx 16rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.6);
    border: 1rpx solid rgba(30, 26, 23, 0.06);
}
.memo-act.active {
    color: #fff;
    background: var(--ink);
    border-color: var(--ink);
}
.memo-act.del {
    color: var(--coral);
    background: transparent;
    border-color: rgba(224, 122, 95, 0.25);
}

.bottom-space {
    height: calc(120rpx + env(safe-area-inset-bottom));
}
</style>
