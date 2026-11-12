<template>
    <page-bg tone="lilac" />
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
                <text class="ui-eyebrow">JOURNAL</text>
                <text class="ui-title hero-title">日志</text>
                <text class="ui-sub hero-sub">{{
                    list.length ? '共 ' + list.length + ' 篇 · 写给以后的我们' : '写给以后的我们'
                }}</text>
            </view>
            <view class="hero-btn ui-press" :class="{ 'hero-btn--ghost': showForm }" @tap="showForm = !showForm">
                <text>{{ showForm ? '取消' : '+ 写日志' }}</text>
            </view>
        </view>

        <!-- 表单 -->
        <view class="group ui-fade-up" v-if="showForm">
            <text class="group-label">{{ editingId ? '编辑日志' : '新建日志' }}</text>
            <view class="group-card">
                <view class="cell-h">
                    <text class="cell-icon">📌</text>
                    <input class="cell-input" v-model="title" placeholder="标题" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <textarea
                        class="cell-textarea"
                        v-model="content"
                        placeholder="记录今天发生的事..."
                        :maxlength="LONG_TEXT_MAX"
                    />
                    <text class="char-count" :class="{ 'char-count--full': content.length >= LONG_TEXT_MAX }"
                        >{{ content.length }} / {{ LONG_TEXT_MAX }}</text
                    >
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <text class="cell-icon">😊</text>
                    <scroll-view scroll-x class="mood-scroll">
                        <view class="mood-row">
                            <view
                                v-for="m in MOOD_OPTIONS"
                                :key="m.label"
                                class="mood-chip"
                                :class="{ active: mood === m.label }"
                                @tap="mood = mood === m.label ? '' : m.label"
                            >
                                <text>{{ m.emoji }}</text>
                            </view>
                        </view>
                    </scroll-view>
                </view>
            </view>
            <view class="submit-btn ui-press" @tap="handleSubmit" :class="{ disabled: submitting || !content.trim() }">
                <text>{{ submitting ? '保存中...' : editingId ? '保存修改' : '保存日志' }}</text>
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
                <text class="empty-emoji">📖</text>
            </view>
            <text class="empty-text">还没有日志</text>
            <text class="empty-hint">写下第一篇吧</text>
        </view>

        <view v-else class="group">
            <view class="section-head ui-fade-up ui-d1">
                <text class="group-label">全部日志</text>
                <view class="section-line"></view>
            </view>
            <view class="feed">
                <view
                    class="journal-row"
                    v-for="(j, idx) in list"
                    :key="j._id"
                    :class="['row-in', 'ui-d' + Math.min(idx + 1, 6), { dragging: dragIndex === idx }]"
                    :style="
                        dragIndex === idx
                            ? {
                                  transform: 'translateY(' + dragOffset + 'px)',
                                  zIndex: 10,
                                  boxShadow: '0 32rpx 64rpx -20rpx rgba(80,56,36,0.35)',
                              }
                            : {}
                    "
                    @touchstart="onDragStart($event, idx)"
                    @touchmove="onDragMove($event)"
                    @touchend="onDragEnd()"
                >
                    <view class="journal-meta">
                        <text class="journal-no">No.{{ String(idx + 1).padStart(2, '0') }}</text>
                        <view class="journal-mood" v-if="j.mood">
                            <text>{{ moodEmoji(j.mood) }}</text>
                            <text class="journal-mood-label">{{ j.mood }}</text>
                        </view>
                    </view>
                    <view class="journal-body">
                        <text class="journal-title" @tap.stop="viewDetail(j)"
                            >{{ j.title }}<text class="journal-arrow"> →</text></text
                        >
                        <text class="journal-preview">{{ j.content }}</text>
                        <view class="journal-bottom">
                            <text class="journal-time">{{ formatDate(j.createTime) }}</text>
                            <view class="journal-actions">
                                <text class="journal-act" @tap="editJournal(j)">编辑</text>
                                <text
                                    class="journal-act"
                                    :class="{ active: j.showOnHome }"
                                    @tap="handleToggleShowOnHome(j)"
                                    >{{ j.showOnHome ? '★ 首页' : '☆ 首页' }}</text
                                >
                                <text class="journal-act del" @tap="handleDelete(j._id)">删除</text>
                            </view>
                        </view>
                        <!-- 交互栏 -->
                        <view class="interact-bar">
                            <view class="interact-btn" :class="{ liked: likedByMe[j._id] }" @tap="toggleLike(j)">
                                <text>{{ likedByMe[j._id] ? '❤' : '♡' }}</text>
                                <text v-if="likeCounts[j._id]">{{ likeCounts[j._id] }}</text>
                            </view>
                            <view class="interact-btn" @tap="toggleComments(j._id)">
                                <text>💬</text>
                                <text v-if="commentCounts[j._id]">{{ commentCounts[j._id] }}</text>
                            </view>
                        </view>
                        <!-- 评论区 -->
                        <view class="comment-area" v-if="expandedId === j._id">
                            <view class="comment-item" v-for="c in commentsMap[j._id]" :key="c._id">
                                <view class="comment-body">
                                    <text class="comment-user">{{ c.user_name }}</text>
                                    <text class="comment-text" v-if="c.reply_to_user"
                                        >回复 <text class="comment-reply">@{{ c.reply_to_user }}</text
                                        >：{{ c.content }}</text
                                    >
                                    <text class="comment-text" v-else>{{ c.content }}</text>
                                </view>
                                <text
                                    class="comment-del"
                                    v-if="c.user_id === currentUserId"
                                    @tap="deleteComment(c._id, j._id)"
                                    >×</text
                                >
                            </view>
                            <view class="comment-input-row">
                                <input
                                    class="comment-input"
                                    v-model="commentText"
                                    :placeholder="replyTo ? '回复 ' + replyTo + '...' : '写评论...'"
                                    @confirm="addComment(j._id, commentText, replyTo)"
                                />
                                <view class="comment-send" @tap="addComment(j._id, commentText, replyTo)">发送</view>
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
    getRecord,
    dbUpdate,
    dbAdd,
    formatRelativeTime,
    requestSubscribeFor,
    sendNotificationToAll,
    clearPCache,
    getPCache,
    setPCache,
    useSharedBg,
} from '../../utils/cloud'
import { MOOD_OPTIONS, LONG_TEXT_MAX, EXCERPT_LENGTH } from '../../utils/constants'
import { useInteractions } from '../../utils/useInteractions'
import { useListDrag, sortByManualOrder } from '../../utils/useDragSort'
import { confirmDelete, toggleShowOnHome, handleLoadError } from '../../utils/contentActions'

