<template>
    <view class="gallery-page">
        <!-- 顶部栏 -->
        <view class="top-bar">
            <view class="top-btn outline" @tap="showCategoryManager = !showCategoryManager">
                <text>分类</text>
            </view>
            <view class="top-btn outline" @tap="toggleEdit">
                <text>{{ editing ? '完成' : '编辑' }}</text>
            </view>
            <view class="top-btn primary" @tap="showUpload = !showUpload">
                <text>{{ showUpload ? '取消' : '+ 上传' }}</text>
            </view>
        </view>

        <scroll-view class="scroll-area" :scroll-y="!dragging">
            <!-- 分类管理 -->
            <view class="section" v-if="showCategoryManager">
                <view class="card">
                    <view class="form-row">
                        <text class="form-icon">🏷️</text>
                        <input
                            class="form-input"
                            v-model="newCatName"
                            placeholder="新分类名称"
                            @confirm="handleAddCategory"
                        />
                        <view class="form-btn" @tap="handleAddCategory">添加</view>
                    </view>
                    <view class="divider"></view>
                    <view class="form-col">
                        <text class="form-label">选择图标</text>
                        <view class="emoji-row">
                            <view
                                v-for="emoji in CATEGORY_EMOJIS"
                                :key="emoji"
                                class="emoji-chip"
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
                            <text class="cat-emoji">{{ cat.emoji }}</text>
                            <text class="cat-name">{{ cat.name }}</text>
                            <text class="cat-count">{{ getCategoryPhotoCount(cat.name) }}张</text>
                            <text class="cat-del" @tap="handleDeleteCategory(cat.id)">×</text>
                        </view>
                    </view>
                    <view class="cat-done-row">
                        <view class="cat-done-btn" @tap="showCategoryManager = false">
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
            <view class="filter-bar" v-if="categories.length > 0 && !editing">
                <view class="filter-tag" :class="{ active: !selectedCategory }" @tap="selectedCategory = ''">
                    全部 ({{ photos.length }})
                </view>
                <view
                    class="filter-tag"
                    :class="{ active: selectedCategory === cat.name }"
                    v-for="cat in categories"
                    :key="cat.id"
                    @tap="selectedCategory = cat.name"
                >
                    {{ cat.emoji }} {{ cat.name }} ({{ getCategoryPhotoCount(cat.name) }})
                </view>
            </view>

            <!-- 空状态 -->
            <view v-if="filteredPhotos.length === 0 && !editing" class="empty">
                <text class="empty-icon">📷</text>
                <text class="empty-text">{{ selectedCategory ? '该分类还没有照片' : '还没有照片' }}</text>
                <text class="empty-hint" v-if="!selectedCategory">点击右上角"+ 上传"添加第一张照片</text>
            </view>

            <!-- 照片网格 -->
            <view v-else-if="filteredPhotos.length > 0" class="photo-grid" :class="{ 'is-editing': editing }">
                <view
                    class="photo-item"
                    v-for="(photo, idx) in filteredPhotos"
                    :key="photo.id"
                    :class="{
                        'is-dragging': dragFromIdx === idx,
                        'is-drag-target': dragOverIdx === idx && dragFromIdx !== null,
                    }"
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
                <view class="load-more-btn" :class="{ disabled: loadingMore }" @tap="loadMorePhotos">
                    <text>{{
                        loadingMore
                            ? '加载中...'
                            : '加载更多 (' + filteredPhotos.length + '/' + allPhotosData.length + ')'
                    }}</text>
                </view>
            </view>

            <view class="bottom-space"></view>
        </scroll-view>

        <!-- 编辑底栏 -->
        <view class="edit-bar" v-if="editing">
            <view class="edit-bar-btn" @tap="toggleSelectAll">
                <text>{{
                    selectedIds.length === filteredPhotos.length && filteredPhotos.length > 0 ? '取消全选' : '全选'
                }}</text>
            </view>
            <text class="edit-count">{{ selectedIds.length }} 张已选</text>
            <view class="edit-bar-actions">
                <view class="edit-bar-btn" @tap="handleMove" :class="{ disabled: selectedIds.length === 0 }"
                    ><text>移动</text></view
                >
                <view
                    class="edit-bar-btn danger"
                    @tap="handleBatchDelete"
                    :class="{ disabled: selectedIds.length === 0 }"
                    ><text>删除</text></view
                >
            </view>
        </view>

        <!-- 分类选择弹窗 -->
        <view class="picker-mask" v-if="showCatPicker" @tap="showCatPicker = false">
            <view class="picker-sheet" @tap.stop>
                <view class="picker-title">移动到分类</view>
                <view class="picker-item" v-for="cat in categories" :key="cat.id" @tap="confirmMove(cat.name)">
                    <text>{{ cat.emoji }} {{ cat.name }}</text>
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
    background: linear-gradient(180deg, #e8eef4 0%, #d8e2ec 100%);
}
.top-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 24rpx 32rpx 20rpx;
    background: transparent;
    flex-shrink: 0;
    gap: 10rpx;
}
.top-btn {
    padding: 8rpx 20rpx;
    background: #7a96b0;
    color: #fff;
    border-radius: 24rpx;
    font-size: 22rpx;
    letter-spacing: 1rpx;
}
.top-btn.outline {
    background: transparent;
    color: #6884a0;
    border: 1rpx solid rgba(104, 132, 160, 0.4);
}
.top-btn:active {
    opacity: 0.8;
}
.scroll-area {
    flex: 1;
    overflow-y: auto;
    background: transparent;
    -webkit-overflow-scrolling: touch;
}
.section {
    padding: 16rpx 32rpx 0;
}
.card {
    background: #fff;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.03);
    border: 1rpx solid rgba(142, 142, 147, 0.06);
}
.form-row {
    display: flex;
    align-items: center;
    padding: 24rpx 28rpx;
    gap: 16rpx;
}
.form-icon {
    font-size: 32rpx;
    flex-shrink: 0;
}
.form-input {
    flex: 1;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
}
.form-btn {
    padding: 10rpx 24rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 16rpx;
    font-size: 24rpx;
    flex-shrink: 0;
}
.form-col {
    padding: 24rpx 28rpx;
}
.form-label {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-bottom: 12rpx;
    letter-spacing: 1rpx;
}
.divider {
    height: 1rpx;
    background: rgba(142, 142, 147, 0.06);
    margin: 0 28rpx;
}
.emoji-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
}
.emoji-chip {
    width: 56rpx;
    height: 56rpx;
    border-radius: 28rpx;
    background: #f2f2f7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    border: 2rpx solid transparent;
}
.emoji-chip.active {
    background: linear-gradient(135deg, #f8ece4 0%, #f2ddd0 100%);
    border-color: #8e8e93;
    transform: scale(1.1);
}
.cat-item {
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding: 18rpx 28rpx;
}
.cat-item + .cat-item {
    border-top: 1rpx solid rgba(142, 142, 147, 0.06);
}
.cat-emoji {
    font-size: 32rpx;
}
.cat-name {
    font-size: 28rpx;
    color: #1c1c1e;
    flex: 1;
}
.cat-count {
    font-size: 22rpx;
    color: #8e8e93;
}
.cat-del {
    font-size: 32rpx;
    color: #ff3b30;
    padding: 4rpx 8rpx;
}
.cat-done-row {
    display: flex;
    justify-content: flex-end;
    padding: 16rpx 28rpx;
}
.cat-done-btn {
    padding: 12rpx 36rpx;
    border: 2rpx solid rgba(142, 142, 147, 0.2);
    border-radius: 16rpx;
}
.cat-done-btn text {
    font-size: 26rpx;
    color: #1c1c1e;
    font-weight: 500;
    letter-spacing: 2rpx;
}
.filter-bar {
    padding: 20rpx 32rpx 16rpx;
    white-space: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}
.filter-tag {
    display: inline-block;
    padding: 14rpx 28rpx;
    background: #fff;
    border-radius: 24rpx;
    font-size: 24rpx;
    color: #3a3a3c;
    margin-right: 12rpx;
    border: 1rpx solid rgba(142, 142, 147, 0.08);
}
.filter-tag.active {
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-color: transparent;
}
.empty {
    text-align: center;
    padding: 160rpx 0 120rpx;
}
.empty-icon {
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

/* 照片网格 */
.photo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8rpx;
    padding: 16rpx 24rpx 0;
}
.photo-grid.is-editing {
    gap: 10rpx;
}
.photo-item {
    position: relative;
    border-radius: 16rpx;
    overflow: hidden;
    background: #e5e5ea;
}
.is-editing .photo-item {
    border-radius: 12rpx;
    transition:
        transform 0.12s,
        opacity 0.12s;
}
.photo-img {
    width: 100%;
    height: 340rpx;
    display: block;
}

/* 加载更多 */
.load-more-wrap {
    padding: 24rpx 32rpx;
    text-align: center;
}
.load-more-btn {
    display: inline-block;
    padding: 16rpx 48rpx;
    background: #fff;
    border-radius: 32rpx;
    font-size: 26rpx;
    color: #636366;
    border: 1rpx solid rgba(142, 142, 147, 0.1);
}
.load-more-btn.disabled {
    opacity: 0.5;
}

/* 拖拽 & 选择 */
.is-dragging {
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.25);
}
.is-drag-target {
    opacity: 0.5;
}
.drag-handle {
    position: absolute;
    bottom: 8rpx;
    right: 8rpx;
    width: 40rpx;
    height: 40rpx;
    border-radius: 20rpx;
    background: rgba(0, 0, 0, 0.35);
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
    top: 12rpx;
    right: 12rpx;
    width: 44rpx;
    height: 44rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.5);
    border: 3rpx solid rgba(255, 255, 255, 0.9);
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
    background: #007aff;
    border-color: #007aff;
}
.select-mark-icon {
    color: #fff;
    font-size: 24rpx;
    font-weight: 700;
}

