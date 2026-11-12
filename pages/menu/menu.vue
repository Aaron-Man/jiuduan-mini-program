<template>
    <view>
        <page-bg overlay="light" />
        <scroll-view
            :scroll-y="!dishDragging && !catDragging"
            class="page-scroll"
            :class="{ 'page-scroll--transparent': bgImage }"
            refresher-enabled
            refresher-default-style="black"
            :refresher-triggered="refreshing"
            @refresherrefresh="onRefresh"
        >
            <!-- 顶部操作栏 -->
            <view class="top-bar">
                <view class="top-btn outline" @tap="showCategoryManager = !showCategoryManager">
                    <text>分类</text>
                </view>
                <view class="top-btn primary" @tap="toggleForm">
                    <text>{{ showForm ? '取消' : '+ 菜品' }}</text>
                </view>
            </view>

            <!-- 分类管理 -->
            <view class="group" v-if="showCategoryManager">
                <text class="group-label">分类管理</text>
                <view class="group-card">
                    <view class="cell-h">
                        <text class="cell-icon">📂</text>
                        <input class="cell-input" v-model="newCategory" placeholder="新分类名称" />
                        <view class="cell-action" @tap="handleAddCategory">添加</view>
                    </view>
                    <view v-if="categories.length > 0">
                        <view
                            class="cat-row"
                            v-for="(cat, idx) in categories"
                            :key="cat._id"
                            :class="{ dragging: catDragIndex === idx }"
                            :style="
                                catDragIndex === idx
                                    ? {
                                          transform: 'translateY(' + catDragOffset + 'px)',
                                          zIndex: 10,
                                          boxShadow: '0 8rpx 32rpx rgba(0,0,0,0.12)',
                                      }
                                    : {}
                            "
                            @touchstart="onCatDragStart($event, idx)"
                            @touchmove="onCatDragMove($event)"
                            @touchend="onCatDragEnd()"
                        >
                            <view v-if="editingCatId === cat._id" class="cat-edit">
                                <input
                                    class="cell-input"
                                    v-model="editCatName"
                                    @confirm="handleEditCategory(cat._id)"
                                />
                                <text class="cat-act" @tap="handleEditCategory(cat._id)">✅</text>
                                <text class="cat-act" @tap="editingCatId = null">❌</text>
                            </view>
                            <view v-else class="cat-info">
                                <view class="cat-num"
                                    ><text>{{ idx + 1 }}</text></view
                                >
                                <text class="cat-name">{{ cat.name }}</text>
                                <text class="cat-count">{{ countDishesForCat(cat._id) }}道</text>
                                <text class="cat-act" @tap="startEditCat(cat)">✏️</text>
                                <text class="cat-act del" @tap="handleDeleteCategory(cat._id)">×</text>
                            </view>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 添加/编辑菜品表单 -->
            <dish-form
                v-if="showForm"
                :key="editingDish ? editingDish._id : 'new'"
                :categories="categories"
                :dish="editingDish"
                :next-sort-order="dishes.length"
                @saved="onDishSaved"
            />

            <!-- 分类筛选 -->
            <view class="filter-row" v-if="categories.length > 0">
                <scroll-view scroll-x class="filter-scroll">
                    <view class="filter-tag" :class="{ active: !selectedCategory }" @tap="selectedCategory = null"
                        >全部</view
                    >
                    <view
                        class="filter-tag"
                        :class="{ active: selectedCategory === cat._id }"
                        v-for="cat in categories"
                        :key="cat._id"
                        @tap="selectedCategory = cat._id"
                    >
                        {{ cat.name }}
                    </view>
                </scroll-view>
            </view>

            <!-- 菜品列表 -->
            <view v-if="loading" class="loading-area">
                <view class="skeleton-card" v-for="i in 3" :key="i">
                    <view class="skeleton-bar"></view>
                    <view class="skeleton-line short"></view>
                </view>
            </view>

            <view v-else-if="filteredDishes.length === 0" class="empty-area">
                <text class="empty-emoji">🍽️</text>
                <text class="empty-text">{{ selectedCategory ? '该分类暂无菜品' : '菜单还是空的' }}</text>
                <text class="empty-hint" v-if="!selectedCategory">添加第一道菜吧</text>
            </view>

            <view v-else class="group">
                <text class="group-label">菜品 ({{ filteredDishes.length }})</text>
                <view class="group-card" style="background: transparent; border: none; box-shadow: none">
                    <view
                        class="dish-row"
                        v-for="(dish, idx) in filteredDishes"
                        :key="dish._id"
                        :class="{ dragging: dishDragIndex === idx }"
                        :style="
                            dishDragIndex === idx
                                ? {
                                      transform: 'translateY(' + dishDragOffset + 'px)',
                                      zIndex: 10,
                                      boxShadow: '0 8rpx 32rpx rgba(0,0,0,0.12)',
                                  }
                                : {}
                        "
                        @touchstart="onDishDragStart($event, idx)"
                        @touchmove="onDishDragMove($event)"
                        @touchend="onDishDragEnd()"
                    >
                        <view class="drag-grip"><text class="drag-dots">⠿</text></view>
                        <image
                            v-if="dish.displayUrl"
                            :src="dish.displayUrl"
                            class="dish-thumb"
                            mode="aspectFill"
                            lazy-load
                        />
                        <view class="dish-body">
                            <view class="dish-top">
                                <text class="dish-name">{{ dish.name }}</text>
                                <text class="dish-stars"
                                    >{{ '★'.repeat(dish.difficulty) }}{{ '☆'.repeat(5 - dish.difficulty) }}</text
                                >
                            </view>
                            <view class="dish-tags" v-if="dish.category_names && dish.category_names.length">
                                <text class="mini-tag" v-for="cn in dish.category_names" :key="cn">{{ cn }}</text>
                            </view>
                            <text class="dish-desc" v-if="dish.description">{{ dish.description }}</text>
                            <text class="dish-ing" v-if="dish.ingredients">食材：{{ dish.ingredients }}</text>
                            <view class="dish-actions">
                                <text class="dish-act detail" @tap="openDetailModal(dish)">详情</text>
                                <text class="dish-act" @tap="editDish(dish)">编辑</text>
                                <text class="dish-act primary" v-if="dish.available" @tap="orderDish = dish">点菜</text>
                                <text class="dish-act del" @tap="handleDeleteDish(dish._id)">删除</text>
                            </view>
                            <view class="dish-meta">
                                <text
                                    class="dish-meta-item"
                                    :class="{ liked: likedByMe[dish._id] }"
                                    @tap.stop="toggleLike(dish)"
                                    >{{ likedByMe[dish._id] ? '❤' : '♡'
                                    }}{{ likeCounts[dish._id] ? ' ' + likeCounts[dish._id] : '' }}</text
                                >
                                <text class="dish-meta-item" @tap.stop="openDetailModal(dish)"
                                    >💬{{ commentCounts[dish._id] ? ' ' + commentCounts[dish._id] : '' }}</text
                                >
                                <text class="dish-meta-item" v-if="dish.order_count">📋 {{ dish.order_count }}次</text>
                            </view>
                        </view>
                    </view>
                </view>
            </view>

            <view class="bottom-space"></view>
        </scroll-view>

        <!-- 菜品详情弹窗 -->
        <dish-detail-modal
            v-if="viewDish"
            :dish="viewDish"
            :liked="!!likedByMe[viewDish._id]"
            :like-count="likeCounts[viewDish._id] || 0"
            :comment-count="commentCounts[viewDish._id] || 0"
            :current-user-id="currentUserId"
            @close="viewDish = null"
            @edit="editFromDetail"
            @order="orderFromDetail"
            @toggleLike="toggleLike(viewDish)"
            @commentsChanged="onCommentsChanged"
        />

        <!-- 点菜弹窗（必须放在 scroll-view 外部，否则 tap 事件会被拦截） -->
        <dish-order-modal v-if="orderDish" :dish="orderDish" @close="orderDish = null" @ordered="onOrdered" />
    </view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import DishForm from './components/dish-form.vue'
