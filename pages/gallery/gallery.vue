<template>
    <page-bg tone="rose" />
    <view class="gallery-page">
        <!-- 杂志式标题区 + 操作按钮 -->
        <view class="hero ui-fade-up">
            <view class="hero-text">
                <text class="ui-eyebrow">MOMENTS</text>
                <text class="ui-title hero-title">相册</text>
                <text class="ui-sub">{{ allPhotosData.length || photos.length }} 张照片 · {{ categories.length }} 个分类</text>
            </view>
            <view class="top-bar">
                <view
                    class="top-btn outline ui-press"
                    :class="{ on: showCategoryManager }"
                    @tap="showCategoryManager = !showCategoryManager"
                >
                    <text>分类</text>
                </view>
                <view class="top-btn outline ui-press" :class="{ on: editing }" @tap="toggleEdit">
                    <text>{{ editing ? '完成' : '编辑' }}</text>
                </view>
                <view class="top-btn primary ui-press" @tap="showUpload = !showUpload">
                    <text>{{ showUpload ? '取消' : '+ 上传' }}</text>
                </view>
            </view>
        </view>

        <scroll-view class="scroll-area" :scroll-y="!dragging">
            <!-- 分类管理 -->
            <view class="section ui-fade-up" v-if="showCategoryManager">
                <view class="card">
                    <view class="card-head">
                        <text class="ui-eyebrow">CATEGORIES</text>
                        <text class="card-title">管理分类</text>
                    </view>
                    <view class="form-row">
                        <view class="form-icon">{{ newCatEmoji }}</view>
                        <input
                            class="form-input"
                            v-model="newCatName"
                            placeholder="新分类名称"
                            @confirm="handleAddCategory"
                        />
                        <view class="form-btn ui-press" @tap="handleAddCategory">添加</view>
                    </view>
                    <view class="form-col">
                        <text class="form-label">选择图标</text>
                        <view class="emoji-row">
                            <view
                                v-for="emoji in CATEGORY_EMOJIS"
                                :key="emoji"
                                class="emoji-chip ui-press"
                                :class="{ active: newCatEmoji === emoji }"
                                @tap="newCatEmoji = emoji"
                            >
                                <text>{{ emoji }}</text>
                            </view>
                        </view>
                    </view>
                    <view v-if="categories.length > 0">
                        <view class="divider"></view>
                        <view class="cat-item" v-for="cat in categories" :key="cat.id">
                            <view class="cat-emoji">{{ cat.emoji }}</view>
                            <text class="cat-name">{{ cat.name }}</text>
                            <text class="cat-count">{{ getCategoryPhotoCount(cat.name) }}张</text>
                            <text class="cat-del" @tap="handleDeleteCategory(cat.id)">×</text>
                        </view>
                    </view>
                    <view class="cat-done-row">
                        <view class="cat-done-btn ui-press" @tap="showCategoryManager = false">
                            <text>完成</text>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 上传面板 -->
            <photo-upload-panel
                v-if="showUpload"
                :categories="categories"
                :sort-order="newPhotoSortOrder()"
                @uploaded="onUploaded"
            />

            <!-- 分类筛选 -->
            <view class="filter-bar ui-fade-up ui-d1" v-if="categories.length > 0 && !editing">
                <view class="filter-tag" :class="{ active: !selectedCategory }" @tap="selectedCategory = ''">
                    <text>全部</text>
                    <text class="filter-count">{{ photos.length }}</text>
                </view>
                <view
                    class="filter-tag"
                    :class="{ active: selectedCategory === cat.name }"
                    v-for="cat in categories"
                    :key="cat.id"
                    @tap="selectedCategory = cat.name"
                >
                    <text>{{ cat.emoji }} {{ cat.name }}</text>
                    <text class="filter-count">{{ getCategoryPhotoCount(cat.name) }}</text>
                </view>
            </view>

            <!-- 空状态 -->
            <view v-if="filteredPhotos.length === 0 && !editing" class="empty ui-fade-up ui-d2">
                <view class="empty-bubble">
                    <text class="empty-icon">📷</text>
                </view>
                <text class="empty-text">{{ selectedCategory ? '该分类还没有照片' : '还没有照片' }}</text>
                <text class="empty-hint" v-if="!selectedCategory">点击右上角"+ 上传"添加第一张照片</text>
            </view>

            <!-- 照片网格 -->
            <view v-else-if="filteredPhotos.length > 0" class="photo-grid" :class="{ 'is-editing': editing }">
                <view
                    class="photo-item"
                    v-for="(photo, idx) in filteredPhotos"
                    :key="photo.id"
                    :class="[
                        {
                            'is-dragging': dragFromIdx === idx,
                            'is-drag-target': dragOverIdx === idx && dragFromIdx !== null,
                            'is-selected': editing && selectedIds.includes(photo.id),
                        },
                        'ui-d' + ((idx % 6) + 1),
                    ]"
                    :style="
                        dragFromIdx === idx && dragMoved
                            ? { transform: 'translate(' + dragDx + 'px,' + dragDy + 'px)', zIndex: 10, opacity: 0.85 }
                            : {}
                    "
                    @touchstart="editing ? onDragStart($event, idx) : null"
                    @touchmove="dragFromIdx !== null ? onDragMove($event) : null"
                    @touchend="dragFromIdx !== null ? onDragEnd() : null"
                    @tap="editing ? (dragMoved ? null : toggleSelect(photo.id)) : openPhotoDetail(photo)"
                >
                    <image
                        v-if="photo.displayUrl"
                        :src="photo.displayUrl"
                        class="photo-img"
                        mode="aspectFill"
                        lazy-load
                    />
                    <view class="photo-shade"></view>
                    <view class="select-mark" :class="{ on: selectedIds.includes(photo.id) }">
                        <text class="select-mark-icon" v-if="selectedIds.includes(photo.id)">✓</text>
                    </view>
                    <view class="drag-handle" v-if="editing">
                        <text class="drag-handle-icon">⠿</text>
                    </view>
                    <view class="photo-like-badge" v-if="!editing && likeCounts[photo.id]" @tap.stop>
                        <text>❤ {{ likeCounts[photo.id] }}</text>
                    </view>
                </view>
            </view>

            <view v-if="hasMorePhotos && !editing" class="load-more-wrap">
                <view class="load-more-btn ui-press" :class="{ disabled: loadingMore }" @tap="loadMorePhotos">
                    <text>{{
                        loadingMore
                            ? '加载中...'
                            : '加载更多 (' + filteredPhotos.length + '/' + allPhotosData.length + ')'
                    }}</text>
                </view>
            </view>

            <view class="bottom-space"></view>
        </scroll-view>

        <!-- 编辑底栏：悬浮毛玻璃胶囊 -->
        <view class="edit-bar ui-fade-up" v-if="editing">
            <view class="edit-bar-btn ghost ui-press" @tap="toggleSelectAll">
                <text>{{
                    selectedIds.length === filteredPhotos.length && filteredPhotos.length > 0 ? '取消全选' : '全选'
                }}</text>
            </view>
            <view class="edit-count">
                <text class="edit-count-num">{{ selectedIds.length }}</text>
                <text class="edit-count-unit">张已选</text>
            </view>
            <view class="edit-bar-actions">
                <view class="edit-bar-btn ui-press" @tap="handleMove" :class="{ disabled: selectedIds.length === 0 }"
                    ><text>移动</text></view
                >
                <view
                    class="edit-bar-btn danger ui-press"
                    @tap="handleBatchDelete"
                    :class="{ disabled: selectedIds.length === 0 }"
                    ><text>删除</text></view
                >
            </view>
        </view>

        <!-- 分类选择弹窗 -->
        <view class="picker-mask" v-if="showCatPicker" @tap="showCatPicker = false">
            <view class="picker-sheet" @tap.stop>
                <view class="sheet-grabber"></view>
                <text class="ui-eyebrow picker-eyebrow">MOVE TO</text>
                <view class="picker-title">移动到分类</view>
                <view class="picker-item" v-for="cat in categories" :key="cat.id" @tap="confirmMove(cat.name)">
                    <view class="picker-emoji">{{ cat.emoji }}</view>
                    <text class="picker-name">{{ cat.name }}</text>
                    <text class="picker-arrow">›</text>
                </view>
            </view>
        </view>

        <!-- 照片详情弹窗 -->
        <photo-detail-sheet
            v-if="detailPhoto"
            :photo="detailPhoto"
            :liked="!!likedByMe[detailPhoto.id]"
            :like-count="likeCounts[detailPhoto.id] || 0"
            :current-user-id="currentUserId"
            @close="detailPhoto = null"
            @toggleLike="toggleLike(detailPhoto)"
        />
    </view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import PhotoUploadPanel from './components/photo-upload-panel.vue'
