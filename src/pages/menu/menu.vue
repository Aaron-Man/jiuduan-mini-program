<template>
    <view class="page-root" :class="{ 'photo-mode': isPhotoBg }">
        <page-bg overlay="light" tone="peach" />
        <scroll-view
            scroll-y
            class="page-scroll"
            refresher-enabled
            refresher-default-style="black"
            :refresher-triggered="refreshing"
            :lower-threshold="240"
            @refresherrefresh="onRefresh"
            @scrolltolower="loadMore"
        >
            <!-- 标题区 -->
            <view class="hero ui-fade-up">
                <view class="hero-text">
                    <text class="ui-eyebrow">KITCHEN</text>
                    <text class="ui-title hero-title">今天吃什么</text>
                    <text class="ui-sub hero-sub">{{ heroSub }}</text>
                </view>
                <view class="new-btn ui-press" @tap="goNew"><text>+ 新菜谱</text></view>
            </view>

            <!-- 搜索 -->
            <view class="search photo-glass ui-fade-up ui-d1">
                <text class="search-icon">🔍</text>
                <input
                    class="search-input"
                    v-model="keywordInput"
                    placeholder="搜菜名、食材，比如「土豆」"
                    placeholder-class="search-ph"
                    confirm-type="search"
                    @input="onKeywordInput"
                    @confirm="applyKeyword"
                />
                <view class="search-clear" v-if="keywordInput" @tap="clearKeyword"><text>×</text></view>
            </view>

            <!-- 范围 + 地区 -->
            <scroll-view scroll-x class="tabs ui-fade-up ui-d2" :show-scrollbar="false">
                <view
                    v-for="t in TOP_TABS"
                    :key="t.key"
                    class="tab"
                    :class="{ active: activeTab === t.key }"
                    @tap="selectTab(t)"
                    >{{ t.emoji ? t.emoji + ' ' : '' }}{{ t.label }}</view
                >
            </scroll-view>

            <!-- 地区下的菜系 -->
            <scroll-view v-if="currentRegion" scroll-x class="chips" :show-scrollbar="false">
                <view class="ui-chip chip" :class="{ active: !cuisine }" @tap="cuisine = ''">全部{{ currentRegion.label }}</view>
                <view
                    v-for="c in currentRegion.cuisines"
                    :key="c.key"
                    class="ui-chip chip"
                    :class="{ active: cuisine === c.key }"
                    @tap="cuisine = c.key"
                    >{{ c.emoji }} {{ c.label
                    }}<text class="chip-count" v-if="cuisineCount(c.key)"> {{ cuisineCount(c.key) }}</text></view
                >
            </scroll-view>

            <!-- 我家的分类 -->
            <scroll-view v-if="scope === 'family'" scroll-x class="chips" :show-scrollbar="false">
                <view class="ui-chip chip" :class="{ active: !categoryId }" @tap="categoryId = ''">全部分类</view>
                <view
                    v-for="cat in categories"
                    :key="cat._id"
                    class="ui-chip chip"
                    :class="{ active: categoryId === cat._id }"
                    @tap="categoryId = cat._id"
                    >{{ cat.name }}</view
                >
                <view class="ui-chip chip chip--manage" @tap="showCategoryManager = true">⚙ 管理分类</view>
            </scroll-view>

            <!-- 餐别 + 筛选 -->
            <view class="course-bar">
                <scroll-view scroll-x class="chips course-scroll" :show-scrollbar="false">
                    <view class="ui-chip chip" :class="{ active: !course }" @tap="course = ''">全部餐别</view>
                    <view
                        v-for="c in COURSES"
                        :key="c.key"
                        class="ui-chip chip"
                        :class="{ active: course === c.key }"
                        @tap="course = course === c.key ? '' : c.key"
                        >{{ c.emoji }} {{ c.label }}</view
                    >
                </scroll-view>
                <view class="filter-btn ui-press" :class="{ on: activeFilterCount > 0 }" @tap="openFilter">
                    <text>筛选</text>
                    <text class="filter-badge" v-if="activeFilterCount">{{ activeFilterCount }}</text>
                </view>
            </view>

            <!-- 骨架 -->
            <view v-if="loading" class="list">
                <view class="skeleton-row photo-glass" v-for="i in 4" :key="i">
                    <view class="skeleton-thumb shimmer"></view>
                    <view class="skeleton-text">
                        <view class="skeleton-bar shimmer"></view>
                        <view class="skeleton-line shimmer"></view>
                        <view class="skeleton-line short shimmer"></view>
                    </view>
                </view>
            </view>

            <!-- 空状态 -->
            <view v-else-if="dishes.length === 0" class="empty ui-fade-up photo-empty">
                <view class="empty-bubble"><text class="empty-emoji">{{ emptyState.emoji }}</text></view>
                <text class="empty-title ui-serif">{{ emptyState.title }}</text>
                <text class="empty-hint">{{ emptyState.hint }}</text>
                <view class="ui-btn empty-btn" v-if="emptyState.action" @tap="emptyState.action.run">{{
                    emptyState.action.label
                }}</view>
            </view>

            <!-- 菜品列表 -->
            <view v-else class="list">
                <view
                    v-for="(d, idx) in dishes"
                    :key="d._id"
                    class="dish-row photo-glass"
                    :class="idx < 6 ? 'ui-fade-up ui-d' + (idx + 1) : ''"
                    hover-class="dish-row--hover"
                    :hover-stay-time="60"
                    @tap="openDish(d)"
                >
                    <dish-cover :dish="d" size="s" />
                    <view class="dish-body">
                        <view class="dish-top">
                            <text class="dish-name">{{ d.name }}</text>
                            <text class="ui-hidden-tag" v-if="d.hidden">已隐藏</text>
                        </view>
                        <text class="dish-meta">{{ dishMeta(d) }}</text>
                        <view class="dish-tags">
                            <text class="dish-tag" v-for="t in topTags(d)" :key="t.key">{{ t.emoji }} {{ t.label }}</text>
                            <text class="dish-spice" v-if="d.spice > 0">{{ '🌶'.repeat(Math.min(d.spice, 3)) }}</text>
                        </view>
                        <text class="dish-count" v-if="orderCountOf(d)">已点 {{ orderCountOf(d) }} 次</text>
                    </view>
                    <view class="dish-side" hover-stop-propagation @tap.stop="noop">
                        <view class="ui-more dish-more" @tap.stop="openMore(d)"><text>···</text></view>
                        <text v-if="d.available === false" class="dish-off">暂不可点</text>
                        <view v-else-if="!servingsOf(d._id)" class="dish-add ui-press" @tap.stop="addToCart(d)">
                            <text>+</text>
                        </view>
                        <view v-else class="dish-stepper">
                            <view class="dish-minus ui-press" @tap.stop="setServings(d._id, servingsOf(d._id) - 1)">
                                <text>−</text>
                            </view>
                            <text class="dish-qty">{{ servingsOf(d._id) }}</text>
                            <view class="dish-plus ui-press" @tap.stop="addToCart(d)"><text>+</text></view>
                        </view>
                    </view>
                </view>

                <view class="list-footer">
                    <text v-if="loadingMore">正在加载…</text>
                    <text v-else-if="moreError" class="list-retry" @tap="loadMore">加载失败，点这里重试</text>
                    <text v-else-if="!hasMore">— 没有更多了 —</text>
                </view>
            </view>

            <view class="bottom-space" :class="{ 'bottom-space--cart': cartCount > 0 }"></view>
        </scroll-view>

        <!-- 点菜篮 -->
        <view v-if="cartCount > 0" class="cart-bar" @tap="goCart">
            <view class="cart-icon"><text>🧺</text></view>
            <text class="cart-text">点菜篮 · {{ cartCount }} 道 / {{ totalServings }} 份</text>
            <view class="cart-go"><text>去下单</text></view>
        </view>

        <!-- 筛选 -->
        <view class="mask" v-if="showFilter" @tap="showFilter = false">
            <view class="sheet" @tap.stop>
                <view class="sheet-handle"></view>
                <text class="sheet-title ui-serif">筛选</text>

                <text class="label">标签（可多选）</text>
                <view class="opt-wrap">
                    <view
                        v-for="t in TAGS"
                        :key="t.key"
                        class="opt"
                        :class="{ active: draft.tags.includes(t.key) }"
                        @tap="toggleDraftTag(t.key)"
                        >{{ t.emoji }} {{ t.label }}</view
                    >
                </view>

                <text class="label">用时</text>
                <view class="opt-wrap">
                    <view
                        v-for="o in TIME_OPTS"
                        :key="o.v"
                        class="opt"
                        :class="{ active: draft.maxTime === o.v }"
                        @tap="draft.maxTime = o.v"
                        >{{ o.label }}</view
                    >
                </view>

                <text class="label">难度</text>
                <view class="opt-wrap">
                    <view
                        v-for="o in DIFF_OPTS"
                        :key="o.v"
                        class="opt"
                        :class="{ active: draft.maxDifficulty === o.v }"
                        @tap="draft.maxDifficulty = o.v"
                        >{{ o.label }}</view
                    >
                </view>

                <text class="label">排序</text>
                <view class="opt-wrap">
                    <view
                        v-for="o in SORT_OPTS"
                        :key="o.v"
                        class="opt"
                        :class="{ active: draft.sort === o.v }"
                        @tap="draft.sort = o.v"
                        >{{ o.label }}</view
                    >
                </view>

                <view class="sheet-actions">
                    <view class="ui-btn ui-btn--ghost sheet-reset" @tap="resetDraft">重置</view>
                    <view class="ui-btn sheet-ok" @tap="applyFilter">确定</view>
                </view>
            </view>
        </view>

        <!-- 分类管理 -->
        <view class="mask" v-if="showCategoryManager" @tap="closeCategoryManager">
            <view class="sheet" @tap.stop>
                <view class="sheet-handle"></view>
                <text class="sheet-title ui-serif">我的分类</text>
                <text class="sheet-hint">长按拖动可以调整顺序，编辑菜品时可以把菜加入分类</text>
                <view class="cat-add">
                    <input class="cat-input" v-model="newCategory" placeholder="新分类名称" @confirm="handleAddCategory" />
                    <view class="cat-add-btn ui-press" @tap="handleAddCategory">添加</view>
                </view>
                <scroll-view :scroll-y="!catDragging" class="cat-scroll">
                    <view v-if="categories.length === 0" class="cat-empty">还没有分类，先添加一个吧</view>
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
                                class="cat-input"
                                v-model="editCatName"
                                focus
                                @confirm="handleEditCategory(cat._id)"
                            />
                            <text class="cat-act" @tap="handleEditCategory(cat._id)">✅</text>
                            <text class="cat-act" @tap="editingCatId = null">❌</text>
                        </view>
                        <view v-else class="cat-info">
                            <view class="cat-num"><text>{{ idx + 1 }}</text></view>
                            <text class="cat-name">{{ cat.name }}</text>
                            <text class="cat-act" @tap="startEditCat(cat)">✏️</text>
                            <text class="cat-act del" @tap="handleDeleteCategory(cat._id)">×</text>
                        </view>
                    </view>
                </scroll-view>
            </view>
        </view>
    </view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { dbUpdate, dbAdd, fetchAllRecords, setPCache, getPCache, clearPCache, useSharedBg } from '../../utils/cloud'
