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
                <text>{{ showForm ? '取消' : '+ 计划' }}</text>
            </view>
        </view>

        <!-- 表单 -->
        <view class="group" v-if="showForm">
            <text class="group-label">{{ editingId ? '编辑旅行计划' : '新建旅行计划' }}</text>
            <view class="group-card">
                <view class="cell-h">
                    <text class="cell-icon">🏷️</text>
                    <input class="cell-input" v-model="form.title" placeholder="旅行标题" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <text class="cell-icon">📍</text>
                    <input class="cell-input" v-model="form.destination" placeholder="目的地" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <text class="cell-icon">📅</text>
                    <picker mode="date" :value="form.start_date" @change="form.start_date = $event.detail.value">
                        <view class="cell-pick">{{ form.start_date || '出发日期' }}</view>
                    </picker>
                    <text class="pick-sep">~</text>
                    <picker mode="date" :value="form.end_date" @change="form.end_date = $event.detail.value">
                        <view class="cell-pick">{{ form.end_date || '返回日期' }}</view>
                    </picker>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">备注</text>
                    <textarea class="cell-textarea" v-model="form.notes" placeholder="旅行备注（可选）..." />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <text class="cell-icon">📷</text>
                    <view class="img-pick" v-if="!imagePreview" @tap="chooseCover">
                        <text class="img-pick-text">选择封面图</text>
                    </view>
                    <view v-else class="img-preview">
                        <image :src="imagePreview" class="preview-img" mode="aspectFill" @error="imagePreview = ''" />
                        <text class="img-remove" @tap="removeCover">×</text>
                    </view>
                </view>
            </view>
            <view
                class="submit-btn"
                @tap="handleSubmit"
                :class="{ disabled: submitting || !form.title.trim() || !form.destination.trim() }"
            >
                <text>{{ submitting ? '保存中...' : editingId ? '保存修改' : '创建计划' }}</text>
            </view>
        </view>

        <!-- 列表 -->
        <view v-if="loading" class="loading-area">
            <view class="skeleton-card" v-for="i in 3" :key="i">
                <view class="skeleton-bar"></view>
                <view class="skeleton-line short"></view>
            </view>
        </view>

        <view v-else-if="travels.length === 0" class="empty-area">
            <text class="empty-emoji">✈️</text>
            <text class="empty-text">还没有旅行计划</text>
            <text class="empty-hint">规划下一段旅程吧</text>
        </view>

        <view v-else class="group">
            <text class="group-label">全部计划</text>
            <view class="group-card" style="background: transparent; border: none; box-shadow: none">
                <view
                    class="travel-row"
                    v-for="(travel, idx) in travels"
                    :key="travel._id"
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
                    <view
                        class="travel-dot"
                        :style="{
                            background:
                                travel.status === 'completed'
                                    ? '#a8c5a0'
                                    : travel.status === 'ongoing'
                                      ? '#d4a574'
                                      : '#7ba3c9',
                        }"
                    ></view>
                    <view class="travel-body">
                        <view class="travel-top">
                            <text class="travel-name">{{ travel.title }}</text>
                            <view class="status-pill" :class="'pill-' + travel.status">
                                <text>{{ TRAVEL_STATUS_MAP[travel.status]?.label || travel.status }}</text>
                            </view>
                        </view>
                        <text class="travel-dest">📍 {{ travel.destination }}</text>
                        <text class="travel-date" v-if="travel.start_date || travel.end_date">
                            📅 {{ travel.start_date || '?' }} ~ {{ travel.end_date || '?' }}
                        </text>
                        <text class="travel-notes" v-if="travel.notes">{{ travel.notes }}</text>
                        <image
                            v-if="travel.coverUrl"
                            :src="travel.coverUrl"
                            class="travel-cover"
                            mode="aspectFill"
                            lazy-load
                            @error="travel.coverUrl = ''"
                        />
                        <view class="travel-bottom">
                            <text class="travel-time" v-if="travel.createTime">{{
                                formatTime(travel.createTime)
                            }}</text>
                            <view class="travel-actions">
                                <text class="travel-act" @tap="editTravel(travel)">编辑</text>
                                <text
                                    class="travel-act"
                                    v-if="getNextStatus(travel.status)"
                                    @tap="handleStatusChange(travel._id, getNextStatus(travel.status))"
                                    >{{ TRAVEL_STATUS_MAP[getNextStatus(travel.status)]?.label }}</text
                                >
                                <text
                                    class="travel-act"
                                    :class="{ active: travel.showOnHome }"
                                    @tap="handleToggleShowOnHome(travel)"
                                    >{{ travel.showOnHome ? '★ 首页' : '☆ 首页' }}</text
                                >
                                <text class="travel-act del" @tap="handleDelete(travel._id)">删除</text>
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
    dbUpdate,
    dbAdd,
    uploadFile,
    formatRelativeTime,
    requestSubscribeFor,
    fetchAllRecords,
    resolveFileUrl,
    resolveFileUrls,
    sendNotificationToAll,
    clearPCache,
    getPCache,
    setPCache,
    useSharedBg,
} from '../../utils/cloud'
import { TRAVEL_STATUS_MAP } from '../../utils/constants'
import { useListDrag, sortByManualOrder } from '../../utils/useDragSort'
import { confirmDelete, toggleShowOnHome, handleLoadError } from '../../utils/contentActions'