import PhotoDetailSheet from './components/photo-detail-sheet.vue'
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
    dbAdd,
    dbDelete,
    dbBatchUpdate,
    fetchAllRecords,
    resolveFileUrls,
    setPCache,
    getPCache,
    clearPCache,
    cacheFileUrls,
    restoreFileUrls,
} from '../../utils/cloud'
import { CATEGORY_EMOJIS } from '../../utils/constants'
import { useInteractions } from '../../utils/useInteractions'
import { useGridDrag } from '../../utils/useDragSort'

const photos = ref([])
const categories = ref([])
const showUpload = ref(false)
const showCategoryManager = ref(false)
const selectedCategory = ref('')
const newCatName = ref('')
const newCatEmoji = ref('📷')
const editing = ref(false)
const selectedIds = ref([])
const showCatPicker = ref(false)

// 点赞评论状态
const { likeCounts, likedByMe, currentUserId, loadInteractions, toggleLike } = useInteractions('photo')
const detailPhoto = ref(null)

// 分页加载
const PHOTO_PAGE = 20
const photoPage = ref(1)
const allPhotosData = []
const hasMorePhotos = ref(false)
const loadingMore = ref(false)

const filteredPhotos = computed(() => {
    if (!selectedCategory.value) return photos.value
    return photos.value.filter(p => p.category === selectedCategory.value)
})