import {
    REGIONS,
    COURSES,
    TAGS,
    PAGE_SIZE,
    tagOf,
    dishMeta,
    fetchDishPage,
    cachedDishPage,
    clearDishCaches,
    fetchFacets,
    fetchOrderCounts,
    useCart,
} from '../../utils/menu'
import { useListDrag } from '../../utils/useDragSort'
import { confirmDelete, handleLoadError, isAdminUser, toggleHidden, showMoreActions } from '../../utils/contentActions'

const { isPhotoBg } = useSharedBg()
const isAdmin = isAdminUser()
const { count: cartCount, totalServings, add, setServings, remove: removeFromCart, servingsOf } = useCart()

// ===== 筛选条件 =====
const TOP_TABS = [
    { key: 'all', label: '全部' },
    { key: 'family', label: '我家的', scope: 'family' },
    { key: 'builtin', label: '精选', scope: 'builtin' },
    ...REGIONS.map(r => ({ key: 'r:' + r.key, label: r.label, emoji: r.emoji, region: r.key })),
]
const TIME_OPTS = [
    { v: 0, label: '不限' },
    { v: 15, label: '15 分钟内' },
    { v: 30, label: '30 分钟内' },
    { v: 60, label: '60 分钟内' },
]
const DIFF_OPTS = [
    { v: 0, label: '不限' },
    { v: 2, label: '简单 · ≤2' },
    { v: 3, label: '适中 · ≤3' },
]
const SORT_OPTS = [
    { v: 'default', label: '默认' },
    { v: 'popular', label: '最受欢迎' },
    { v: 'new', label: '最新' },
    { v: 'quick', label: '最快' },
]
const emptyFilters = () => ({ tags: [], maxTime: 0, maxDifficulty: 0, sort: 'default' })

