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
                <text>{{ showForm ? '取消' : '+ 新建' }}</text>
            </view>
        </view>

        <!-- 表单 -->
        <view class="group" v-if="showForm">
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
            <view class="submit-btn" @tap="handleSubmit" :class="{ disabled: submitting || !content.trim() }">
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

        <view v-else-if="list.length === 0" class="empty-area">
            <text class="empty-emoji">📝</text>
            <text class="empty-text">还没有备忘</text>
            <text class="empty-hint">记下重要的事吧</text>
        </view>

        <view v-else class="group">
            <text class="group-label">全部备忘</text>
            <view class="group-card" style="background: transparent; border: none; box-shadow: none">
                <view
                    class="memo-row"
                    v-for="(m, idx) in list"
                    :key="m._id"
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
                    <view class="memo-dot" :style="{ background: m.color || '#8e8e93' }"></view>
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
    background: #c4909a;
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

/* Cell */
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
.cell-divider {
    height: 1rpx;
    background: rgba(142, 142, 147, 0.06);
    margin: 0 28rpx;
}
.cell-v {
    padding: 24rpx 28rpx;
}
.cell-textarea {
    width: 100%;
    min-height: 180rpx;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
    box-sizing: border-box;
    line-height: 1.8;
}

/* Color */
.color-row {
    display: flex;
    gap: 16rpx;
}
.color-dot {
    width: 48rpx;
    height: 48rpx;
    border-radius: 24rpx;
    border: 3rpx solid transparent;
    transition: all 0.2s;
}
.color-dot.active {
    border-color: #1c1c1e;
    transform: scale(1.15);
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

/* Memo Row */
.memo-row {
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
.memo-row.dragging {
    opacity: 0.9;
    background: #fff;
    transition: none;
}
.memo-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 8rpx;
    flex-shrink: 0;
    margin-top: 10rpx;
}
.memo-body {
    flex: 1;
    min-width: 0;
}
.memo-content {
    font-size: 28rpx;
    color: #1c1c1e;
    display: block;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-all;
}
.memo-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12rpx;
}
.memo-time {
    font-size: 22rpx;
    color: #c7c7cc;
}
.memo-actions {
    display: flex;
    gap: 16rpx;
    align-items: center;
}
.memo-pin {
    font-size: 22rpx;
}
.memo-act {
    font-size: 22rpx;
    color: #8e8e93;
    padding: 6rpx 16rpx;
    background: #f2f2f7;
    border-radius: 12rpx;
}
.memo-act.active {
    color: #ff9500;
    background: rgba(255, 149, 0, 0.1);
}
.memo-act.del {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.08);
}

.bottom-space {
    height: 80rpx;
}
</style>