import DishDetailModal from './components/dish-detail-modal.vue'
import DishOrderModal from './components/dish-order-modal.vue'
import { ref, computed, onMounted } from 'vue'
import {
    callFunction,
    dbUpdate,
    dbAdd,
    fetchAllRecords,
    resolveFileUrls,
    setPCache,
    getPCache,
    clearPCache,
    cacheFileUrls,
    restoreFileUrls,
    useSharedBg,
} from '../../utils/cloud'
import { useInteractions } from '../../utils/useInteractions'
import { useListDrag } from '../../utils/useDragSort'
import { confirmDelete, handleLoadError } from '../../utils/contentActions'

const dishes = ref([])
const categories = ref([])
const selectedCategory = ref(null)
const loading = ref(true)
const showForm = ref(false)
const showCategoryManager = ref(false)
// 点菜弹窗 / 详情弹窗 / 正在编辑的菜品（null 表示新增）
const orderDish = ref(null)
const viewDish = ref(null)
const editingDish = ref(null)
const newCategory = ref('')
const editingCatId = ref(null)
const editCatName = ref('')
const refreshing = ref(false)

const filteredDishes = computed(() => {
    if (!selectedCategory.value) return dishes.value
    return dishes.value.filter(d => d.category_ids && d.category_ids.includes(selectedCategory.value))
})