const scope = ref('')
const region = ref('')
const cuisine = ref('')
const course = ref('')
const categoryId = ref('')
const keyword = ref('')
const keywordInput = ref('')
const filters = reactive(emptyFilters())

const activeTab = computed(() => (region.value ? 'r:' + region.value : scope.value || 'all'))
const currentRegion = computed(() => REGIONS.find(r => r.key === region.value) || null)

const selectTab = t => {
    scope.value = t.scope || ''
    region.value = t.region || ''
    cuisine.value = ''
    // 自定义分类只属于家里的菜，离开「我家的」时一起清掉，避免看不见的条件还在生效
    if (scope.value !== 'family') categoryId.value = ''
}

let kwTimer = null
const onKeywordInput = () => {
    clearTimeout(kwTimer)
    kwTimer = setTimeout(applyKeyword, 400)
}
const applyKeyword = () => {
    clearTimeout(kwTimer)
    keyword.value = keywordInput.value.trim()
}
const clearKeyword = () => {
    clearTimeout(kwTimer)
    keywordInput.value = ''
    keyword.value = ''
}

// 弹层里先改草稿，点「确定」才生效，否则每点一个选项都会请求一次
const showFilter = ref(false)
const draft = reactive(emptyFilters())
const activeFilterCount = computed(
    () => filters.tags.length + (filters.maxTime ? 1 : 0) + (filters.maxDifficulty ? 1 : 0) + (filters.sort !== 'default' ? 1 : 0)
)
const openFilter = () => {
    Object.assign(draft, { ...filters, tags: [...filters.tags] })
    showFilter.value = true
}
const toggleDraftTag = key => {
    const i = draft.tags.indexOf(key)
    if (i >= 0) draft.tags.splice(i, 1)
    else draft.tags.push(key)
}
const resetDraft = () => Object.assign(draft, emptyFilters())
const applyFilter = () => {
    Object.assign(filters, { ...draft, tags: [...draft.tags] })
    showFilter.value = false
}
const clearAllFilters = () => {
    scope.value = region.value = cuisine.value = course.value = categoryId.value = ''
    clearKeyword()
    Object.assign(filters, emptyFilters())
}