const getCategoryPhotoCount = name => photos.value.filter(p => p.category === name).length

// ===== 数据加载 =====
const loadData = async () => {
    const u = uni.getStorageSync('auth_user')
    currentUserId.value = u?._id || ''
    // 照片的 categoryName 依赖分类数据，必须先加载分类
    await loadCategories()
    await loadPhotos()
    await loadInteractionsData()
}

const loadInteractionsData = async () => {
    const ids = photos.value.map(p => p.id)
    await loadInteractions(ids)
}

const loadCategories = async () => {
    try {
        categories.value = await fetchAllRecords('gallery_categories', { orderBy: 'sort_order', orderType: 'asc' })
    } catch (e) {
        console.error('[相册] 加载分类失败:', e)
        uni.showToast({ title: '加载分类失败，请确认已部署db云函数', icon: 'none', duration: 2500 })
        categories.value = []
    }
}

const loadPhotos = async () => {
    photoPage.value = 1
    // 缓存优先：缓存数据已含 displayUrl，瞬间渲染
    const cached = getPCache('gallery')
    if (cached && cached.length > 0) {
        allPhotosData.length = 0
        allPhotosData.push(...cached)
        const page = allPhotosData.slice(0, PHOTO_PAGE)
        photos.value = page.map(p => {
            const cat = categories.value.find(c => c.id === p.categoryId)
            return { ...p, categoryName: cat ? `${cat.emoji} ${cat.name}` : '' }
        })
        hasMorePhotos.value = allPhotosData.length > PHOTO_PAGE
        // 后台静默刷新（确保临时 URL 未过期）
        _fetchPhotosFromNetwork()
        return
    }
    await _fetchPhotosFromNetwork()
}

const _fetchPhotosFromNetwork = async () => {
    try {
        // 自动分页拉取全部照片（db 云函数单次最多返回 100 条）
        const allRecords = await fetchAllRecords('gallery_photos', { orderBy: 'sort_order', orderType: 'asc' })
        if (allRecords) {
            allPhotosData.length = 0
            allPhotosData.push(...allRecords)
            const page = allPhotosData.slice(0, PHOTO_PAGE * photoPage.value)
            photos.value = page.map(p => {
                const cat = categories.value.find(c => c.id === p.categoryId)
                return { ...p, categoryName: cat ? `${cat.emoji} ${cat.name}` : '' }
            })
            await resolveFileUrls(photos.value, 'fileID', 'displayUrl')
            cacheFileUrls(photos.value, 'fileID', 'displayUrl')
            // 将 displayUrl 回写到 allPhotosData，确保缓存数据含图片地址
            photos.value.forEach(p => {
                const raw = allPhotosData.find(r => r.id === p.id)
                if (raw && p.displayUrl) raw.displayUrl = p.displayUrl
            })
            setPCache('gallery', [...allPhotosData])
            hasMorePhotos.value = allPhotosData.length > page.length
        }
    } catch (e) {
        console.error('[相册] 加载照片失败:', e)
        if (photos.value.length === 0) {
            uni.showToast({ title: '加载照片失败', icon: 'none', duration: 2500 })
        }
    }
}