const travels = ref([])
const loading = ref(true)
const showForm = ref(false)
const submitting = ref(false)
const editingId = ref(null)
const editCoverUrl = ref('')
const imagePreview = ref('')
const imageTempPath = ref('')
const refreshing = ref(false)

const form = ref({
    title: '',
    destination: '',
    start_date: '',
    end_date: '',
    status: 'planning',
    notes: '',
})

const { bgImage } = useSharedBg()

onMounted(() => {
    // 缓存优先：先快速显示
    const cached = getPCache('travels')
    if (cached) {
        travels.value = cached
        loading.value = false
    }
    fetchTravels()
})

const onRefresh = async () => {
    refreshing.value = true
    await fetchTravels()
    refreshing.value = false
}

const fetchTravels = async () => {
    try {
        const data = sortByManualOrder(await fetchAllRecords('travels', { orderBy: 'createTime', orderType: 'desc' }))
        // 封面是云文件 ID，需转换为临时 URL 才能显示
        await resolveFileUrls(data, 'cover_image', 'coverUrl')
        travels.value = data
        setPCache('travels', data)
    } catch (e) {
        handleLoadError(e, travels.value.length > 0)
    } finally {
        loading.value = false
    }
}

const removeCover = () => {
    imagePreview.value = ''
    imageTempPath.value = ''
    editCoverUrl.value = ''
}

const chooseCover = () => {
    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: res => {
            imageTempPath.value = res.tempFilePaths[0]
            imagePreview.value = res.tempFilePaths[0]
        },
    })
}

const resetForm = () => {
    form.value = { title: '', destination: '', start_date: '', end_date: '', status: 'planning', notes: '' }
    imagePreview.value = ''
    imageTempPath.value = ''
    editingId.value = null
    editCoverUrl.value = ''
    showForm.value = false
}