// 参数对象的键顺序固定、空值不放进去，保证同样的条件命中同一份第一页缓存
const params = computed(() => {
    // 搜索时在整个菜谱里找（只保留「我家的 / 精选」范围），否则选着「日韩」搜「提拉米苏」会什么都搜不到
    if (keyword.value) return scope.value ? { scope: scope.value, keyword: keyword.value } : { keyword: keyword.value }
    const p = {}
    if (scope.value) p.scope = scope.value
    if (region.value) p.region = region.value
    if (cuisine.value) p.cuisine = cuisine.value
    if (course.value) p.course = course.value
    if (scope.value === 'family' && categoryId.value) p.categoryId = categoryId.value
    if (keyword.value) p.keyword = keyword.value
    if (filters.tags.length) p.tags = [...filters.tags].sort()
    if (filters.maxTime) p.maxTime = filters.maxTime
    if (filters.maxDifficulty) p.maxDifficulty = filters.maxDifficulty
    if (filters.sort !== 'default') p.sort = filters.sort
    return p
})

// ===== 列表 =====
const dishes = ref([])
const hasMore = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const moreError = ref(false)
const refreshing = ref(false)
// 切换条件很快时，只认最后一次请求的结果
let reqSeq = 0
let lastLoadAt = 0

/**
 * 加载第一页
 * keep：保留当前列表直到新数据回来（下拉刷新、数据变动后），否则切条件时显示骨架
 */
const loadFirst = async ({ useCache = true, keep = false } = {}) => {
    const seq = ++reqSeq
    const p = params.value
    moreError.value = false
    loadingMore.value = false
    const cached = useCache ? cachedDishPage(p) : null
    if (cached) {
        dishes.value = cached.data || []
        hasMore.value = !!cached.hasMore
        loading.value = false
    } else if (!keep) {
        dishes.value = []
        loading.value = true
    }
    try {
        const res = await fetchDishPage(p, 0)
        if (seq !== reqSeq) return
        dishes.value = res.data
        hasMore.value = res.hasMore
        lastLoadAt = Date.now()
    } catch (e) {
        if (seq === reqSeq) handleLoadError(e, dishes.value.length > 0)
    } finally {
        if (seq === reqSeq) loading.value = false
    }
}

// 回到页面时只刷新第一页：已经往下翻过的部分保留，避免列表突然变短、滚动位置跳走
const refreshFirstPage = async () => {
    const seq = reqSeq
    try {
        const res = await fetchDishPage(params.value, 0)
        if (seq !== reqSeq) return
        if (dishes.value.length <= PAGE_SIZE) {
            dishes.value = res.data
            hasMore.value = res.hasMore
        } else {
            const ids = new Set(res.data.map(d => d._id))
            dishes.value = res.data.concat(dishes.value.slice(PAGE_SIZE).filter(d => !ids.has(d._id)))
        }
        lastLoadAt = Date.now()
    } catch (e) {
        handleLoadError(e, true)
    }
}

const loadMore = async () => {
    if (loading.value || loadingMore.value || !hasMore.value) return
    const seq = reqSeq
    loadingMore.value = true
    moreError.value = false
    try {
        const res = await fetchDishPage(params.value, dishes.value.length)
        if (seq !== reqSeq) return
        const ids = new Set(dishes.value.map(d => d._id))
        dishes.value = dishes.value.concat(res.data.filter(d => !ids.has(d._id)))
        hasMore.value = res.hasMore
    } catch (e) {
        if (seq === reqSeq) moreError.value = true
    } finally {
        if (seq === reqSeq) loadingMore.value = false
    }
}

watch(
    () => JSON.stringify(params.value),
    () => loadFirst()
)