const loadMorePhotos = async () => {
    if (loadingMore.value || !hasMorePhotos.value) return
    loadingMore.value = true
    photoPage.value++
    const end = PHOTO_PAGE * photoPage.value
    const nextPage = allPhotosData.slice(0, end)
    photos.value = nextPage.map(p => {
        const cat = categories.value.find(c => c.id === p.categoryId)
        return { ...p, categoryName: cat ? `${cat.emoji} ${cat.name}` : '' }
    })
    restoreFileUrls(photos.value, 'fileID', 'displayUrl')
    // 只转换新增的图片 URL
    const newOnes = photos.value.filter(p => !p.displayUrl)
    if (newOnes.length > 0) await resolveFileUrls(newOnes, 'fileID', 'displayUrl')
    hasMorePhotos.value = allPhotosData.length > end
    loadingMore.value = false
}

// ===== 照片详情弹窗 =====
const openPhotoDetail = photo => {
    detailPhoto.value = photo
}

// ===== 编辑模式 =====
const toggleEdit = () => {
    editing.value = !editing.value
    selectedIds.value = []
    selectedCategory.value = ''
}

// ===== 拖拽排序 =====
// 模板渲染 filteredPhotos，交换作用到 photos 上；未加载的分页接在后面一起写回顺序
const { dragging, dragFromIdx, dragOverIdx, dragDx, dragDy, dragMoved, onDragStart, onDragMove, onDragEnd } =
    useGridDrag(filteredPhotos, {
        collection: 'gallery_photos',
        backingRef: photos,
        extendList: loaded => {
            const loadedIds = new Set(loaded.map(p => p.id))
            return [...loaded, ...allPhotosData.filter(p => !loadedIds.has(p.id))]
        },
        onDrop: async () => {
            clearPCache('gallery')
            await loadPhotos()
        },
    })
const toggleSelect = id => {
    const idx = selectedIds.value.indexOf(id)
    if (idx === -1) selectedIds.value.push(id)
    else selectedIds.value.splice(idx, 1)
}
const toggleSelectAll = () => {
    if (selectedIds.value.length === filteredPhotos.value.length) selectedIds.value = []
    else selectedIds.value = filteredPhotos.value.map(p => p.id)
}

// ===== 上传 =====
// 新照片排在最前：取当前最小 sort_order 再减 1
const newPhotoSortOrder = () => (allPhotosData.length ? Math.min(...allPhotosData.map(p => p.sort_order || 0)) : 0) - 1
const onUploaded = async () => {
    showUpload.value = false
    clearPCache('gallery')
    await loadPhotos()
}

// ===== 移动 =====
const handleMove = () => {
    if (selectedIds.value.length > 0) showCatPicker.value = true
}
const confirmMove = async catName => {
    showCatPicker.value = false
    const cat = categories.value.find(c => c.name === catName)
    if (!cat) return
    const updates = selectedIds.value
        .map(pid => photos.value.find(p => p.id === pid))
        .filter(p => p?._id)
        .map(p => ({ id: p._id, data: { category: cat.name, categoryId: cat.id } }))
    let ok = true
    try {
        await dbBatchUpdate('gallery_photos', updates)
    } catch (e) {
        ok = false
        console.error('[相册] 移动失败:', e)
    }
    selectedIds.value = []
    clearPCache('gallery')
    await loadPhotos()
    uni.showToast({ title: ok ? '已移动' : '移动失败', icon: ok ? 'success' : 'none' })
}

