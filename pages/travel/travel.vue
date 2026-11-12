<template>
    <page-bg tone="sky" />
    <scroll-view
        :scroll-y="!dragging"
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage }"
        refresher-enabled
        refresher-default-style="black"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <!-- 杂志式标题区 + 操作按钮 -->
        <view class="hero ui-fade-up">
            <view class="hero-text">
                <text class="ui-eyebrow">JOURNEYS</text>
                <text class="ui-title hero-title">旅行计划</text>
                <text class="ui-sub">{{ travels.length }} 段旅程 · 已完成 {{ completedCount }}</text>
            </view>
            <view class="top-bar">
                <view class="top-btn primary ui-press" :class="{ ghost: showForm }" @tap="showForm = !showForm">
                    <text>{{ showForm ? '取消' : '+ 计划' }}</text>
                </view>
            </view>
        </view>

        <!-- 表单 -->
        <view class="group ui-fade-up" v-if="showForm">
            <text class="group-label">{{ editingId ? '编辑旅行计划' : '新建旅行计划' }}</text>
            <view class="group-card">
                <view class="cell-h">
                    <text class="cell-icon ui-bubble ui-bubble--sky">🏷️</text>
                    <input class="cell-input" v-model="form.title" placeholder="旅行标题" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <text class="cell-icon ui-bubble ui-bubble--peach">📍</text>
                    <input class="cell-input" v-model="form.destination" placeholder="目的地" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <text class="cell-icon ui-bubble ui-bubble--butter">📅</text>
                    <picker mode="date" :value="form.start_date" @change="form.start_date = $event.detail.value">
                        <view class="cell-pick" :class="{ filled: form.start_date }">{{
                            form.start_date || '出发日期'
                        }}</view>
                    </picker>
                    <text class="pick-sep">→</text>
                    <picker mode="date" :value="form.end_date" @change="form.end_date = $event.detail.value">
                        <view class="cell-pick" :class="{ filled: form.end_date }">{{
                            form.end_date || '返回日期'
                        }}</view>
                    </picker>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">备注</text>
                    <textarea class="cell-textarea" v-model="form.notes" placeholder="旅行备注（可选）..." />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <text class="cell-icon ui-bubble ui-bubble--lilac">📷</text>
                    <view class="img-pick ui-press" v-if="!imagePreview" @tap="chooseCover">
                        <text class="img-pick-text">选择封面图</text>
                    </view>
                    <view v-else class="img-preview">
                        <image :src="imagePreview" class="preview-img" mode="aspectFill" @error="imagePreview = ''" />
                        <text class="img-remove" @tap="removeCover">×</text>
                    </view>
                </view>
            </view>
            <view
                class="submit-btn ui-press"
                @tap="handleSubmit"
                :class="{ disabled: submitting || !form.title.trim() || !form.destination.trim() }"
            >
                <text>{{ submitting ? '保存中...' : editingId ? '保存修改' : '创建计划' }}</text>
            </view>
        </view>

        <!-- 列表 -->
        <view v-if="loading" class="loading-area">
            <view class="skeleton-card" v-for="i in 3" :key="i">
                <view class="skeleton-cover"></view>
                <view class="skeleton-body">
                    <view class="skeleton-bar"></view>
                    <view class="skeleton-line short"></view>
                </view>
            </view>
        </view>

        <view v-else-if="travels.length === 0" class="empty-area ui-fade-up ui-d1">
            <view class="empty-bubble">
                <text class="empty-emoji">✈️</text>
            </view>
            <text class="empty-text">还没有旅行计划</text>
            <text class="empty-hint">规划下一段旅程吧</text>
        </view>

        <view v-else class="group">
            <text class="group-label">全部计划</text>
            <view class="ticket-list">
                <view
                    class="travel-row"
                    v-for="(travel, idx) in travels"
                    :key="travel._id"
                    :class="[{ dragging: dragIndex === idx }, 'ui-d' + ((idx % 6) + 1)]"
                    :style="
                        dragIndex === idx
                            ? {
                                  transform: 'translateY(' + dragOffset + 'px) scale(1.02)',
                                  zIndex: 10,
                                  boxShadow: '0 48rpx 96rpx -32rpx rgba(80,56,36,0.45)',
                              }
                            : {}
                    "
                    @touchstart="onDragStart($event, idx)"
                    @touchmove="onDragMove($event)"
                    @touchend="onDragEnd()"
                >
                    <!-- 封面：图片 + 渐变遮罩；无图时用状态色渐变 -->
                    <view
                        class="ticket-cover"
                        :class="[travel.coverUrl ? 'has-img' : 'no-img', 'cover-' + travel.status]"
                    >
                        <image
                            v-if="travel.coverUrl"
                            :src="travel.coverUrl"
                            class="travel-cover"
                            mode="aspectFill"
                            lazy-load
                            @error="travel.coverUrl = ''"
                        />
                        <text class="cover-watermark" v-if="!travel.coverUrl">✈</text>
                        <view class="cover-shade"></view>
                        <view class="cover-top">
                            <text class="cover-eyebrow">BOARDING PASS · No.{{ idx + 1 }}</text>
                            <view class="status-pill" :class="'pill-' + travel.status">
                                <view
                                    class="travel-dot"
                                    :style="{
                                        background:
                                            travel.status === 'completed'
                                                ? '#7fa58a'
                                                : travel.status === 'ongoing'
                                                  ? 'var(--coral)'
                                                  : '#6f97c4',
                                    }"
                                ></view>
                                <text>{{ TRAVEL_STATUS_MAP[travel.status]?.label || travel.status }}</text>
                            </view>
                        </view>
                        <view class="cover-bottom">
                            <text class="travel-name">{{ travel.title }}</text>
                            <text class="travel-dest">{{ travel.destination }}</text>
                        </view>
                    </view>

                    <!-- 票根撕线 -->
                    <view class="ticket-perf">
                        <view class="perf-notch left"></view>
                        <view class="perf-line"></view>
                        <view class="perf-notch right"></view>
                    </view>

                    <view class="travel-body">
                        <view class="ticket-dates" v-if="travel.start_date || travel.end_date">
                            <view class="ticket-date-col">
                                <text class="ticket-label">DEPART</text>
                                <text class="travel-date">{{ travel.start_date || '?' }}</text>
                            </view>
                            <view class="ticket-route">
                                <view class="route-line"></view>
                                <text class="route-plane">✈</text>
                                <view class="route-line"></view>
                            </view>
                            <view class="ticket-date-col right">
                                <text class="ticket-label">RETURN</text>
                                <text class="travel-date">{{ travel.end_date || '?' }}</text>
                            </view>
                        </view>
                        <text class="travel-notes" v-if="travel.notes">{{ travel.notes }}</text>
                        <view class="travel-bottom">
                            <text class="travel-time" v-if="travel.createTime">{{
                                formatTime(travel.createTime)
                            }}</text>
                            <view class="travel-actions">
                                <text class="travel-act" @tap="editTravel(travel)">编辑</text>
                                <text
                                    class="travel-act next"
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
import { ref, computed, onMounted } from 'vue'
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