// 菜品拖拽排序
// 模板渲染的是 filteredDishes，交换需作用到完整的 dishes 上，否则筛选后会换错菜
const dishDrag = useListDrag(filteredDishes, {
    collection: 'dishes',
    backingRef: dishes,
    onDrop: () => clearPCache('menu'),
})
const dishDragging = dishDrag.dragging
const dishDragIndex = dishDrag.dragIndex
const dishDragOffset = dishDrag.dragOffset
const onDishDragStart = dishDrag.onDragStart
const onDishDragMove = dishDrag.onDragMove
const onDishDragEnd = dishDrag.onDragEnd

// 分类拖拽排序
const catDrag = useListDrag(categories, {
    collection: 'categories',
    onDrop: () => clearPCache('menu'),
})
const catDragging = catDrag.dragging
const catDragIndex = catDrag.dragIndex
const catDragOffset = catDrag.dragOffset
const onCatDragStart = catDrag.onDragStart
const onCatDragMove = catDrag.onDragMove
const onCatDragEnd = catDrag.onDragEnd

// 点赞评论状态
const { likeCounts, likedByMe, commentCounts, currentUserId, loadInteractions, toggleLike } = useInteractions('dish')

// 背景从全局共享状态读取
const { bgImage } = useSharedBg()

onMounted(() => {
    fetchData()
})

const onRefresh = async () => {
    refreshing.value = true
    await fetchData()
    refreshing.value = false
}

const fetchData = async () => {
    // 缓存优先：命中则瞬间渲染，后台静默刷新
    const cached = getPCache('menu')
    if (cached) {
        categories.value = cached.categories || []
        dishes.value = cached.dishes || []
        restoreFileUrls(dishes.value, 'image_url', 'displayUrl')
        loading.value = false
        // 后台静默刷新（不显示骨架屏）
        _fetchFromNetwork(true)
        return
    }
    loading.value = true
    await _fetchFromNetwork(false)
}

const _fetchFromNetwork = async silent => {
    try {
        const [catData, dishRes, countRes] = await Promise.all([
            fetchAllRecords('categories', { orderBy: 'sort_order', orderType: 'asc' }),
            callFunction('menu', { action: 'listDishes' }),
            callFunction('order', { action: 'countByDish' }).then(res => res?.data || {}),
        ])
        categories.value = catData
        const dishData = dishRes?.data || []
        dishes.value = dishData.map(d => ({
            ...d,
            order_count: countRes[d._id] || 0,
            category_ids: d.category_ids || (d.category_id ? [d.category_id] : []),
            category_names: (d.category_ids || (d.category_id ? [d.category_id] : []))
                .map(cid => {
                    const c = categories.value.find(cat => cat._id === cid)
                    return c ? c.name : ''
                })
                .filter(Boolean),
        }))
        await resolveFileUrls(dishes.value, 'image_url', 'displayUrl')
        cacheFileUrls(dishes.value, 'image_url', 'displayUrl')
        // 缓存数据（5 分钟有效）
        setPCache('menu', { categories: categories.value, dishes: dishes.value })
        await loadInteractionsData()
    } catch (e) {
        handleLoadError(e, dishes.value.length > 0)
    } finally {
        loading.value = false
    }
}