// ===== 删除 =====
const handleBatchDelete = () => {
    if (selectedIds.value.length === 0) return
    uni.showModal({
        title: '确认删除',
        content: `确定删除 ${selectedIds.value.length} 张照片？`,
        success: async res => {
            if (res.confirm) {
                // 云函数删除记录时会同步删除图片文件和点赞/评论
                let failed = 0
                await Promise.all(
                    selectedIds.value.map(async pid => {
                        const photo = photos.value.find(p => p.id === pid)
                        if (!photo?._id) return
                        try {
                            await dbDelete('gallery_photos', photo._id)
                        } catch (e) {
                            failed++
                            console.error('[相册] 删除失败:', e)
                        }
                    })
                )
                selectedIds.value = []
                clearPCache('gallery')
                await loadPhotos()
                uni.showToast(
                    failed ? { title: `${failed} 张删除失败`, icon: 'none' } : { title: '已删除', icon: 'success' }
                )
            }
        },
    })
}

// ===== 分类管理 =====
const handleAddCategory = () => {
    const name = newCatName.value.trim()
    if (!name) return
    if (categories.value.some(c => c.name === name)) {
        uni.showToast({ title: '该分类已存在', icon: 'none' })
        return
    }
    const catData = { id: 'c_' + Date.now(), name, emoji: newCatEmoji.value, sort_order: categories.value.length }
    dbAdd('gallery_categories', catData)
        .then(addRes => {
            if (addRes?._id) catData._id = addRes._id
            categories.value.push(catData)
            newCatName.value = ''
            newCatEmoji.value = '📷'
            clearPCache('gallery')
            uni.showToast({ title: '添加成功', icon: 'success' })
        })
        .catch(e => {
            console.error('[相册] 添加分类失败:', e)
            uni.showToast({ title: '添加失败', icon: 'none' })
        })
}

const handleDeleteCategory = id => {
    const cat = categories.value.find(c => c.id === id)
    if (!cat) return
    const count = getCategoryPhotoCount(cat.name)
    uni.showModal({
        title: '确认',
        content: count > 0 ? `${count} 张照片将变为未分类，确定？` : '确定删除？',
        success: async res => {
            if (res.confirm) {
                try {
                    await dbDelete('gallery_categories', cat._id)
                    // 用全部照片（而不只是已加载的分页）找出该分类下的照片
                    const orphanPhotos = allPhotosData.filter(p => p.category === cat.name && p._id)
                    await dbBatchUpdate(
                        'gallery_photos',
                        orphanPhotos.map(p => ({ id: p._id, data: { category: '', categoryId: '' } }))
                    )
                    categories.value = categories.value.filter(c => c.id !== id)
                    clearPCache('gallery')
                    await loadPhotos()
                    uni.showToast({ title: '已删除', icon: 'success' })
                } catch (e) {
                    uni.showToast({ title: '删除失败', icon: 'none' })
                }
            }
        },
    })
}

// 选图（chooseImage）、预览（previewImage）返回也会触发 onShow：
// 只在首次显示或距上次加载超过 60 秒时重新拉取，避免频繁全量刷新并把分页重置回第 1 页
const RELOAD_INTERVAL = 60 * 1000
let _lastLoadAt = 0
onShow(() => {
    if (Date.now() - _lastLoadAt < RELOAD_INTERVAL) return
    _lastLoadAt = Date.now()
    loadData()
})
</script>

<style scoped>
.gallery-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: transparent;
}

/* 标题区 */
.hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 36rpx 32rpx 20rpx;
    flex-shrink: 0;
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
    gap: 12rpx;
    flex-shrink: 0;
    padding-bottom: 8rpx;
}
.top-btn {
    height: 64rpx;
    padding: 0 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-size: 24rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    box-shadow: 0 16rpx 32rpx -16rpx rgba(30, 26, 23, 0.6);
}
.top-btn.outline {
    background: rgba(255, 255, 255, 0.72);
    color: var(--ink);
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    font-weight: 500;
}
.top-btn.outline.on {
    background: var(--ink-2);
    color: #fff;
    border-color: var(--ink-2);
}
.scroll-area {
    flex: 1;
    overflow-y: auto;
    background: transparent;
    -webkit-overflow-scrolling: touch;
}

