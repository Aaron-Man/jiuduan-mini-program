<template>
    <page-bg />
    <scroll-view
        :scroll-y="!dragging"
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage }"
        refresher-enabled
        refresher-default-style="black"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <!-- 顶部操作栏 -->
        <view class="top-bar">
            <view class="top-btn primary" @tap="showForm = !showForm">
                <text>{{ showForm ? '取消' : '+ 写日志' }}</text>
            </view>
        </view>

        <!-- 表单 -->
        <view class="group" v-if="showForm">
            <text class="group-label">{{ editingId ? '编辑日志' : '新建日志' }}</text>
            <view class="group-card">
                <view class="cell-h">
                    <text class="cell-icon">📌</text>
                    <input class="cell-input" v-model="title" placeholder="标题" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <textarea class="cell-textarea" v-model="content" placeholder="记录今天发生的事..." />
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
            <view class="submit-btn" @tap="handleSubmit" :class="{ disabled: submitting || !content.trim() }">
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

        <view v-else-if="list.length === 0" class="empty-area">
            <text class="empty-emoji">📖</text>
            <text class="empty-text">还没有日志</text>
            <text class="empty-hint">写下第一篇吧</text>
        </view>

        <view v-else class="group">
            <text class="group-label">全部日志</text>
            <view class="group-card" style="background: transparent; border: none; box-shadow: none">
                <view
                    class="journal-row"
                    v-for="(j, idx) in list"
                    :key="j._id"
                    :class="{ dragging: dragIndex === idx }"
                    :style="
                        dragIndex === idx
                            ? {
                                  transform: 'translateY(' + dragOffset + 'px)',
                                  zIndex: 10,
                                  boxShadow: '0 8rpx 32rpx rgba(0,0,0,0.12)',
                              }
                            : {}
                    "
                    @touchstart="onDragStart($event, idx)"
                    @touchmove="onDragMove($event)"
                    @touchend="onDragEnd()"
                >
                    <view class="journal-dot" :style="{ background: j.mood ? '#e4d5ed' : '#e5e5ea' }"></view>
                    <view class="journal-body">
                        <text class="journal-title" @tap.stop="viewDetail(j)">{{ j.title }}</text>
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
import { MOOD_OPTIONS } from '../../utils/constants'
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
        list.value = sortByManualOrder(await fetchAllRecords('journals'))
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
                list.value[idx] = { ...list.value[idx], title: savedTitle, content: savedContent, mood: savedMood }
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

const editJournal = j => {
    title.value = j.title
    content.value = j.content
    mood.value = j.mood || ''
    editingId.value = j._id
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
</script>

<style scoped>
.page-scroll {
    height: 100vh;
    background: #f5f0eb;
}
.page-scroll--transparent {
    background: transparent;
}

/* Top Bar */
.top-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 24rpx 32rpx 20rpx;
    background: transparent;
}
.top-btn {
    padding: 10rpx 28rpx;
    background: #b89660;
    color: #fff;
    border-radius: 24rpx;
    font-size: 24rpx;
    letter-spacing: 1rpx;
}
.top-btn:active {
    opacity: 0.8;
}

/* Group */
.group {
    padding: 16rpx 32rpx 0;
}
.group-label {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-bottom: 12rpx;
    margin-left: 8rpx;
    letter-spacing: 2rpx;
    font-weight: 500;
}
.group-card {
    background: #fff;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.03);
    border: 1rpx solid rgba(142, 142, 147, 0.06);
}

/* Cell Horizontal */
.cell-h {
    display: flex;
    align-items: center;
    padding: 24rpx 28rpx;
    gap: 16rpx;
}
.cell-icon {
    font-size: 32rpx;
    flex-shrink: 0;
}
.cell-input {
    flex: 1;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
}
.cell-divider {
    height: 1rpx;
    background: rgba(142, 142, 147, 0.06);
    margin: 0 28rpx;
}

/* Cell Vertical */
.cell-v {
    padding: 24rpx 28rpx;
}
.cell-textarea {
    width: 100%;
    min-height: 240rpx;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
    box-sizing: border-box;
    line-height: 1.8;
}