// 标题区展示：已完成的旅程数
const completedCount = computed(() => travels.value.filter(t => t.status === 'completed').length)

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
    padding: 36rpx 32rpx 12rpx;
    gap: 16rpx;
}
.hero-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.hero-title {
    margin: 6rpx 0 4rpx;
}
.top-bar {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding-bottom: 8rpx;
}
.top-btn {
    height: 72rpx;
    padding: 0 34rpx;
    display: flex;
    align-items: center;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-size: 26rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.top-btn.ghost {
    background: rgba(255, 255, 255, 0.72);
    color: var(--ink);
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
}

/* Group */
.group {
    padding: 20rpx 32rpx 0;
}
.group-label {
    font-size: 20rpx;
    color: var(--muted);
    display: block;
    margin: 0 0 18rpx 8rpx;
    letter-spacing: 0.32em;
    font-weight: 600;
}
.group-card {
    background: var(--card);
    border-radius: var(--r-xl);
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 1rpx solid var(--card-border);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    padding: 8rpx 0;
}
.ticket-list {
    display: flex;
    flex-direction: column;
}

/* 表单行 */
.cell-h {
    display: flex;
    align-items: center;
    padding: 20rpx 32rpx;
    gap: 20rpx;
}
.cell-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    font-size: 30rpx;
    flex-shrink: 0;
}
.cell-input {
    flex: 1;
    font-size: 28rpx;
    color: var(--ink);
    background: transparent;
    border: none;
    padding: 0;
}
.cell-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 32rpx 0 116rpx;
}
.cell-v {
    padding: 24rpx 32rpx;
}
.cell-v-label {
    font-size: 20rpx;
    color: var(--muted);
    display: block;
    margin-bottom: 14rpx;
    letter-spacing: 0.24em;
    font-weight: 600;
}
.cell-textarea {
    width: 100%;
    min-height: 140rpx;
    font-size: 28rpx;
    color: var(--ink);
    background: rgba(255, 255, 255, 0.6);
    border: 1rpx solid var(--line);
    border-radius: var(--r-m);
    padding: 20rpx 24rpx;
    box-sizing: border-box;
    line-height: 1.6;
}
.cell-pick {
    font-size: 26rpx;
    color: var(--muted);
    height: 60rpx;
    line-height: 60rpx;
    padding: 0 22rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
}
.cell-pick.filled {
    font-family: var(--font-serif);
    color: var(--ink);
    font-weight: 600;
}
.pick-sep {
    font-size: 24rpx;
    color: var(--faint);
}
.img-pick {
    height: 64rpx;
    padding: 0 28rpx;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 999rpx;
    border: 2rpx dashed var(--faint);
}
.img-pick-text {
    font-size: 24rpx;
    color: var(--ink-2);
}
.img-preview {
    position: relative;
    display: inline-block;
}
.preview-img {
    width: 240rpx;
    height: 160rpx;
    border-radius: var(--r-m);
    display: block;
    box-shadow: var(--shadow-soft);
}
.img-remove {
    position: absolute;
    top: -14rpx;
    right: -14rpx;
    width: 44rpx;
    height: 44rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 50%;
    text-align: center;
    line-height: 42rpx;
    font-size: 28rpx;
    box-shadow: var(--shadow-soft);
}
.submit-btn {
    margin-top: 28rpx;
}