const loadInteractionsData = async () => {
    const ids = dishes.value.map(d => d._id)
    await loadInteractions(ids)
}

const countDishesForCat = catId => dishes.value.filter(d => d.category_ids && d.category_ids.includes(catId)).length

const toggleForm = () => {
    // 编辑中点「取消」关闭表单；否则切换新增表单
    if (showForm.value) {
        showForm.value = false
        editingDish.value = null
    } else {
        editingDish.value = null
        showForm.value = true
    }
}

const editDish = dish => {
    editingDish.value = dish
    showForm.value = true
}

const onDishSaved = () => {
    showForm.value = false
    editingDish.value = null
    clearPCache('menu')
    fetchData()
}

// 云函数删除菜品时会同步删除图片和点赞/评论
const handleDeleteDish = id =>
    confirmDelete({
        content: '确定删除这道菜？',
        collection: 'dishes',
        id,
        cacheKeys: 'menu',
        onDone: fetchData,
    })

const handleAddCategory = async () => {
    if (!newCategory.value.trim()) return
    try {
        await dbAdd('categories', { name: newCategory.value.trim(), sort_order: categories.value.length })
        newCategory.value = ''
        clearPCache('menu')
        fetchData()
    } catch (e) {
        uni.showToast({ title: '添加失败', icon: 'none' })
    }
}

const startEditCat = cat => {
    editingCatId.value = cat._id
    editCatName.value = cat.name
}

const handleEditCategory = async id => {
    if (!editCatName.value.trim()) return
    try {
        await dbUpdate('categories', id, { name: editCatName.value.trim() })
        editingCatId.value = null
        editCatName.value = ''
        clearPCache('menu')
        fetchData()
    } catch (e) {
        uni.showToast({ title: '修改失败', icon: 'none' })
    }
}

// 云函数删除分类时会同步从菜品的 category_ids 中移除
const handleDeleteCategory = id =>
    confirmDelete({
        content: '确定删除该分类？',
        collection: 'categories',
        id,
        cacheKeys: 'menu',
        onDone: () => {
            if (selectedCategory.value === id) selectedCategory.value = null
            fetchData()
        },
    })

const openDetailModal = dish => {
    viewDish.value = dish
}
const editFromDetail = () => {
    const dish = viewDish.value
    viewDish.value = null
    editDish(dish)
}
const orderFromDetail = () => {
    const dish = viewDish.value
    viewDish.value = null
    orderDish.value = dish
}
const onCommentsChanged = count => {
    const id = viewDish.value?._id
    if (!id) return
    if (count > 0) commentCounts.value[id] = count
    else delete commentCounts.value[id]
}

const onOrdered = async () => {
    orderDish.value = null
    clearPCache('menu')
    await fetchData()
}
</script>