.bottom-space {
    height: 180rpx;
}

/* 编辑底栏 */
.edit-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1rpx solid rgba(0, 0, 0, 0.06);
    padding: 20rpx 32rpx;
    padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.edit-bar-btn {
    padding: 14rpx 28rpx;
    background: #f2f2f7;
    border-radius: 16rpx;
    font-size: 28rpx;
    color: #1c1c1e;
}
.edit-bar-btn.disabled {
    opacity: 0.3;
}
.edit-bar-btn.danger {
    background: #ff3b30;
    color: #fff;
}
.edit-bar-actions {
    display: flex;
    gap: 12rpx;
}
.edit-count {
    font-size: 26rpx;
    color: #8e8e93;
}

/* 分类选择弹窗 */
.picker-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
}
.picker-sheet {
    width: 100%;
    background: #fff;
    border-radius: 24rpx 24rpx 0 0;
    padding: 16rpx 0;
    padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}
.picker-title {
    font-size: 26rpx;
    color: #8e8e93;
    text-align: center;
    padding: 16rpx 0 20rpx;
}
.picker-item {
    padding: 28rpx 40rpx;
    font-size: 30rpx;
    color: #1c1c1e;
    text-align: center;
}
.picker-item:active {
    background: #f2f2f7;
}
.picker-item + .picker-item {
    border-top: 1rpx solid rgba(0, 0, 0, 0.04);
}

/* 照片点赞角标 */
.photo-like-badge {
    position: absolute;
    bottom: 8rpx;
    left: 8rpx;
    padding: 4rpx 14rpx;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 16rpx;
    font-size: 20rpx;
    color: #fff;
    z-index: 2;
}
</style>
