<template>
    <view>
        <page-bg overlay="light" tone="peach" />
        <scroll-view
            :scroll-y="!dishDragging && !catDragging"
            class="page-scroll"
            :class="{ 'page-scroll--transparent': bgImage }"
            refresher-enabled
            refresher-default-style="black"
            :refresher-triggered="refreshing"
            @refresherrefresh="onRefresh"
        >
            <!-- 杂志式标题区 -->
            <view class="hero ui-fade-up">
                <text class="ui-eyebrow">KITCHEN</text>
                <text class="ui-title hero-title">今天吃什么</text>
                <text class="ui-sub hero-sub">{{ dishes.length }} 道家常菜 · {{ categories.length }} 个分类</text>
            </view>

            <!-- 顶部操作栏 -->
            <view class="top-bar ui-fade-up ui-d1">
                <view class="top-btn outline ui-press" @tap="showCategoryManager = !showCategoryManager">
                    <text>分类管理</text>
                </view>
                <view class="top-btn primary ui-press" @tap="toggleForm">
                    <text>{{ showForm ? '取消' : '+ 新菜品' }}</text>
                </view>
            </view>

            <!-- 分类管理 -->
            <view class="group ui-fade-up" v-if="showCategoryManager">
                <view class="section-head">
                    <text class="ui-eyebrow">CATEGORIES</text>
                    <text class="section-title">分类管理</text>
                </view>
                <view class="group-card">
                    <view class="cell-h">
                        <view class="cell-bubble ui-bubble ui-bubble--peach"><text>📂</text></view>
                        <input class="cell-input" v-model="newCategory" placeholder="新分类名称" />
                        <view class="cell-action ui-press" @tap="handleAddCategory">添加</view>
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
                                    class="cell-input cat-edit-input"
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
            <view class="filter-row ui-fade-up ui-d2" v-if="categories.length > 0">
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
                    <view class="skeleton-thumb"></view>
                    <view class="skeleton-text">
                        <view class="skeleton-bar"></view>
                        <view class="skeleton-line short"></view>
                    </view>
                </view>
            </view>

            <view v-else-if="filteredDishes.length === 0" class="empty-area ui-fade-up ui-d2">
                <view class="empty-bubble"><text class="empty-emoji">🍽️</text></view>
                <text class="empty-text">{{ selectedCategory ? '该分类暂无菜品' : '菜单还是空的' }}</text>
                <text class="empty-hint" v-if="!selectedCategory">添加第一道菜吧</text>
            </view>

            <view v-else class="group">
                <view class="section-head section-head--row ui-fade-up ui-d2">
                    <text class="ui-eyebrow">THE MENU</text>
                    <text class="section-count">{{ filteredDishes.length }} 道</text>
                </view>
                <view class="dish-list">
                    <view
                        class="dish-row"
                        v-for="(dish, idx) in filteredDishes"
                        :key="dish._id"
                        :class="[{ dragging: dishDragIndex === idx }, idx < 6 ? 'ui-d' + (idx + 1) : 'ui-d6']"
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
                        <view class="dish-main">
                            <image
                                v-if="dish.displayUrl"
                                :src="dish.displayUrl"
                                class="dish-thumb"
                                mode="aspectFill"
                                lazy-load
                            />
                            <view v-else class="dish-thumb dish-thumb--empty">
                                <text class="dish-thumb-emoji">🍳</text>
                            </view>
                            <view class="dish-body">
                                <view class="dish-tags" v-if="dish.category_names && dish.category_names.length">
                                    <text class="mini-tag" v-for="cn in dish.category_names" :key="cn">{{ cn }}</text>
                                </view>
                                <view class="dish-top">
                                    <text class="dish-name">{{ dish.name }}</text>
                                </view>
                                <view class="dish-level">
                                    <view
                                        class="level-dot"
                                        v-for="n in 5"
                                        :key="n"
                                        :class="{ on: n <= dish.difficulty }"
                                    ></view>
                                </view>
                                <text class="dish-desc" v-if="dish.description">{{ dish.description }}</text>
                                <text class="dish-ing" v-if="dish.ingredients">食材 · {{ dish.ingredients }}</text>
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
                                    <text class="dish-meta-item" v-if="dish.order_count"
                                        >已点 {{ dish.order_count }} 次</text
                                    >
                                </view>
                            </view>
                        </view>
                        <view class="dish-actions">
                            <text class="dish-act detail" @tap="openDetailModal(dish)">详情</text>
                            <text class="dish-act" @tap="editDish(dish)">编辑</text>
                            <text class="dish-act del" @tap="handleDeleteDish(dish._id)">删除</text>
                            <view class="dish-act-spacer"></view>
                            <text class="dish-act primary" v-if="dish.available" @tap="orderDish = dish">点菜</text>
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
    background: transparent;
}
.page-scroll--transparent {
    background: transparent;
}

