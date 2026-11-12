<template>
    <page-bg tone="peach" />
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
                <text class="ui-eyebrow">MOOD</text>
                <text class="ui-title hero-title">心情</text>
                <text class="ui-sub hero-sub">{{
                    list.length ? '已收藏 ' + list.length + ' 个此刻' : '把此刻的心情，轻轻放在这里'
                }}</text>
            </view>
            <view class="hero-btn ui-press" :class="{ 'hero-btn--ghost': showForm }" @tap="showForm = !showForm">
                <text>{{ showForm ? '取消' : '+ 发布' }}</text>
            </view>
        </view>

        <!-- 发布表单 -->
        <view class="group ui-fade-up" v-if="showForm">
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
            <view class="submit-btn ui-press" @tap="handleSubmit" :class="{ disabled: submitting || !content.trim() }">
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

        <view v-else-if="list.length === 0" class="empty-area ui-fade-up ui-d2">
            <view class="empty-bubble">
                <text class="empty-emoji">💭</text>
            </view>
            <text class="empty-text">还没有心情</text>
            <text class="empty-hint">发布第一条心情吧</text>
        </view>

        <view v-else class="group">
            <view class="section-head ui-fade-up ui-d1">
                <text class="group-label">最新动态</text>
                <view class="section-line"></view>
            </view>
            <view class="feed">
                <view
                    class="status-row"
                    v-for="(s, idx) in list"
                    :key="s._id"
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
                    <view class="status-mood" :class="{ 'status-mood--on': s.mood }">
                        <text>{{ moodEmoji(s.mood) || '💭' }}</text>
                    </view>
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

// 列表展示用：心情标签对应的 emoji
const moodEmoji = label => (label && MOOD_OPTIONS.find(m => m.label === label)?.emoji) || ''
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
.cell-v-label {
    display: block;
    margin-bottom: 16rpx;
    font-size: 22rpx;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--ink-2);
}
.cell-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 36rpx;
}
.cell-textarea {
    width: 100%;
    min-height: 160rpx;
    font-size: 30rpx;
    color: var(--ink);
    background: transparent;
    border: none;
    padding: 0;
    box-sizing: border-box;
    line-height: 1.8;
}

.mood-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
}
.mood-chip {
    width: 76rpx;
    height: 76rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34rpx;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s;
}
.mood-chip.active {
    background: var(--ink);
    border-color: var(--ink);
    transform: scale(1.08);
    box-shadow: 0 12rpx 24rpx -12rpx rgba(30, 26, 23, 0.6);
}

.img-area {
    margin-top: 4rpx;
}
.img-pick {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14rpx;
    height: 120rpx;
    background: rgba(244, 199, 180, 0.22);
    border-radius: var(--r-m);
    border: 2rpx dashed rgba(224, 122, 95, 0.28);
}
.img-pick-icon {
    font-size: 34rpx;
}
.img-pick-text {
    font-size: 26rpx;
    color: var(--ink-2);
    letter-spacing: 0.06em;
}
.img-preview {
    position: relative;
    display: inline-block;
}
.preview-img {
    width: 240rpx;
    height: 240rpx;
    border-radius: var(--r-m);
    box-shadow: var(--shadow-soft);
}
.img-remove {
    position: absolute;
    top: -14rpx;
    right: -14rpx;
    width: 48rpx;
    height: 48rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 50%;
    text-align: center;
    line-height: 46rpx;
    font-size: 30rpx;
    border: 4rpx solid #fff;
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
    background: var(--grad-dawn);
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

/* 心情卡片 */
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
.status-row {
    display: flex;
    gap: 24rpx;
    padding: 36rpx 32rpx 28rpx;
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
.status-row.dragging {
    opacity: 0.95;
    background: var(--card-solid);
    transition: none;
}
.status-mood {
    width: 80rpx;
    height: 80rpx;
    flex-shrink: 0;
    border-radius: 28rpx;
    background: var(--bg-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 38rpx;
}
.status-mood--on {
    background: var(--grad-dawn);
}
.status-body {
    flex: 1;
    min-width: 0;
}
.status-content {
    display: block;
    font-size: 30rpx;
    color: var(--ink);
    line-height: 1.85;
    letter-spacing: 0.02em;
    word-break: break-all;
}
.status-img {
    margin-top: 20rpx;
    width: 100%;
    max-width: 440rpx;
    border-radius: var(--r-m);
    box-shadow: var(--shadow-soft);
}
.status-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 20rpx;
}
.status-time {
    font-size: 20rpx;
    color: var(--muted);
    letter-spacing: 0.12em;
}
.status-actions {
    display: flex;
    gap: 12rpx;
    align-items: center;
}
.status-act {
    font-size: 22rpx;
    color: var(--ink-2);
    padding: 6rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
}
.status-act.active {
    color: #fff;
    background: var(--ink);
    border-color: var(--ink);
}
.status-act.del {
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
    background: rgba(244, 199, 180, 0.4);
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
