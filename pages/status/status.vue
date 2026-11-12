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
                <text>{{ showForm ? '取消' : '+ 发布' }}</text>
            </view>
        </view>

        <!-- 发布表单 -->
        <view class="group" v-if="showForm">
            <text class="group-label">{{ editingId ? '编辑心情' : '发布新心情' }}</text>
            <view class="group-card">
                <view class="cell-v">
                    <text class="cell-v-label">内容</text>
                    <textarea class="cell-textarea" v-model="content" placeholder="此刻的心情..." :maxlength="500" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">心情</text>
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
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">图片</text>
                    <view class="img-area">
                        <view class="img-preview" v-if="imagePath">
                            <image :src="imagePath" mode="aspectFill" class="preview-img" @error="imagePath = ''" />
                            <text class="img-remove" @tap="removeImage">×</text>
                        </view>
                        <view class="img-pick" v-else @tap="chooseImage">
                            <text class="img-pick-icon">📷</text>
                            <text class="img-pick-text">选择图片</text>
                        </view>
                    </view>
                </view>
            </view>
            <view class="submit-btn" @tap="handleSubmit" :class="{ disabled: submitting || !content.trim() }">
                <text>{{ submitting ? '发布中...' : editingId ? '保存修改' : '发布心情' }}</text>
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
            <text class="empty-emoji">💭</text>
            <text class="empty-text">还没有心情</text>
            <text class="empty-hint">发布第一条心情吧</text>
        </view>

        <view v-else class="group">
            <text class="group-label">最新动态</text>
            <view class="group-card" style="background: transparent; border: none; box-shadow: none">
                <view
                    class="status-row"
                    v-for="(s, idx) in list"
                    :key="s._id"
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
                    <view class="status-dot" :style="{ background: s.mood ? '#f2ddd0' : '#e5e5ea' }"></view>
                    <view class="status-body">
                        <text class="status-content">{{ s.content }}</text>
                        <image
                            v-if="s.displayImageUrl"
                            :src="s.displayImageUrl"
                            mode="widthFix"
                            class="status-img"
                            lazy-load
                        />
                        <view class="status-bottom">
                            <text class="status-time">{{ formatTime(s.createTime) }}</text>
                            <view class="status-actions">
                                <text class="status-act" @tap="editStatus(s)">编辑</text>
                                <text
                                    class="status-act"
                                    :class="{ active: s.showOnHome }"
                                    @tap="handleToggleShowOnHome(s)"
                                    >{{ s.showOnHome ? '★ 首页' : '☆ 首页' }}</text
                                >
                                <text class="status-act del" @tap="handleDelete(s._id)">删除</text>
                            </view>
                        </view>
                        <!-- 交互栏 -->
                        <view class="interact-bar">
                            <view class="interact-btn" :class="{ liked: likedByMe[s._id] }" @tap="toggleLike(s)">
                                <text>{{ likedByMe[s._id] ? '❤' : '♡' }}</text>
                                <text v-if="likeCounts[s._id]">{{ likeCounts[s._id] }}</text>
                            </view>
                            <view class="interact-btn" @tap="toggleComments(s._id)">
                                <text>💬</text>
                                <text v-if="commentCounts[s._id]">{{ commentCounts[s._id] }}</text>
                            </view>
                        </view>
                        <!-- 评论区 -->
                        <view class="comment-area" v-if="expandedId === s._id">
                            <view class="comment-item" v-for="c in commentsMap[s._id]" :key="c._id">
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
                                    @tap="deleteComment(c._id, s._id)"
                                    >×</text
                                >
                            </view>
                            <view class="comment-input-row">
                                <input
                                    class="comment-input"
                                    v-model="commentText"
                                    :placeholder="replyTo ? '回复 ' + replyTo + '...' : '写评论...'"
                                    @confirm="addComment(s._id, commentText, replyTo)"
                                />
                                <view class="comment-send" @tap="addComment(s._id, commentText, replyTo)">发送</view>
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
    uploadFile,
    formatRelativeTime,
    requestSubscribeFor,
    sendNotificationToAll,
    resolveFileUrls,
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
const content = ref('')
const mood = ref('')
const imagePath = ref('')
const submitting = ref(false)
const editingId = ref(null)
const editImageUrl = ref('')
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
} = useInteractions('status')

const { bgImage } = useSharedBg()

onMounted(() => {
    const u = uni.getStorageSync('auth_user')
    currentUserId.value = u?._id || ''
    // 缓存优先：先快速显示
    const cached = getPCache('statuses')
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
        list.value = sortByManualOrder(await fetchAllRecords('statuses'))
        // 将云文件 ID 转换为临时 URL，解决非上传者无法查看图片的问题
        await resolveFileUrls(list.value, 'imageUrl', 'displayImageUrl')
        setPCache('statuses', list.value)
        await loadInteractionsData()
    } catch (e) {
        handleLoadError(e, list.value.length > 0)
    } finally {
        loading.value = false
    }
}

const loadInteractionsData = async () => {
    const ids = list.value.map(s => s._id)
    await loadInteractions(ids)
}

const removeImage = () => {
    imagePath.value = ''
    editImageUrl.value = ''
}

const chooseImage = () => {
    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: res => {
            imagePath.value = res.tempFilePaths[0]
        },
    })
}

const resetForm = () => {
    content.value = ''
    mood.value = ''
    imagePath.value = ''
    editingId.value = null
    editImageUrl.value = ''
    showForm.value = false
}