/* 分类管理卡片 */
.section {
    padding: 12rpx 32rpx 8rpx;
}
.card {
    background: var(--card);
    border-radius: var(--r-xl);
    padding: 8rpx 0 8rpx;
    margin-bottom: 0;
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 1rpx solid var(--card-border);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.card-head {
    display: flex;
    flex-direction: column;
    padding: 28rpx 36rpx 8rpx;
}
.card-title {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 4rpx;
}
.form-row {
    display: flex;
    align-items: center;
    margin: 16rpx 28rpx 0;
    padding: 12rpx 12rpx 12rpx 12rpx;
    gap: 16rpx;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
    border-radius: 999rpx;
}
.form-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: var(--rose);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    flex-shrink: 0;
}
.form-input {
    flex: 1;
    font-size: 28rpx;
    color: var(--ink);
    background: transparent;
    border: none;
    padding: 0;
}
.form-btn {
    height: 64rpx;
    padding: 0 32rpx;
    display: flex;
    align-items: center;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-size: 24rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    flex-shrink: 0;
}
.form-col {
    padding: 28rpx 36rpx 20rpx;
}
.form-label {
    font-size: 20rpx;
    color: var(--muted);
    display: block;
    margin-bottom: 18rpx;
    letter-spacing: 0.24em;
    font-weight: 600;
}
.divider {
    height: 1rpx;
    background: var(--line);
    margin: 8rpx 36rpx;
}
.emoji-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14rpx;
}
.emoji-chip {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.85);
    border: 1rpx solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    box-sizing: border-box;
}
.emoji-chip.active {
    background: var(--butter);
    border: 3rpx solid var(--ink);
}
.cat-item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 18rpx 36rpx;
}
.cat-emoji {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    flex-shrink: 0;
}
.cat-name {
    font-size: 28rpx;
    color: var(--ink);
    font-weight: 500;
    flex: 1;
}
.cat-count {
    font-family: var(--font-serif);
    font-size: 24rpx;
    color: var(--muted);
}
.cat-del {
    width: 52rpx;
    height: 52rpx;
    line-height: 48rpx;
    text-align: center;
    border-radius: 50%;
    font-size: 32rpx;
    color: var(--coral);
    background: rgba(224, 122, 95, 0.1);
}
.cat-done-row {
    display: flex;
    justify-content: flex-end;
    padding: 16rpx 36rpx 28rpx;
}
.cat-done-btn {
    height: 72rpx;
    padding: 0 44rpx;
    display: flex;
    align-items: center;
    border-radius: 999rpx;
    background: var(--ink);
    box-shadow: 0 16rpx 32rpx -16rpx rgba(30, 26, 23, 0.6);
}
.cat-done-btn text {
    font-size: 26rpx;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.08em;
}

/* 分类筛选胶囊 */
.filter-bar {
    padding: 12rpx 32rpx 20rpx;
    white-space: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}
.filter-tag {
    display: inline-flex;
    align-items: center;
    gap: 10rpx;
    height: 64rpx;
    padding: 0 26rpx;
    background: rgba(255, 255, 255, 0.72);
    border-radius: 999rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    margin-right: 14rpx;
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
    vertical-align: middle;
}
.filter-tag.active {
    background: var(--ink);
    color: #fff;
    border-color: var(--ink);
}
.filter-count {
    font-family: var(--font-serif);
    font-size: 22rpx;
    opacity: 0.55;
}

/* 空状态 */
.empty {
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
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow);
    margin-bottom: 40rpx;
}
.empty-icon {
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

/* 照片网格：INS 风格圆角方块 */
.photo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12rpx;
    padding: 4rpx 24rpx 0;
}
.photo-item {
    position: relative;
    border-radius: var(--r-m);
    overflow: hidden;
    background: var(--bg-2);
    box-shadow: var(--shadow-soft);
    animation-name: tile-in;
    animation-duration: 0.7s;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    animation-fill-mode: backwards;
}
@keyframes tile-in {
    from {
        opacity: 0;
        transform: translateY(28rpx) scale(0.98);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}
.is-editing .photo-item {
    transition:
        transform 0.12s,
        opacity 0.12s;
}
.photo-img {
    width: 100%;
    height: 430rpx;
    display: block;
}
.photo-shade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 120rpx;
    background: linear-gradient(180deg, rgba(30, 26, 23, 0) 0%, rgba(30, 26, 23, 0.28) 100%);
    pointer-events: none;
    z-index: 1;
}
.photo-item.is-selected::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 5rpx solid var(--ink);
    border-radius: inherit;
    background: rgba(255, 255, 255, 0.18);
    z-index: 1;
    pointer-events: none;
}