<style scoped>
.page-scroll {
    height: 100vh;
    background: #f2f2f7;
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
    gap: 12rpx;
}
.top-btn {
    padding: 10rpx 28rpx;
    background: #c07a50;
    color: #fff;
    border-radius: 24rpx;
    font-size: 24rpx;
    letter-spacing: 1rpx;
}
.top-btn.outline {
    background: transparent;
    color: #a06840;
    border: 1rpx solid rgba(160, 104, 64, 0.35);
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
    color: #636366;
    display: block;
    margin-bottom: 12rpx;
    margin-left: 8rpx;
    letter-spacing: 2rpx;
    font-weight: 500;
}
.group-card {
    background: rgba(255, 255, 255, 0.6);
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
.cell-input {
    flex: 1;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
}
.cell-action {
    padding: 10rpx 24rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 16rpx;
    font-size: 24rpx;
    flex-shrink: 0;
    letter-spacing: 1rpx;
}

/* Filter */
.filter-row {
    padding: 20rpx 32rpx 0;
}
.filter-scroll {
    white-space: nowrap;
}
.filter-tag {
    display: inline-block;
    padding: 14rpx 28rpx;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 24rpx;
    font-size: 26rpx;
    color: #3a3a3c;
    margin-right: 12rpx;
    border: 1rpx solid rgba(142, 142, 147, 0.08);
}
.filter-tag.active {
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-color: transparent;
}

/* Category Row */
.cat-row {
    padding: 18rpx 28rpx;
    transition:
        transform 0.15s ease,
        opacity 0.15s;
    position: relative;
}
.cat-row.dragging {
    opacity: 0.9;
    background: #fff;
    transition: none;
}
.cat-row + .cat-row {
    border-top: 1rpx solid rgba(142, 142, 147, 0.06);
}
.cat-edit {
    display: flex;
    gap: 12rpx;
    align-items: center;
}
.cat-info {
    display: flex;
    align-items: center;
    gap: 12rpx;
}
.cat-num {
    width: 36rpx;
    height: 36rpx;
    border-radius: 18rpx;
    background: rgba(142, 142, 147, 0.12);
    text-align: center;
    line-height: 36rpx;
}
.cat-num text {
    font-size: 20rpx;
    color: #3a3a3c;
}
.cat-name {
    font-size: 28rpx;
    color: #1c1c1e;
    flex: 1;
}
.cat-count {
    font-size: 22rpx;
    color: #636366;
}
.cat-act {
    font-size: 28rpx;
    padding: 4rpx 8rpx;
}
.cat-act.del {
    color: #ff3b30;
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
    color: #8e8e93;
    display: block;
    margin-top: 8rpx;
}

/* Drag Grip */
.drag-grip {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0 4rpx;
}
.drag-dots {
    font-size: 32rpx;
    color: #8e8e93;
    line-height: 1;
}

/* Dish Row */
.dish-row {
    display: flex;
    padding: 24rpx 28rpx;
    gap: 16rpx;
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
.dish-row.dragging {
    opacity: 0.9;
    background: #fff;
    transition: none;
}
.dish-thumb {
    width: 120rpx;
    height: 120rpx;
    border-radius: 20rpx;
    flex-shrink: 0;
}
.dish-body {
    flex: 1;
    min-width: 0;
}
.dish-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6rpx;
}
.dish-name {
    font-size: 30rpx;
    font-weight: 600;
    color: #1c1c1e;
    letter-spacing: 0.5rpx;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.dish-stars {
    font-size: 22rpx;
    color: #d4a574;
    flex-shrink: 0;
}
.dish-tags {
    display: flex;
    gap: 8rpx;
    flex-wrap: wrap;
    margin-bottom: 4rpx;
}
.mini-tag {
    font-size: 20rpx;
    padding: 4rpx 14rpx;
    background: rgba(142, 142, 147, 0.1);
    border-radius: 10rpx;
    color: #3a3a3c;
}
.dish-desc {
    font-size: 24rpx;
    color: #636366;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.6;
}
.dish-ing {
    font-size: 22rpx;
    color: #8e8e93;
    display: block;
    margin-top: 4rpx;
}
.dish-actions {
    display: flex;
    gap: 20rpx;
    margin-top: 12rpx;
}
.dish-act {
    font-size: 22rpx;
    color: #636366;
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
    background: #f2f2f7;
}
.dish-act.detail {
    color: #1c1c1e;
    background: rgba(0, 0, 0, 0.06);
    font-weight: 500;
}
.dish-act.primary {
    color: #1c1c1e;
    background: rgba(0, 0, 0, 0.08);
}
.dish-act.del {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.08);
}

/* Dish Meta */
.dish-meta {
    display: flex;
    gap: 16rpx;
    margin-top: 8rpx;
}
.dish-meta-item {
    font-size: 20rpx;
    color: #636366;
    padding: 4rpx 12rpx;
    background: #f9f9fb;
    border-radius: 8rpx;
}
.dish-meta-item.liked {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.06);
}

.bottom-space {
    height: 80rpx;
}
</style>