// ===== 计数 =====
const facets = ref(null)
const orderCounts = ref({})
const loadFacets = async () => {
    try {
        facets.value = await fetchFacets()
    } catch (e) {
        console.error('[菜谱] 加载分类数量失败:', e)
    }
}
const loadOrderCounts = async () => {
    try {
        orderCounts.value = await fetchOrderCounts()
    } catch (e) {
        console.error('[菜谱] 加载点菜次数失败:', e)
    }
}
const cuisineCount = key => (facets.value && facets.value.cuisine && facets.value.cuisine[key]) || 0
// 订单库聚合的次数更准；还没加载到时退回菜品上的计数
const orderCountOf = d => orderCounts.value[d._id] ?? d.order_count ?? 0
const topTags = d => (d.tags || []).map(tagOf).filter(Boolean).slice(0, 2)

const heroSub = computed(() => {
    const f = facets.value
    if (!f) return '家里的拿手菜，和一本翻不完的菜谱'
    const family = Math.max((f.total || 0) - (f.builtin || 0), 0)
    return `共 ${f.total || 0} 道 · 精选 ${f.builtin || 0} 道 · 家里的 ${family} 道`
})

const emptyState = computed(() => {
    const newAction = { label: '+ 新菜谱', run: goNew }
    if (keyword.value)
        return { emoji: '🔎', title: `没找到「${keyword.value}」`, hint: '换个关键词，或者试试食材名', action: { label: '清除搜索', run: clearKeyword } }
    if (scope.value === 'family' && categoryId.value)
        return { emoji: '📂', title: '这个分类还没有菜', hint: '编辑菜品时可以把它加入分类' }
    const filtered = region.value || course.value || activeFilterCount.value > 0
    if (filtered)
        return { emoji: '🍽️', title: '没有符合条件的菜', hint: '放宽一点条件试试', action: { label: '清除筛选', run: clearAllFilters } }
    if (scope.value === 'family') return { emoji: '👩‍🍳', title: '家里还没有自己的菜谱', hint: '把拿手菜记下来，家人随时点', action: newAction }
    if (scope.value === 'builtin') return { emoji: '📖', title: '精选菜谱还没导入', hint: '可以请管理员在设置里导入' }
    return { emoji: '🍳', title: '菜谱还是空的', hint: '添加第一道菜吧', action: newAction }
})

// ===== 菜品操作 =====
const openDish = d => uni.navigateTo({ url: '/pages/recipe/detail?id=' + d._id })
const goNew = () => uni.navigateTo({ url: '/pages/recipe/edit' })
const goCart = () => uni.navigateTo({ url: '/pages/recipe/cart' })
// 卡片右侧按钮之间的空隙不触发进入详情
const noop = () => {}
const addToCart = d => {
    add(d)
    uni.vibrateShort({ type: 'light' })
}

const notifyChanged = () => {
    clearDishCaches()
    uni.$emit('menu:changed')
}

const openMore = d =>
    showMoreActions([
        { label: '编辑', run: () => uni.navigateTo({ url: '/pages/recipe/edit?id=' + d._id }) },
        {
            label: d.hidden ? '取消隐藏' : '隐藏（其他成员看不到）',
            show: isAdmin,
            run: async () => {
                if (await toggleHidden('dishes', d)) notifyChanged()
            },
        },
        { label: '删除', run: () => handleDeleteDish(d) },
    ])

// 云函数删除菜品时会同步删除图片和点赞 / 评论
const handleDeleteDish = d =>
    confirmDelete({
        content: `确定删除「${d.name}」？`,
        collection: 'dishes',
        id: d._id,
        onDone: () => {
            dishes.value = dishes.value.filter(x => x._id !== d._id)
            // 菜没了，点菜篮里留着会下出一条找不到菜的订单
            removeFromCart(d._id)
            notifyChanged()
        },
    })

// ===== 我的分类 =====
const categories = ref([])
const showCategoryManager = ref(false)
const newCategory = ref('')
const editingCatId = ref(null)
const editCatName = ref('')

// 分类存在 'menu' 缓存里：clearDishCaches 会一起清掉
const saveCatCache = () => setPCache('menu', { categories: categories.value })
const loadCategories = async ({ fresh = false } = {}) => {
    const cached = !fresh && getPCache('menu')
    if (cached && Array.isArray(cached.categories)) {
        categories.value = cached.categories
        return
    }
    try {
        categories.value = await fetchAllRecords('categories', { orderBy: 'sort_order', orderType: 'asc' })
        saveCatCache()
    } catch (e) {
        console.error('[菜谱] 加载分类失败:', e)
    }
}