/* 加载更多 */
.load-more-wrap {
    padding: 36rpx 32rpx 8rpx;
    text-align: center;
}
.load-more-btn {
    display: inline-flex;
    align-items: center;
    height: 76rpx;
    padding: 0 48rpx;
    background: rgba(255, 255, 255, 0.72);
    border-radius: 999rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    letter-spacing: 0.06em;
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
}
.load-more-btn.disabled {
    opacity: 0.5;
}

/* 拖拽 & 选择 */
.is-dragging {
    box-shadow: 0 40rpx 80rpx -24rpx rgba(80, 56, 36, 0.45);
}
.is-drag-target {
    opacity: 0.5;
}
.drag-handle {
    position: absolute;
    bottom: 14rpx;
    right: 14rpx;
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background: rgba(30, 26, 23, 0.32);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
}
.drag-handle-icon {
    color: #fff;
    font-size: 28rpx;
    line-height: 1;
}
.select-mark {
    position: absolute;
    top: 16rpx;
    right: 16rpx;
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.35);
    border: 3rpx solid rgba(255, 255, 255, 0.95);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all 0.15s;
    z-index: 2;
}
.is-editing .select-mark {
    opacity: 1;
}
.select-mark.on {
    background: var(--ink);
    border-color: #fff;
}
.select-mark-icon {
    color: #fff;
    font-size: 24rpx;
    font-weight: 700;
}

.bottom-space {
    height: 240rpx;
}

/* 编辑底栏：悬浮毛玻璃胶囊 */
.edit-bar {
    position: fixed;
    left: 32rpx;
    right: 32rpx;
    bottom: calc(32rpx + env(safe-area-inset-bottom));
    z-index: 100;
    height: 112rpx;
    padding: 0 16rpx;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1rpx solid var(--card-border);
    border-radius: 999rpx;
    box-shadow: 0 32rpx 64rpx -24rpx rgba(80, 56, 36, 0.4);
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.edit-bar-btn {
    height: 80rpx;
    padding: 0 30rpx;
    display: flex;
    align-items: center;
    background: var(--ink);
    border-radius: 999rpx;
    font-size: 26rpx;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.04em;
}
.edit-bar-btn.ghost {
    background: rgba(255, 255, 255, 0.8);
    color: var(--ink);
    border: 1rpx solid var(--line);
    font-weight: 500;
}
.edit-bar-btn.disabled {
    opacity: 0.3;
}
.edit-bar-btn.danger {
    background: rgba(224, 122, 95, 0.12);
    color: var(--coral);
}
.edit-bar-actions {
    display: flex;
    gap: 12rpx;
}
.edit-count {
    display: flex;
    align-items: baseline;
    gap: 6rpx;
}
.edit-count-num {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
}
.edit-count-unit {
    font-size: 22rpx;
    color: var(--muted);
}

/* 分类选择弹窗 */
.picker-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background: rgba(30, 26, 23, 0.35);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: flex-end;
}
.picker-sheet {
    width: 100%;
    background: var(--card-solid);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    padding: 16rpx 32rpx;
    padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: stretch;
}
.sheet-grabber {
    width: 72rpx;
    height: 8rpx;
    border-radius: 8rpx;
    background: var(--faint);
    align-self: center;
    margin-bottom: 28rpx;
}
.picker-eyebrow {
    text-align: center;
}
.picker-title {
    font-family: var(--font-serif);
    font-size: 40rpx;
    font-weight: 700;
    color: var(--ink);
    text-align: center;
    padding: 6rpx 0 28rpx;
}
.picker-item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 20rpx 24rpx;
    margin-bottom: 12rpx;
    border-radius: var(--r-m);
    background: var(--bg);
}
.picker-item:active {
    background: var(--bg-2);
}
.picker-emoji {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    background: var(--card-solid);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
}
.picker-name {
    flex: 1;
    font-size: 28rpx;
    font-weight: 500;
    color: var(--ink);
}
.picker-arrow {
    font-size: 36rpx;
    color: var(--faint);
}

/* 照片点赞角标 */
.photo-like-badge {
    position: absolute;
    bottom: 14rpx;
    left: 14rpx;
    padding: 6rpx 16rpx;
    background: rgba(30, 26, 23, 0.32);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1rpx solid rgba(255, 255, 255, 0.25);
    border-radius: 999rpx;
    font-size: 20rpx;
    color: #fff;
    letter-spacing: 0.04em;
    z-index: 2;
}
</style>