const handleSubmit = async () => {
    if (!form.value.title.trim() || !form.value.destination.trim() || submitting.value) return
    const isEditing = !!editingId.value
    // 订阅必须在用户点击手势中同步调用，放在最前面
    if (!isEditing) requestSubscribeFor('travel')
    submitting.value = true
    clearPCache('travels')
    try {
        let coverImage = editCoverUrl.value || null
        if (imageTempPath.value && imageTempPath.value !== editCoverUrl.value) {
            const cloudPath = `travels/${Date.now()}-${Math.random().toString(36).slice(2)}.${imageTempPath.value.split('.').pop()}`
            const uploadRes = await uploadFile(cloudPath, imageTempPath.value)
            coverImage = uploadRes.fileID
        }
        const data = {
            title: form.value.title.trim(),
            destination: form.value.destination.trim(),
            start_date: form.value.start_date || null,
            end_date: form.value.end_date || null,
            status: form.value.status,
            notes: form.value.notes.trim() || null,
            cover_image: coverImage,
        }
        if (isEditing) {
            await dbUpdate('travels', editingId.value, data)
        } else {
            data.sort_order = travels.value.length
            data.createTime = new Date()
            await dbAdd('travels', data)
        }
        resetForm()
        uni.vibrateShort({ type: 'medium' })
        uni.showToast({ title: isEditing ? '已更新' : '创建成功', icon: 'success' })
        fetchTravels()
        // 通知其他用户有新旅行计划
        if (!isEditing) {
            const currentUser = uni.getStorageSync('auth_user')
            sendNotificationToAll(
                'travel_remind',
                currentUser?._id,
                {
                    title: data.title || '新旅行计划',
                    destination: data.destination || '待定',
                    startDate: data.start_date || '待定',
                },
                '/pages/travel/travel'
            )
        }
    } catch (e) {
        uni.showToast({ title: '创建失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}

const editTravel = async t => {
    form.value = {
        title: t.title,
        destination: t.destination,
        start_date: t.start_date || '',
        end_date: t.end_date || '',
        status: t.status || 'planning',
        notes: t.notes || '',
    }
    editCoverUrl.value = t.cover_image || ''
    imageTempPath.value = ''
    // 云文件 ID 需转换为临时 URL 才能预览
    if (t.cover_image && t.cover_image.startsWith('cloud://')) {
        try {
            imagePreview.value = await resolveFileUrl(t.cover_image)
        } catch (e) {
            imagePreview.value = ''
        }
    } else {
        imagePreview.value = t.cover_image || ''
    }
    editingId.value = t._id
    showForm.value = true
}

// --- 拖拽排序 ---
const { dragging, dragIndex, dragOffset, onDragStart, onDragMove, onDragEnd } = useListDrag(travels, {
    collection: 'travels',
    orderField: 'manual_order',
})

const getNextStatus = current => {
    const flow = { planning: 'ongoing', ongoing: 'completed' }
    return flow[current] || null
}

const handleStatusChange = async (id, status) => {
    // 状态变更前先请求订阅授权，确保用户能收到后续每次变更的通知
    requestSubscribeFor('travel')
    clearPCache('travels')
    try {
        const travel = travels.value.find(t => t._id === id)
        await dbUpdate('travels', id, { status })
        if (travel) travel.status = status
        uni.vibrateShort({ type: 'light' })
        // 通知其他用户旅行状态变更
        if (travel) {
            const currentUser = uni.getStorageSync('auth_user')
            sendNotificationToAll(
                'travel_remind',
                currentUser?._id,
                {
                    title: travel.title || '旅行计划',
                    destination: travel.destination || '待定',
                    startDate: travel.start_date || '待定',
                },
                '/pages/travel/travel'
            )
        }
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    }
}

const handleDelete = id =>
    confirmDelete({
        content: '确定删除这条旅行计划？',
        collection: 'travels',
        id,
        cacheKeys: 'travels',
        onDone: () => {
            travels.value = travels.value.filter(x => x._id !== id)
        },
    })

const handleToggleShowOnHome = item => toggleShowOnHome('travels', item)

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
    background: #6b9e7a;
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
.cell-v-label {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-bottom: 12rpx;
    letter-spacing: 1rpx;
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

/* Picker */
.cell-pick {
    font-size: 26rpx;
    color: #8e8e93;
    padding: 8rpx 0;
}
.pick-sep {
    font-size: 24rpx;
    color: #c7c7cc;
    margin: 0 12rpx;
}

/* Image */
.img-pick {
    padding: 16rpx 28rpx;
    background: #f2f2f7;
    border-radius: 16rpx;
    border: 1rpx dashed rgba(142, 142, 147, 0.25);
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
    width: 200rpx;
    height: 140rpx;
    border-radius: 16rpx;
}
.img-remove {
    position: absolute;
    top: -12rpx;
    right: -12rpx;
    width: 40rpx;
    height: 40rpx;
    background: #ff3b30;
    color: #fff;
    border-radius: 20rpx;
    text-align: center;
    line-height: 40rpx;
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

/* Travel Row */
.travel-row {
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
.travel-row.dragging {
    opacity: 0.9;
    background: #fff;
    transition: none;
}
.travel-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 8rpx;
    flex-shrink: 0;
    margin-top: 10rpx;
}
.travel-body {
    flex: 1;
    min-width: 0;
}
.travel-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8rpx;
}
.travel-name {
    font-size: 30rpx;
    font-weight: 600;
    color: #1c1c1e;
    letter-spacing: 0.5rpx;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.status-pill {
    padding: 6rpx 18rpx;
    border-radius: 20rpx;
    font-size: 20rpx;
    flex-shrink: 0;
}
.pill-planning {
    background: rgba(123, 163, 201, 0.15);
    color: #4a6f8f;
}
.pill-ongoing {
    background: rgba(212, 165, 116, 0.15);
    color: #9a7540;
}
.pill-completed {
    background: rgba(168, 197, 160, 0.15);
    color: #5a7a52;
}
.travel-dest {
    font-size: 24rpx;
    color: #3a3a3c;
    display: block;
    margin-bottom: 4rpx;
}
.travel-date {
    font-size: 22rpx;
    color: #8e8e93;
    display: block;
    margin-bottom: 4rpx;
}
.travel-notes {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-top: 8rpx;
    line-height: 1.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.travel-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12rpx;
}
.travel-time {
    font-size: 22rpx;
    color: #c7c7cc;
}
.travel-cover {
    width: 100%;
    height: 240rpx;
    border-radius: 16rpx;
    margin-top: 12rpx;
    display: block;
}
.travel-actions {
    display: flex;
    gap: 16rpx;
    align-items: center;
}
.travel-act {
    font-size: 22rpx;
    color: #8e8e93;
    padding: 6rpx 16rpx;
    background: #f2f2f7;
    border-radius: 12rpx;
}
.travel-act.active {
    color: #ff9500;
    background: rgba(255, 149, 0, 0.1);
}
.travel-act.del {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.08);
}

.bottom-space {
    height: 80rpx;
}
</style>