const catDrag = useListDrag(categories, {
    itemSelector: '.cat-row',
    collection: 'categories',
    onDrop: () => saveCatCache(),
})
const catDragging = catDrag.dragging
const catDragIndex = catDrag.dragIndex
const catDragOffset = catDrag.dragOffset
const onCatDragStart = catDrag.onDragStart
const onCatDragMove = catDrag.onDragMove
const onCatDragEnd = catDrag.onDragEnd

const closeCategoryManager = () => {
    if (catDragging.value) return
    showCategoryManager.value = false
    editingCatId.value = null
}

const handleAddCategory = async () => {
    const name = newCategory.value.trim()
    if (!name) return
    try {
        await dbAdd('categories', { name, sort_order: categories.value.length })
        newCategory.value = ''
        await loadCategories({ fresh: true })
    } catch (e) {
        uni.showToast({ title: '添加失败', icon: 'none' })
    }
}

const startEditCat = cat => {
    editingCatId.value = cat._id
    editCatName.value = cat.name
}

const handleEditCategory = async id => {
    const name = editCatName.value.trim()
    if (!name) return
    try {
        await dbUpdate('categories', id, { name })
        editingCatId.value = null
        editCatName.value = ''
        await loadCategories({ fresh: true })
    } catch (e) {
        uni.showToast({ title: '修改失败', icon: 'none' })
    }
}

// 云函数删除分类时会同步从菜品的 category_ids 中移除，所以按分类缓存的列表也要清掉
const handleDeleteCategory = id =>
    confirmDelete({
        content: '确定删除该分类？分类里的菜不会被删除。',
        collection: 'categories',
        id,
        cacheKeys: 'menu',
        onDone: async () => {
            clearDishCaches()
            if (categoryId.value === id) categoryId.value = ''
            await loadCategories({ fresh: true })
        },
    })

// ===== 生命周期 =====
const reloadAll = async ({ fresh = false } = {}) => {
    if (fresh) {
        clearPCache('menu_facets')
        clearPCache('menu_order_counts')
    }
    await Promise.all([
        loadFirst({ useCache: !fresh, keep: true }),
        loadFacets(),
        loadOrderCounts(),
        loadCategories({ fresh }),
    ])
}

const onRefresh = async () => {
    refreshing.value = true
    await reloadAll({ fresh: true })
    refreshing.value = false
}

// 别的页面改了菜：缓存已被清掉，重新拉第一页和计数
const onMenuChanged = () => {
    loadFirst({ useCache: false, keep: true })
    loadFacets()
    loadCategories()
}

let loadedOnce = false
onMounted(() => {
    reloadAll()
    loadedOnce = true
    uni.$on('menu:changed', onMenuChanged)
})
onUnmounted(() => {
    uni.$off('menu:changed', onMenuChanged)
    clearTimeout(kwTimer)
})

// tab 页切回来：点菜次数可能变了（缓存 1 分钟）；列表 30 秒内刚拉过就不再请求
onShow(() => {
    if (!loadedOnce) return
    loadOrderCounts()
    if (!loading.value && Date.now() - lastLoadAt > 30000) refreshFirstPage()
})
</script>

<style scoped>
.page-root {
    height: 100vh;
}
.page-scroll {
    height: 100vh;
    background: transparent;
}

/* 标题 */
.hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24rpx;
    padding: 48rpx 40rpx 8rpx;
}
.hero-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
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
    letter-spacing: 0.04em;
}
.new-btn {
    flex-shrink: 0;
    height: 68rpx;
    padding: 0 28rpx;
    display: flex;
    align-items: center;
    border-radius: 999rpx;
    background: var(--ink);
    color: #fff;
    font-size: 24rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    box-shadow: 0 16rpx 32rpx -16rpx rgba(30, 26, 23, 0.6);
    margin-bottom: 6rpx;
}