/* Hero */
.hero {
    padding: 48rpx 40rpx 8rpx;
    display: flex;
    flex-direction: column;
}
.hero-title {
    display: block;
    margin-top: 12rpx;
    font-size: 64rpx;
    letter-spacing: 0.02em;
}
.hero-sub {
    display: block;
    margin-top: 12rpx;
    letter-spacing: 0.06em;
}

/* Top Bar */
.top-bar {
    display: flex;
    align-items: center;
    padding: 28rpx 40rpx 8rpx;
    gap: 16rpx;
}
.top-btn {
    height: 72rpx;
    padding: 0 32rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999rpx;
    font-size: 24rpx;
    font-weight: 600;
    letter-spacing: 0.08em;
    background: var(--ink);
    color: #fff;
    box-shadow: 0 16rpx 32rpx -16rpx rgba(30, 26, 23, 0.6);
}
.top-btn.outline {
    background: rgba(255, 255, 255, 0.7);
    color: var(--ink);
    border: 1rpx solid var(--line);
    box-shadow: none;
}

/* Section Head */
.group {
    padding: 32rpx 32rpx 0;
}
.section-head {
    display: flex;
    flex-direction: column;
    padding: 0 8rpx;
    margin-bottom: 20rpx;
}
.section-head--row {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
}
.section-title {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 6rpx;
}
.section-count {
    font-family: var(--font-serif);
    font-size: 28rpx;
    font-style: italic;
    color: var(--ink-2);
}