const list = ref([])
const loading = ref(true)
const showForm = ref(false)
const title = ref('')
const content = ref('')
const mood = ref('')
const submitting = ref(false)
const editingId = ref(null)
const refreshing = ref(false)

const {
    likeCounts,
    likedByMe,
    commentCounts,
    expandedId,
    commentsMap,
    commentText,
    replyTo,
    currentUserId,
    loadInteractions,
    toggleLike,
    toggleComments,
    addComment,
    deleteComment,
} = useInteractions('journal')

const { bgImage } = useSharedBg()

onMounted(() => {
    const u = uni.getStorageSync('auth_user')
    currentUserId.value = u?._id || ''
    // 缓存优先：先快速显示
    const cached = getPCache('journals')
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
        // 列表只需要正文开头一段，长文全文在详情页 / 编辑时再加载
        list.value = sortByManualOrder(await fetchAllRecords('journals', { truncate: { content: EXCERPT_LENGTH } }))
        setPCache('journals', list.value)
        await loadInteractionsData()
    } catch (e) {
        handleLoadError(e, list.value.length > 0)
    } finally {
        loading.value = false
    }
}

const loadInteractionsData = async () => {
    const ids = list.value.map(j => j._id)
    await loadInteractions(ids)
}

const handleSubmit = async () => {
    if (!content.value.trim() || submitting.value) return
    const isEditing = !!editingId.value
    // 订阅必须在用户点击手势中同步调用，放在最前面
    if (!isEditing) requestSubscribeFor('content')
    submitting.value = true
    clearPCache('journals')
    const savedTitle = title.value.trim() || content.value.trim().slice(0, 20)
    const savedContent = content.value.trim()
    const savedMood = mood.value || null
    const savedId = editingId.value
    try {
        if (isEditing) {
            await dbUpdate('journals', savedId, {
                title: savedTitle,
                content: savedContent,
                mood: savedMood,
                updateTime: new Date(),
            })
        } else {
            await dbAdd('journals', {
                title: savedTitle,
                content: savedContent,
                mood: savedMood,
                createTime: new Date(),
            })
        }
        // 先本地更新，再清表单
        if (isEditing) {
            const idx = list.value.findIndex(j => j._id === savedId)
            if (idx >= 0)
                list.value[idx] = {
                    ...list.value[idx],
                    title: savedTitle,
                    content: savedContent.slice(0, EXCERPT_LENGTH),
                    mood: savedMood,
                }
        }
        title.value = ''
        content.value = ''
        mood.value = ''
        editingId.value = null
        showForm.value = false
        uni.vibrateShort({ type: 'medium' })
        uni.showToast({ title: isEditing ? '已更新' : '已保存', icon: 'success' })
        fetchData()
        if (!isEditing) {
            const currentUser = uni.getStorageSync('auth_user')
            sendNotificationToAll(
                'content_update',
                currentUser?._id,
                {
                    title: '新日志发布',
                    contentType: '生活日志',
                    summary: savedTitle.slice(0, 20) || '快来看看吧',
                },
                '/pages/journal/journal'
            )
        }
    } catch (e) {
        console.error('日志保存失败:', e)
        uni.showToast({ title: '保存失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}

const editJournal = async j => {
    let full = j
    // 列表里的长文只有开头一段，编辑前先取全文
    if (j._truncated) {
        uni.showLoading({ title: '加载全文' })
        try {
            full = (await getRecord('journals', j._id)) || j
        } catch (e) {
            uni.hideLoading()
            uni.showToast({ title: '加载失败，请重试', icon: 'none' })
            return
        }
        uni.hideLoading()
    }
    title.value = full.title
    content.value = full.content || ''
    mood.value = full.mood || ''
    editingId.value = full._id
    showForm.value = true
}

// --- 拖拽排序 ---
const { dragging, dragIndex, dragOffset, onDragStart, onDragMove, onDragEnd } = useListDrag(list, {
    collection: 'journals',
    orderField: 'manual_order',
})

const handleDelete = id =>
    confirmDelete({
        content: '确定删除这篇日志？',
        collection: 'journals',
        id,
        cacheKeys: 'journals',
        onDone: () => {
            list.value = list.value.filter(x => x._id !== id)
        },
    })

const handleToggleShowOnHome = item => toggleShowOnHome('journals', item)

const viewDetail = j => {
    uni.navigateTo({ url: `/pages/journal/detail?id=${j._id}` })
}

const formatDate = t => formatRelativeTime(t)

// 列表展示用：心情标签对应的 emoji
const moodEmoji = label => (label && MOOD_OPTIONS.find(m => m.label === label)?.emoji) || '✨'
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
.cell-h {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 28rpx 36rpx;
}
.cell-icon {
    width: 64rpx;
    height: 64rpx;
    flex-shrink: 0;
    border-radius: 22rpx;
    background: rgba(212, 200, 240, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    text-align: center;
    line-height: 64rpx;
}
.cell-input {
    flex: 1;
    height: 64rpx;
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    background: transparent;
    border: none;
    padding: 0;
}
.cell-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 36rpx;
}
.cell-v {
    padding: 32rpx 36rpx;
}
.char-count {
    display: block;
    text-align: right;
    margin-top: 12rpx;
    font-size: 22rpx;
    color: var(--muted);
}
.char-count--full {
    color: var(--coral);
}
.cell-textarea {
    width: 100%;
    /* 固定高度、内部滚动：长文时「保存」按钮也始终在附近 */
    height: 50vh;
    min-height: 280rpx;
    font-size: 30rpx;
    color: var(--ink);
    background: transparent;
    border: none;
    padding: 0;
    box-sizing: border-box;
    line-height: 1.9;
}

.mood-scroll {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
}
.mood-row {
    display: flex;
    gap: 14rpx;
    padding: 6rpx 4rpx;
}
.mood-chip {
    width: 68rpx;
    height: 68rpx;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s;
}
.mood-chip.active {
    background: var(--ink);
    border-color: var(--ink);
    transform: scale(1.06);
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
    background: linear-gradient(135deg, #ece6fa 0%, #d4c8f0 100%);
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

/* 日志卡片 */
@keyframes rise {
    from {
        opacity: 0;
        transform: translateY(32rpx);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.row-in {
    animation-name: rise;
    animation-duration: 0.7s;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    animation-fill-mode: backwards;
}
.journal-row {
    display: flex;
    flex-direction: column;
    padding: 36rpx 36rpx 28rpx;
    margin-bottom: 28rpx;
    position: relative;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transition: transform 0.15s ease, opacity 0.15s;
}
.journal-row.dragging {
    opacity: 0.95;
    background: var(--card-solid);
    transition: none;
}
.journal-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18rpx;
}
.journal-no {
    font-family: var(--font-serif);
    font-size: 24rpx;
    font-style: italic;
    color: var(--plum);
    letter-spacing: 0.12em;
}
.journal-mood {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 6rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(212, 200, 240, 0.45);
    font-size: 22rpx;
}
.journal-mood-label {
    font-size: 20rpx;
    color: var(--ink-2);
    letter-spacing: 0.1em;
}
.journal-body {
    flex: 1;
    min-width: 0;
}
.journal-title {
    display: block;
    font-family: var(--font-serif);
    font-size: 40rpx;
    font-weight: 700;
    line-height: 1.3;
    color: var(--ink);
    letter-spacing: 0.02em;
}
.journal-title:active {
    opacity: 0.6;
}
.journal-arrow {
    font-family: var(--font-sans);
    font-size: 28rpx;
    font-weight: 400;
    color: var(--muted);
}
.journal-preview {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    margin-top: 14rpx;
    font-size: 26rpx;
    line-height: 1.8;
    color: var(--ink-2);
    word-break: break-all;
}
.journal-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24rpx;
}
.journal-time {
    font-size: 20rpx;
    color: var(--muted);
    letter-spacing: 0.12em;
}
.journal-actions {
    display: flex;
    gap: 12rpx;
    align-items: center;
}
.journal-act {
    font-size: 22rpx;
    color: var(--ink-2);
    padding: 6rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
}
.journal-act.active {
    color: #fff;
    background: var(--ink);
    border-color: var(--ink);
}
.journal-act.del {
    color: var(--coral);
    background: transparent;
    border-color: rgba(224, 122, 95, 0.25);
}

/* 互动栏 */
.interact-bar {
    display: flex;
    gap: 16rpx;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid var(--line);
}
.interact-btn {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    padding: 8rpx 22rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.6);
}
.interact-btn.liked {
    color: var(--coral);
    background: rgba(235, 178, 184, 0.35);
}

/* 评论区 */
.comment-area {
    margin-top: 20rpx;
    padding: 20rpx 24rpx;
    background: rgba(247, 243, 238, 0.8);
    border-radius: var(--r-m);
}
.comment-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12rpx 0;
}
.comment-item + .comment-item {
    border-top: 1rpx solid var(--line);
}
.comment-body {
    flex: 1;
    min-width: 0;
}
.comment-user {
    font-size: 22rpx;
    color: var(--ink);
    font-weight: 600;
    margin-right: 10rpx;
}
.comment-text {
    font-size: 24rpx;
    color: var(--ink-2);
    line-height: 1.7;
}
.comment-reply {
    font-size: 22rpx;
    color: var(--plum);
}
.comment-del {
    font-size: 30rpx;
    color: var(--faint);
    padding: 0 8rpx;
    flex-shrink: 0;
}
.comment-input-row {
    display: flex;
    gap: 12rpx;
    margin-top: 16rpx;
    align-items: center;
}
.comment-input {
    flex: 1;
    height: 68rpx;
    background: #fff;
    border-radius: 999rpx;
    padding: 0 28rpx;
    font-size: 24rpx;
    color: var(--ink);
    border: 1rpx solid var(--line);
}
.comment-send {
    height: 68rpx;
    line-height: 68rpx;
    padding: 0 28rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-size: 24rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    flex-shrink: 0;
}

.bottom-space {
    height: calc(120rpx + env(safe-area-inset-bottom));
}
</style>