const handleSubmit = async () => {
    if (!content.value.trim() || submitting.value) return
    const isEditing = !!editingId.value
    // 订阅必须在用户点击手势中同步调用，放在最前面
    if (!isEditing) requestSubscribeFor('content')
    submitting.value = true
    clearPCache('statuses')
    const savedContent = content.value.trim().slice(0, 20)
    try {
        let imageUrl = editImageUrl.value || null
        if (imagePath.value && imagePath.value !== editImageUrl.value && !imagePath.value.startsWith('cloud://')) {
            const ext = imagePath.value.split('.').pop()
            const cloudPath = `status/${Date.now()}.${ext}`
            const uploadRes = await uploadFile(cloudPath, imagePath.value)
            imageUrl = uploadRes.fileID
        }
        if (isEditing) {
            await dbUpdate('statuses', editingId.value, {
                content: content.value.trim(),
                mood: mood.value || null,
                imageUrl,
            })
        } else {
            await dbAdd('statuses', {
                content: content.value.trim(),
                mood: mood.value || null,
                imageUrl,
                sort_order: list.value.length,
                createTime: new Date(),
            })
        }
        resetForm()
        uni.vibrateShort({ type: 'medium' })
        uni.showToast({ title: isEditing ? '已更新' : '已发布', icon: 'success' })
        fetchData()
        if (!isEditing) {
            const currentUser = uni.getStorageSync('auth_user')
            sendNotificationToAll(
                'content_update',
                currentUser?._id,
                {
                    title: '新心情发布',
                    contentType: '心情动态',
                    summary: savedContent || '快来看看吧',
                },
                '/pages/status/status'
            )
        }
    } catch (e) {
        uni.showToast({ title: '发布失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}

const editStatus = s => {
    content.value = s.content
    mood.value = s.mood || ''
    editImageUrl.value = s.imageUrl || ''
    imagePath.value = s.imageUrl || ''
    editingId.value = s._id
    showForm.value = true
}

// --- 拖拽排序 ---
const { dragging, dragIndex, dragOffset, onDragStart, onDragMove, onDragEnd } = useListDrag(list, {
    collection: 'statuses',
    orderField: 'manual_order',
})

const handleDelete = id =>
    confirmDelete({
        content: '确定删除这条心情？',
        collection: 'statuses',
        id,
        cacheKeys: 'statuses',
        onDone: () => {
            list.value = list.value.filter(x => x._id !== id)
        },
    })

const handleToggleShowOnHome = item => toggleShowOnHome('statuses', item)

const formatTime = t => formatRelativeTime(t)
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
    background: #c07a50;
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

/* Cell Vertical */
.cell-v {
    padding: 24rpx 28rpx;
}
.cell-v-label {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-bottom: 12rpx;
    letter-spacing: 1rpx;
}
.cell-divider {
    height: 1rpx;
    background: rgba(142, 142, 147, 0.06);
    margin: 0 28rpx;
}
.cell-textarea {
    width: 100%;
    min-height: 140rpx;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
    box-sizing: border-box;
    line-height: 1.6;
}

/* Mood */
.mood-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
}
.mood-chip {
    width: 64rpx;
    height: 64rpx;
    border-radius: 32rpx;
    background: #f2f2f7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    border: 2rpx solid transparent;
    transition: all 0.2s;
}
.mood-chip.active {
    background: linear-gradient(135deg, #f8ece4 0%, #f2ddd0 100%);
    border-color: #8e8e93;
    transform: scale(1.1);
}

/* Image */
.img-area {
    margin-top: 4rpx;
}
.img-pick {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 20rpx 28rpx;
    background: #f2f2f7;
    border-radius: 16rpx;
    border: 1rpx dashed rgba(142, 142, 147, 0.25);
}
.img-pick-icon {
    font-size: 32rpx;
}
.img-pick-text {
    font-size: 26rpx;
    color: #8e8e93;
}
.img-preview {
    position: relative;
    display: inline-block;
}
.preview-img {
    width: 240rpx;
    height: 240rpx;
    border-radius: 20rpx;
}
.img-remove {
    position: absolute;
    top: -12rpx;
    right: -12rpx;
    width: 44rpx;
    height: 44rpx;
    background: #ff3b30;
    color: #fff;
    border-radius: 22rpx;
    text-align: center;
    line-height: 44rpx;
    font-size: 28rpx;
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
    background: linear-gradient(90deg, #e5e5ea 25%, #f2f2f7 50%, #e5e5ea 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8rpx;
    margin-bottom: 16rpx;
}
.skeleton-line {
    height: 24rpx;
    background: linear-gradient(90deg, #e5e5ea 25%, #f2f2f7 50%, #e5e5ea 75%);
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

/* Status Row */
.status-row {
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
.status-row.dragging {
    opacity: 0.9;
    background: #fff;
    transition: none;
}
.status-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 8rpx;
    flex-shrink: 0;
    margin-top: 10rpx;
}
.status-body {
    flex: 1;
    min-width: 0;
}
.status-content {
    font-size: 28rpx;
    color: #1c1c1e;
    display: block;
    line-height: 1.8;
    word-break: break-all;
}
.status-img {
    margin-top: 12rpx;
    width: 100%;
    max-width: 400rpx;
    border-radius: 16rpx;
}
.status-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12rpx;
}
.status-time {
    font-size: 22rpx;
    color: #c7c7cc;
}
.status-actions {
    display: flex;
    gap: 16rpx;
    align-items: center;
}
.status-act {
    font-size: 22rpx;
    color: #8e8e93;
    padding: 6rpx 16rpx;
    background: #f2f2f7;
    border-radius: 12rpx;
}
.status-act.active {
    color: #ff9500;
    background: rgba(255, 149, 0, 0.1);
}
.status-act.del {
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