/* 骨架屏 */
.loading-area {
    padding: 24rpx 32rpx;
}
.skeleton-card {
    background: var(--card);
    border-radius: var(--r-l);
    margin-bottom: 32rpx;
    overflow: hidden;
    box-shadow: var(--shadow-soft);
    border: 1rpx solid var(--card-border);
}
.skeleton-cover {
    height: 260rpx;
    background: linear-gradient(90deg, var(--bg-2) 25%, #f6f0e9 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}
.skeleton-body {
    padding: 28rpx 32rpx 32rpx;
}
.skeleton-bar {
    height: 32rpx;
    background: linear-gradient(90deg, var(--bg-2) 25%, #f6f0e9 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 999rpx;
    margin-bottom: 16rpx;
}
.skeleton-line {
    height: 24rpx;
    background: linear-gradient(90deg, var(--bg-2) 25%, #f6f0e9 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 999rpx;
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
    text-align: center;
    padding: 140rpx 48rpx 120rpx;
}
.empty-bubble {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    background: var(--grad-mint);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow);
    margin-bottom: 40rpx;
}
.empty-emoji {
    font-size: 88rpx;
    line-height: 1;
}
.empty-text {
    font-family: var(--font-serif);
    font-size: 36rpx;
    color: var(--ink);
    font-weight: 700;
    display: block;
}
.empty-hint {
    font-size: 24rpx;
    color: var(--muted);
    display: block;
    margin-top: 12rpx;
}

/* 旅行卡片：登机牌 / 明信片 */
.travel-row {
    position: relative;
    display: flex;
    flex-direction: column;
    margin-bottom: 36rpx;
    background: rgba(255, 255, 255, 0.82);
    border-radius: var(--r-l);
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 1rpx solid var(--card-border);
    transition:
        transform 0.15s ease,
        opacity 0.15s;
    animation-name: ticket-in;
    animation-duration: 0.7s;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    animation-fill-mode: backwards;
}
@keyframes ticket-in {
    from {
        opacity: 0;
        transform: translateY(40rpx);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.travel-row.dragging {
    opacity: 0.96;
    background: var(--card-solid);
    transition: none;
}

/* 封面 */
.ticket-cover {
    position: relative;
    height: 340rpx;
    overflow: hidden;
}
.ticket-cover.no-img {
    height: 260rpx;
}
.cover-planning.no-img {
    background: linear-gradient(135deg, #e6eff9 0%, var(--sky) 100%);
}
.cover-ongoing.no-img {
    background: linear-gradient(135deg, #fde9d9 0%, var(--peach) 100%);
}
.cover-completed.no-img {
    background: linear-gradient(135deg, #eaf3ec 0%, var(--sage) 100%);
}
.travel-cover {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
}
.cover-watermark {
    position: absolute;
    right: -20rpx;
    bottom: -60rpx;
    font-size: 280rpx;
    line-height: 1;
    color: rgba(255, 255, 255, 0.55);
    transform: rotate(-18deg);
}
.cover-shade {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}
.has-img .cover-shade {
    background: linear-gradient(
        180deg,
        rgba(30, 26, 23, 0.28) 0%,
        rgba(30, 26, 23, 0) 34%,
        rgba(30, 26, 23, 0.05) 55%,
        rgba(30, 26, 23, 0.62) 100%
    );
}
.cover-top {
    position: absolute;
    top: 24rpx;
    left: 28rpx;
    right: 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
}
.cover-eyebrow {
    font-size: 18rpx;
    letter-spacing: 0.28em;
    font-weight: 600;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.has-img .cover-eyebrow {
    color: rgba(255, 255, 255, 0.88);
}
.cover-bottom {
    position: absolute;
    left: 32rpx;
    right: 32rpx;
    bottom: 26rpx;
    display: flex;
    flex-direction: column;
}
.travel-name {
    font-size: 24rpx;
    font-weight: 500;
    color: var(--ink-2);
    letter-spacing: 0.06em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.travel-dest {
    font-family: var(--font-serif);
    font-size: 60rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.15;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.has-img .travel-name {
    color: rgba(255, 255, 255, 0.9);
}
.has-img .travel-dest {
    color: #fff;
    text-shadow: 0 4rpx 24rpx rgba(30, 26, 23, 0.35);
}

/* 状态胶囊 */
.status-pill {
    display: flex;
    align-items: center;
    gap: 10rpx;
    height: 48rpx;
    padding: 0 20rpx;
    border-radius: 999rpx;
    font-size: 20rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink);
    flex-shrink: 0;
    box-shadow: 0 8rpx 20rpx -10rpx rgba(30, 26, 23, 0.35);
}
.pill-planning {
    background: var(--sky);
}
.pill-ongoing {
    background: var(--peach);
}
.pill-completed {
    background: var(--sage);
}
.travel-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
    flex-shrink: 0;
}

/* 票根撕线 */
.ticket-perf {
    position: relative;
    height: 36rpx;
    display: flex;
    align-items: center;
}
.perf-line {
    flex: 1;
    margin: 0 36rpx;
    border-top: 3rpx dashed var(--faint);
}
.perf-notch {
    position: absolute;
    top: 0;
    width: 36rpx;
    height: 36rpx;
    border-radius: 50%;
    background: var(--bg);
}
.perf-notch.left {
    left: -18rpx;
}
.perf-notch.right {
    right: -18rpx;
}

/* 票面信息 */
.travel-body {
    padding: 4rpx 32rpx 28rpx;
}
.ticket-dates {
    display: flex;
    align-items: center;
    gap: 20rpx;
    margin-bottom: 8rpx;
}
.ticket-date-col {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
}
.ticket-date-col.right {
    align-items: flex-end;
}
.ticket-label {
    font-size: 18rpx;
    letter-spacing: 0.3em;
    color: var(--muted);
    font-weight: 600;
}
.travel-date {
    font-family: var(--font-serif);
    font-size: 32rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 2rpx;
}
.ticket-route {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10rpx;
    min-width: 0;
    padding-top: 22rpx;
}
.route-line {
    flex: 1;
    height: 2rpx;
    background: var(--line);
}
.route-plane {
    font-size: 24rpx;
    color: var(--ink-2);
}
.travel-notes {
    font-size: 24rpx;
    color: var(--ink-2);
    display: block;
    margin-top: 16rpx;
    padding: 16rpx 22rpx;
    background: var(--bg);
    border-radius: var(--r-s);
    line-height: 1.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.travel-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-top: 24rpx;
}
.travel-time {
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.04em;
}
.travel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    align-items: center;
    margin-left: auto;
}
.travel-act {
    height: 52rpx;
    line-height: 52rpx;
    font-size: 22rpx;
    color: var(--ink-2);
    padding: 0 20rpx;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
    border-radius: 999rpx;
}
.travel-act.next {
    background: var(--ink);
    border-color: var(--ink);
    color: #fff;
    font-weight: 600;
}
.travel-act.active {
    color: var(--ink);
    background: var(--butter);
    border-color: transparent;
}
.travel-act.del {
    color: var(--coral);
    background: rgba(224, 122, 95, 0.08);
    border-color: transparent;
}

.bottom-space {
    height: 80rpx;
}
</style>