/* Mood */
.mood-scroll {
    white-space: nowrap;
    flex: 1;
}
.mood-row {
    display: flex;
    gap: 12rpx;
}
.mood-chip {
    width: 60rpx;
    height: 60rpx;
    border-radius: 30rpx;
    background: #f2f2f7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    border: 2rpx solid transparent;
    flex-shrink: 0;
}
.mood-chip.active {
    background: linear-gradient(135deg, #f0e8f5 0%, #e4d5ed 100%);
    border-color: #8e8e93;
    transform: scale(1.1);
}

/* Submit */
.submit-btn {
    margin-top: 24rpx;
    padding: 24rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 24rpx;
    text-align: center;
    font-size: 30rpx;
    font-weight: 500;
    letter-spacing: 2rpx;
}
.submit-btn.disabled {
    opacity: 0.35;
}

/* Skeleton */
.loading-area {
    padding: 24rpx 32rpx;
}
.skeleton-card {
    background: #fff;
    border-radius: 24rpx;
    padding: 28rpx;
    margin-bottom: 16rpx;
}
.skeleton-bar {
    height: 32rpx;
    background: linear-gradient(90deg, #e5e5ea 25%, #e5e5ea 50%, #e5e5ea 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8rpx;
    margin-bottom: 16rpx;
}
.skeleton-line {
    height: 24rpx;
    background: linear-gradient(90deg, #e5e5ea 25%, #e5e5ea 50%, #e5e5ea 75%);
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

/* Empty */
.empty-area {
    text-align: center;
    padding: 160rpx 0 120rpx;
}
.empty-emoji {
    font-size: 80rpx;
    display: block;
    margin-bottom: 20rpx;
}
.empty-text {
    font-size: 30rpx;
    color: #1c1c1e;
    font-weight: 500;
    display: block;
}
.empty-hint {
    font-size: 24rpx;
    color: #c7c7cc;
    display: block;
    margin-top: 8rpx;
}

/* Journal Row */
.journal-row {
    display: flex;
    padding: 24rpx 28rpx;
    gap: 20rpx;
    transition:
        transform 0.15s ease,
        opacity 0.15s;
    position: relative;
    background: rgba(255, 255, 255, 0.75);
    border-radius: 20rpx;
    margin-bottom: 16rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
    border: 1rpx solid rgba(142, 142, 147, 0.08);
}
.journal-row.dragging {
    opacity: 0.9;
    background: #fff;
    transition: none;
}
.journal-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 8rpx;
    flex-shrink: 0;
    margin-top: 10rpx;
}
.journal-body {
    flex: 1;
    min-width: 0;
}
.journal-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #1c1c1e;
    display: block;
    letter-spacing: 0.5rpx;
}
.journal-title:active {
    opacity: 0.6;
}
.journal-preview {
    font-size: 26rpx;
    color: #8e8e93;
    display: block;
    margin-top: 6rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.6;
}
.journal-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12rpx;
}
.journal-time {
    font-size: 22rpx;
    color: #c7c7cc;
}
.journal-actions {
    display: flex;
    gap: 16rpx;
    align-items: center;
}
.journal-act {
    font-size: 22rpx;
    color: #8e8e93;
    padding: 6rpx 16rpx;
    background: #f2f2f7;
    border-radius: 12rpx;
}
.journal-act.active {
    color: #ff9500;
    background: rgba(255, 149, 0, 0.1);
}
.journal-act.del {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.08);
}

/* Interact Bar */
.interact-bar {
    display: flex;
    gap: 24rpx;
    margin-top: 12rpx;
    padding-top: 12rpx;
    border-top: 1rpx solid rgba(142, 142, 147, 0.06);
}
.interact-btn {
    display: flex;
    align-items: center;
    gap: 6rpx;
    font-size: 24rpx;
    color: #8e8e93;
    padding: 6rpx 16rpx;
    border-radius: 12rpx;
    background: #f2f2f7;
}
.interact-btn.liked {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.08);
}

/* Comment Area */
.comment-area {
    margin-top: 12rpx;
    padding: 16rpx 20rpx;
    background: #f9f9fb;
    border-radius: 16rpx;
}
.comment-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 10rpx 0;
}
.comment-item + .comment-item {
    border-top: 1rpx solid rgba(142, 142, 147, 0.06);
}
.comment-body {
    flex: 1;
    min-width: 0;
}
.comment-user {
    font-size: 22rpx;
    color: #3a3a3c;
    font-weight: 500;
    margin-right: 8rpx;
}
.comment-text {
    font-size: 24rpx;
    color: #4a4a4a;
    line-height: 1.6;
}
.comment-reply {
    font-size: 22rpx;
    color: #8e8e93;
}
.comment-del {
    font-size: 28rpx;
    color: #c7c7cc;
    padding: 0 8rpx;
    flex-shrink: 0;
}
.comment-input-row {
    display: flex;
    gap: 12rpx;
    margin-top: 12rpx;
    align-items: center;
}
.comment-input {
    flex: 1;
    height: 60rpx;
    background: #fff;
    border-radius: 30rpx;
    padding: 0 24rpx;
    font-size: 24rpx;
    color: #1c1c1e;
    border: 1rpx solid rgba(142, 142, 147, 0.12);
}
.comment-send {
    padding: 10rpx 24rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 30rpx;
    font-size: 22rpx;
    flex-shrink: 0;
}

.bottom-space {
    height: 80rpx;
}
</style>