/* Category Manager */
.group-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    overflow: hidden;
}
.cell-h {
    display: flex;
    align-items: center;
    padding: 24rpx 28rpx;
    gap: 20rpx;
}
.cell-bubble {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    font-size: 32rpx;
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
.cell-action {
    height: 64rpx;
    padding: 0 32rpx;
    display: flex;
    align-items: center;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-size: 24rpx;
    font-weight: 600;
    flex-shrink: 0;
    letter-spacing: 0.08em;
}
.cat-row {
    padding: 22rpx 28rpx;
    transition:
        transform 0.15s ease,
        opacity 0.15s;
    position: relative;
    background: transparent;
}
.cat-row.dragging {
    opacity: 0.95;
    background: var(--card-solid);
    transition: none;
}
.cat-row::before {
    content: '';
    position: absolute;
    top: 0;
    left: 28rpx;
    right: 28rpx;
    height: 1rpx;
    background: var(--line);
}
.cat-edit {
    display: flex;
    gap: 12rpx;
    align-items: center;
}
.cat-edit-input {
    padding: 14rpx 24rpx;
    background: var(--bg);
    border-radius: 999rpx;
}
.cat-info {
    display: flex;
    align-items: center;
    gap: 16rpx;
}
.cat-num {
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background: rgba(244, 199, 180, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.cat-num text {
    font-family: var(--font-serif);
    font-size: 24rpx;
    font-weight: 700;
    color: var(--ink);
}
.cat-name {
    font-size: 28rpx;
    color: var(--ink);
    flex: 1;
    font-weight: 500;
}
.cat-count {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 24rpx;
    color: var(--muted);
}
.cat-act {
    font-size: 28rpx;
    padding: 4rpx 10rpx;
}
.cat-act.del {
    color: var(--coral);
    font-size: 36rpx;
    line-height: 1;
}

/* Filter */
.filter-row {
    padding: 28rpx 0 0;
}
.filter-scroll {
    white-space: nowrap;
    padding: 0 32rpx;
    box-sizing: border-box;
}
.filter-tag {
    display: inline-block;
    padding: 14rpx 32rpx;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 999rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    margin-right: 14rpx;
    border: 1rpx solid var(--line);
    letter-spacing: 0.06em;
}
.filter-tag.active {
    background: var(--ink);
    color: #fff;
    border-color: var(--ink);
    box-shadow: 0 12rpx 24rpx -12rpx rgba(30, 26, 23, 0.6);
}

/* Skeleton */
.loading-area {
    padding: 32rpx;
}
.skeleton-card {
    display: flex;
    align-items: center;
    gap: 24rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    padding: 24rpx;
    margin-bottom: 24rpx;
    box-shadow: var(--shadow-soft);
}
.skeleton-thumb {
    width: 176rpx;
    height: 176rpx;
    border-radius: var(--r-l);
    flex-shrink: 0;
    background: linear-gradient(90deg, var(--bg-2) 25%, var(--bg) 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}
.skeleton-text {
    flex: 1;
}
.skeleton-bar {
    height: 32rpx;
    background: linear-gradient(90deg, var(--bg-2) 25%, var(--bg) 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 999rpx;
    margin-bottom: 20rpx;
    width: 70%;
}
.skeleton-line {
    height: 22rpx;
    background: linear-gradient(90deg, var(--bg-2) 25%, var(--bg) 50%, var(--bg-2) 75%);
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

/* Empty */
.empty-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 140rpx 0 120rpx;
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
    margin-bottom: 36rpx;
}
.empty-emoji {
    font-size: 88rpx;
}
.empty-text {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
}
.empty-hint {
    font-size: 24rpx;
    color: var(--muted);
    display: block;
    margin-top: 12rpx;
    letter-spacing: 0.06em;
}

/* Dish Row */
.dish-list {
    padding-bottom: 8rpx;
}
@keyframes dish-in {
    from {
        opacity: 0;
        transform: translateY(32rpx);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.dish-row {
    position: relative;
    padding: 24rpx;
    margin-bottom: 28rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    transition:
        transform 0.15s ease,
        opacity 0.15s;
    animation-name: dish-in;
    animation-duration: 0.7s;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    animation-fill-mode: backwards;
}
.dish-row.dragging {
    opacity: 0.95;
    background: var(--card-solid);
    transition: none;
}
.drag-grip {
    position: absolute;
    top: 20rpx;
    right: 24rpx;
    padding: 4rpx 8rpx;
    z-index: 2;
}
.drag-dots {
    font-size: 28rpx;
    color: var(--faint);
    line-height: 1;
}
.dish-main {
    display: flex;
    gap: 28rpx;
}
.dish-thumb {
    width: 176rpx;
    height: 176rpx;
    border-radius: var(--r-l);
    flex-shrink: 0;
    box-shadow: 0 16rpx 32rpx -18rpx rgba(80, 56, 36, 0.45);
}
.dish-thumb--empty {
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
}
.dish-thumb-emoji {
    font-size: 64rpx;
    opacity: 0.85;
}
.dish-body {
    flex: 1;
    min-width: 0;
    padding-top: 4rpx;
    padding-right: 40rpx;
}
.dish-tags {
    display: flex;
    gap: 8rpx;
    flex-wrap: wrap;
    margin-bottom: 8rpx;
}
.mini-tag {
    font-size: 18rpx;
    padding: 2rpx 14rpx;
    background: rgba(244, 199, 180, 0.4);
    border-radius: 999rpx;
    color: var(--ink-2);
    letter-spacing: 0.12em;
}
.dish-top {
    display: flex;
    align-items: center;
}
.dish-name {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.dish-level {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin: 10rpx 0 8rpx;
}
.level-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
    background: var(--line);
}
.level-dot.on {
    background: var(--coral);
}
.dish-desc {
    font-size: 24rpx;
    color: var(--ink-2);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.6;
}
.dish-ing {
    font-size: 22rpx;
    color: var(--muted);
    display: block;
    margin-top: 2rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.dish-meta {
    display: flex;
    gap: 20rpx;
    margin-top: 10rpx;
}
.dish-meta-item {
    font-size: 22rpx;
    color: var(--muted);
}
.dish-meta-item.liked {
    color: var(--coral);
}

/* Dish Actions */
.dish-actions {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-top: 22rpx;
    padding-top: 18rpx;
    border-top: 2rpx dashed var(--line);
}
.dish-act {
    font-size: 24rpx;
    color: var(--ink-2);
    padding: 8rpx 16rpx;
    letter-spacing: 0.06em;
}
.dish-act.detail {
    color: var(--ink);
    font-weight: 600;
}
.dish-act.del {
    color: var(--coral);
}
.dish-act-spacer {
    flex: 1;
}
.dish-act.primary {
    padding: 12rpx 36rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-weight: 600;
    letter-spacing: 0.12em;
    box-shadow: 0 12rpx 24rpx -12rpx rgba(30, 26, 23, 0.6);
}

.bottom-space {
    height: 120rpx;
}
</style>