/* 搜索 */
.search {
    margin: 28rpx 32rpx 0;
    height: 84rpx;
    padding: 0 20rpx 0 28rpx;
    display: flex;
    align-items: center;
    gap: 14rpx;
    border-radius: 999rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.search-icon {
    font-size: 26rpx;
    opacity: 0.7;
}
.search-input {
    flex: 1;
    font-size: 26rpx;
    color: var(--ink);
}
.search-ph {
    color: var(--faint);
}
.search-clear {
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    background: rgba(30, 26, 23, 0.08);
    color: var(--ink-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    line-height: 1;
}

/* 范围 / 地区 */
.tabs {
    white-space: nowrap;
    padding: 28rpx 32rpx 0;
    box-sizing: border-box;
}
.tab {
    display: inline-block;
    margin-right: 36rpx;
    padding: 8rpx 0 12rpx;
    font-size: 28rpx;
    color: var(--muted);
    border-bottom: 4rpx solid transparent;
    letter-spacing: 0.04em;
}
.tab.active {
    color: var(--ink);
    font-weight: 700;
    border-bottom-color: var(--ink);
}

/* 标签行 */
.chips {
    white-space: nowrap;
    padding: 18rpx 32rpx 0;
    box-sizing: border-box;
}
.chip {
    margin-right: 14rpx;
    font-size: 22rpx;
    letter-spacing: 0.04em;
}
.chip-count {
    font-family: var(--font-serif);
    font-style: italic;
    opacity: 0.6;
}
.chip--manage {
    border-style: dashed;
    color: var(--muted);
}
.course-bar {
    display: flex;
    align-items: center;
    padding-right: 32rpx;
}
.course-scroll {
    flex: 1;
    min-width: 0;
    padding-right: 8rpx;
}
.filter-btn {
    position: relative;
    flex-shrink: 0;
    margin-top: 18rpx;
    height: 56rpx;
    padding: 0 24rpx;
    display: flex;
    align-items: center;
    gap: 8rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
    color: var(--ink);
    background: rgba(255, 255, 255, 0.85);
    border: 1rpx solid var(--line);
}
.filter-btn.on {
    border-color: var(--ink);
}
.filter-badge {
    min-width: 32rpx;
    height: 32rpx;
    padding: 0 8rpx;
    box-sizing: border-box;
    border-radius: 999rpx;
    background: var(--coral);
    color: #fff;
    font-size: 20rpx;
    line-height: 32rpx;
    text-align: center;
}

/* 列表 */
.list {
    padding: 28rpx 32rpx 0;
}
.dish-row {
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 20rpx;
    margin-bottom: 20rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.dish-row--hover {
    opacity: 0.85;
}
.dish-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
}
.dish-top {
    display: flex;
    align-items: center;
    gap: 10rpx;
    min-width: 0;
}
.dish-name {
    font-family: var(--font-serif);
    font-size: 32rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.dish-meta {
    font-size: 22rpx;
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.dish-tags {
    display: flex;
    align-items: center;
    gap: 8rpx;
    flex-wrap: wrap;
}
.dish-tag {
    font-size: 19rpx;
    padding: 2rpx 12rpx;
    border-radius: 999rpx;
    background: rgba(244, 199, 180, 0.4);
    color: var(--ink-2);
    letter-spacing: 0.04em;
}
.dish-spice {
    font-size: 20rpx;
    letter-spacing: -2rpx;
}
.dish-count {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 21rpx;
    color: var(--muted);
}
.dish-side {
    align-self: stretch;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12rpx;
}
.dish-add,
.dish-minus,
.dish-plus {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34rpx;
    line-height: 1;
}
.dish-add,
.dish-plus {
    background: var(--ink);
    color: #fff;
    box-shadow: 0 10rpx 20rpx -10rpx rgba(30, 26, 23, 0.6);
}
.dish-minus {
    background: rgba(30, 26, 23, 0.06);
    color: var(--ink);
}
.dish-stepper {
    display: flex;
    align-items: center;
    gap: 14rpx;
}
.dish-qty {
    min-width: 28rpx;
    text-align: center;
    font-family: var(--font-serif);
    font-size: 30rpx;
    font-weight: 700;
    color: var(--ink);
}
.dish-off {
    font-size: 20rpx;
    color: var(--muted);
    padding: 6rpx 16rpx;
    border-radius: 999rpx;
    background: rgba(30, 26, 23, 0.06);
}
.list-footer {
    padding: 16rpx 0 8rpx;
    text-align: center;
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.1em;
}
.list-retry {
    color: var(--coral);
}

/* 骨架 */
.skeleton-row {
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 20rpx;
    margin-bottom: 20rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
}
.shimmer {
    background: linear-gradient(90deg, var(--bg-2) 25%, var(--bg) 50%, var(--bg-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}
.skeleton-thumb {
    width: 132rpx;
    height: 132rpx;
    border-radius: 28rpx;
    flex-shrink: 0;
}
.skeleton-text {
    flex: 1;
}
.skeleton-bar {
    height: 30rpx;
    width: 60%;
    border-radius: 999rpx;
    margin-bottom: 18rpx;
}
.skeleton-line {
    height: 20rpx;
    width: 80%;
    border-radius: 999rpx;
    margin-bottom: 12rpx;
}
.skeleton-line.short {
    width: 36%;
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
.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 100rpx 40rpx 80rpx;
    margin-top: 28rpx;
}
.empty-bubble {
    width: 180rpx;
    height: 180rpx;
    border-radius: 50%;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-soft);
    margin-bottom: 32rpx;
}
.empty-emoji {
    font-size: 80rpx;
}
.empty-title {
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    text-align: center;
}
.empty-hint {
    font-size: 24rpx;
    color: var(--muted);
    margin-top: 12rpx;
    letter-spacing: 0.06em;
    text-align: center;
}
.empty-btn {
    margin-top: 32rpx;
    height: 80rpx;
}

.bottom-space {
    height: 80rpx;
}
.bottom-space--cart {
    height: 220rpx;
}

/* 点菜篮 */
.cart-bar {
    position: fixed;
    left: 32rpx;
    right: 32rpx;
    bottom: 24rpx;
    height: 104rpx;
    padding: 0 14rpx 0 20rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;
    border-radius: 999rpx;
    background: var(--grad-ink);
    color: #fff;
    box-shadow: 0 24rpx 48rpx -16rpx rgba(30, 26, 23, 0.55);
    z-index: 60;
    animation: cart-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes cart-in {
    from {
        transform: translateY(160rpx);
    }
    to {
        transform: translateY(0);
    }
}
.cart-icon {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36rpx;
}
.cart-text {
    flex: 1;
    font-size: 26rpx;
    letter-spacing: 0.04em;
}
.cart-go {
    height: 76rpx;
    padding: 0 36rpx;
    display: flex;
    align-items: center;
    border-radius: 999rpx;
    background: var(--peach);
    color: var(--ink);
    font-size: 26rpx;
    font-weight: 700;
    letter-spacing: 0.08em;
}

/* 底部弹层 */
.mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(30, 26, 23, 0.35);
    z-index: 200;
    display: flex;
    align-items: flex-end;
}
.sheet {
    width: 100%;
    max-height: 86vh;
    overflow-y: auto;
    background: var(--card-solid);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    padding: 20rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    animation: sheet-up 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes sheet-up {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}
.sheet-handle {
    width: 72rpx;
    height: 8rpx;
    border-radius: 8rpx;
    background: var(--faint);
    margin: 0 auto 24rpx;
}
.sheet-title {
    display: block;
    font-size: 44rpx;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 12rpx;
}
.sheet-hint {
    display: block;
    font-size: 22rpx;
    color: var(--muted);
    margin-bottom: 24rpx;
}
.label {
    display: block;
    font-size: 22rpx;
    letter-spacing: 0.2em;
    color: var(--muted);
    margin: 24rpx 0 16rpx;
}
.opt-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 14rpx;
}
.opt {
    padding: 14rpx 26rpx;
    border-radius: 999rpx;
    background: var(--bg);
    font-size: 24rpx;
    color: var(--ink-2);
    border: 2rpx solid transparent;
}
.opt.active {
    background: var(--ink);
    color: #fff;
}
.sheet-actions {
    display: flex;
    gap: 20rpx;
    margin-top: 44rpx;
}
.sheet-reset {
    flex: 1;
}
.sheet-ok {
    flex: 2;
}

/* 分类管理 */
.cat-add {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 12rpx;
}
.cat-input {
    flex: 1;
    height: 80rpx;
    padding: 0 28rpx;
    border-radius: var(--r-m);
    background: var(--bg);
    font-size: 28rpx;
    color: var(--ink);
}
.cat-add-btn {
    height: 80rpx;
    padding: 0 36rpx;
    display: flex;
    align-items: center;
    border-radius: 999rpx;
    background: var(--ink);
    color: #fff;
    font-size: 26rpx;
    font-weight: 600;
}
.cat-scroll {
    max-height: 56vh;
}
.cat-empty {
    padding: 48rpx 0;
    text-align: center;
    font-size: 24rpx;
    color: var(--muted);
}
.cat-row {
    position: relative;
    padding: 22rpx 4rpx;
    background: var(--card-solid);
    transition:
        transform 0.15s ease,
        opacity 0.15s;
}
.cat-row.dragging {
    opacity: 0.95;
    border-radius: var(--r-m);
    transition: none;
}
.cat-row::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1rpx;
    background: var(--line);
}
.cat-edit,
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
    font-family: var(--font-serif);
    font-size: 24rpx;
    font-weight: 700;
    color: var(--ink);
}
.cat-name {
    flex: 1;
    font-size: 28rpx;
    color: var(--ink);
    font-weight: 500;
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

/* 照片背景：页面样式在全局样式之后加载，同优先级会盖住全局玻璃规则，这里提高一级 */
.photo-mode .photo-glass {
    background: var(--glass);
    border-color: var(--glass-border);
    box-shadow: var(--glass-shadow);
}
/* 直接压在照片上的分段标签、列表底部文字改白字 */
.photo-mode .tab,
.photo-mode .list-footer {
    color: var(--photo-text-2);
    text-shadow: var(--photo-shadow);
}
.photo-mode .tab.active {
    color: var(--photo-text);
    border-bottom-color: var(--photo-text);
}
.photo-mode .filter-btn {
    background: var(--glass-strong);
    border-color: transparent;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}
.photo-mode .filter-btn.on {
    border-color: var(--ink);
}
</style>
