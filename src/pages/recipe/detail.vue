<template>
    <page-bg tone="peach" />
    <view class="page" :class="{ 'photo-mode': isPhotoBg }">
        <scroll-view scroll-y class="scroll">
            <!-- 骨架 -->
            <view v-if="!dish && loading" class="skeleton">
                <view class="sk-hero"></view>
                <view class="sk-card">
                    <view class="sk-line sk-line--title"></view>
                    <view class="sk-line"></view>
                    <view class="sk-line sk-line--short"></view>
                </view>
            </view>

            <!-- 加载失败 / 菜品不存在 -->
            <view v-else-if="!dish" class="empty photo-empty">
                <view class="empty-bubble"><text>🍽️</text></view>
                <text class="empty-title">{{ errorMsg || '这道菜找不到了' }}</text>
                <view class="ui-btn ui-btn--ghost empty-btn ui-press" @tap="load(true)">重新加载</view>
            </view>

            <template v-else>
                <view class="hero" @tap="previewImage">
                    <dish-cover :dish="dish" size="l" />
                </view>

                <!-- 基本信息 -->
                <view class="info ui-card photo-glass ui-fade-up">
                    <text class="ui-eyebrow">{{ dish.source === 'builtin' ? "CHEF'S PICK · 精选菜谱" : 'FAMILY RECIPE · 家里的菜' }}</text>
                    <view class="title-row">
                        <view class="title-main">
                            <text class="dish-name ui-serif">{{ dish.name }}</text>
                            <text class="ui-hidden-tag" v-if="dish.hidden">已隐藏</text>
                        </view>
                        <view class="ui-more more-btn" @tap="openMore">···</view>
                    </view>
                    <text class="dish-alias" v-if="dish.alias">{{ dish.alias }}</text>
                    <text class="dish-desc" v-if="dish.description">{{ dish.description }}</text>

                    <view class="chip-row">
                        <view class="meta-chip" :style="{ background: cuisine.color }">
                            <text>{{ cuisine.emoji }} {{ cuisine.label }}</text>
                        </view>
                        <view class="meta-chip" v-if="course"><text>{{ course.emoji }} {{ course.label }}</text></view>
                        <view class="meta-chip" v-if="dish.time_min"><text>⏱ {{ dish.time_min }} 分钟</text></view>
                        <view class="meta-chip" v-if="dish.servings"><text>👥 {{ dish.servings }} 人份</text></view>
                        <view class="meta-chip" v-if="dish.difficulty">
                            <text>{{ '●'.repeat(dish.difficulty) }} {{ DIFFICULTY_LABELS[dish.difficulty] }}</text>
                        </view>
                        <view class="meta-chip" v-if="spiceLabel"><text>🌶️ {{ spiceLabel }}</text></view>
                    </view>
                    <view class="chip-row" v-if="tags.length">
                        <text class="tag-chip" v-for="t in tags" :key="t.key">{{ t.emoji }} {{ t.label }}</text>
                    </view>
                    <view class="stat-row">
                        <text class="stat-num ui-serif">{{ orderCount }}</text>
                        <text class="stat-unit">已点 {{ orderCount }} 次</text>
                        <text class="stat-off" v-if="dish.available === false">· 暂时不可点</text>
                    </view>
                </view>

                <!-- 食材清单：勾选只是做菜时自己看的，不保存 -->
                <view class="section ui-card photo-glass ui-fade-up ui-d1" v-if="ingredients.length">
                    <view class="sec-head">
                        <text class="ui-eyebrow">INGREDIENTS</text>
                        <text class="sec-title ui-serif">食材</text>
                        <text class="sec-note">{{ checkedCount }}/{{ ingredients.length }} 已备好</text>
                    </view>
                    <view
                        class="ingredient-item ui-press"
                        v-for="(ing, idx) in ingredients"
                        :key="idx"
                        :class="{ done: checked[idx] }"
                        @tap="checked[idx] = !checked[idx]"
                    >
                        <view class="ing-box"><text v-if="checked[idx]">✓</text></view>
                        <text class="ing-text">{{ ing }}</text>
                    </view>
                </view>

                <!-- 做法 -->
                <view class="section ui-card photo-glass ui-fade-up ui-d2" v-if="steps.length">
                    <view class="sec-head">
                        <text class="ui-eyebrow">METHOD</text>
                        <text class="sec-title ui-serif">做法</text>
                        <text class="sec-note">{{ steps.length }} 步</text>
                    </view>
                    <view class="step-item" v-for="(s, idx) in steps" :key="idx">
                        <text class="step-num ui-serif">{{ String(idx + 1).padStart(2, '0') }}</text>
                        <text class="step-text">{{ s }}</text>
                    </view>
                </view>
                <view class="section ui-card photo-glass no-steps ui-press ui-fade-up ui-d2" v-else @tap="goEdit">
                    <text class="no-steps-emoji">📝</text>
                    <view class="no-steps-body">
                        <text class="no-steps-title">还没有做法，补充一下吧</text>
                        <text class="no-steps-sub">把步骤写下来，下次谁都能照着做</text>
                    </view>
                    <text class="no-steps-arrow">›</text>
                </view>

                <view class="tips ui-fade-up ui-d3" v-if="dish.tips">
                    <text class="tips-label">💡 小贴士</text>
                    <text class="tips-text">{{ dish.tips }}</text>
                </view>

                <!-- 点赞 & 评论 -->
                <view class="section ui-card photo-glass ui-fade-up ui-d3">
                    <view class="interact-bar">
                        <view class="like-btn ui-press" :class="{ liked }" @tap="toggleLike(dish)">
                            <text>{{ liked ? '❤' : '♡' }}</text>
                            <text>{{ likeCount || '喜欢' }}</text>
                        </view>
                        <text class="comment-count">💬 {{ comments.length }} 条评论</text>
                    </view>
                    <view class="comment-item" v-for="c in comments" :key="c._id">
                        <view class="comment-body">
                            <text class="comment-user">{{ c.user_name }}</text>
                            <text class="comment-text" v-if="c.reply_to_user"
                                >回复 <text class="comment-reply">@{{ c.reply_to_user }}</text>：{{ c.content }}</text
                            >
                            <text class="comment-text" v-else>{{ c.content }}</text>
                        </view>
                        <text class="comment-del" v-if="c.user_id === currentUserId" @tap="handleDeleteComment(c._id)">×</text>
                    </view>
                    <view class="comment-input-row">
                        <input
                            class="comment-input"
                            v-model="commentText"
                            placeholder="说说这道菜..."
                            confirm-type="send"
                            @confirm="handleAddComment"
                        />
                        <view class="comment-send ui-press" @tap="handleAddComment">发送</view>
                    </view>
                </view>
                <view class="bottom-space"></view>
            </template>
        </scroll-view>

        <!-- 底部操作栏 -->
        <view class="action-bar" v-if="dish">
            <view class="bar-side">
                <view class="ui-btn ui-btn--disabled bar-main" v-if="dish.available === false">暂时不可点</view>
                <view class="ui-btn add-cart bar-main ui-press" v-else-if="!inCart" @tap="add(dish)">＋ 加入点菜篮</view>
                <view class="stepper" v-else>
                    <view class="stepper-minus ui-press" @tap="setServings(dish._id, inCart - 1)">−</view>
                    <view class="stepper-val">
                        <text class="stepper-num ui-serif">{{ inCart }}</text>
                        <text class="stepper-unit">份</text>
                    </view>
                    <view class="stepper-plus ui-press" @tap="setServings(dish._id, inCart + 1)">＋</view>
                </view>
            </view>
            <view class="ui-btn ui-btn--ghost go-cart ui-press" @tap="goCart">
                <text>🧺 去点菜篮</text>
                <text class="cart-badge" v-if="count">{{ count }}</text>
            </view>
        </view>
    </view>
</template>

<script setup>
/**
 * 菜谱详情：封面、食材清单、做法、点赞评论，底部直接加入点菜篮
 * 先显示缓存的菜品，再取最新内容；编辑 / 隐藏后通过 menu:changed 刷新
 */
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { getPCache, useSharedBg } from '../../utils/cloud'
import { DIFFICULTY_LABELS } from '../../utils/constants'
import {
    fetchDish,
    fetchOrderCounts,
    clearDishCaches,
    cuisineOf,
    courseOf,
    tagOf,
    SPICE_LABELS,
    useCart,
} from '../../utils/menu'
import { useInteractions } from '../../utils/useInteractions'
import { loadComments, addComment, deleteComment, getCurrentUser } from '../../utils/interactions'
import { confirmDelete, isAdminUser, toggleHidden, showMoreActions } from '../../utils/contentActions'

const { isPhotoBg } = useSharedBg()
const { count, add, setServings, servingsOf } = useCart()
const { likeCounts, likedByMe, loadInteractions, toggleLike } = useInteractions('dish')
const isAdmin = isAdminUser()
const currentUserId = getCurrentUser().user_id

const dishId = ref('')
const dish = ref(null)
const loading = ref(true)
const errorMsg = ref('')
const orderCounts = ref(null)
const checked = ref({})
const comments = ref([])
const commentText = ref('')
// 删除后本页也会收到 menu:changed，不能再去请求一道已经不存在的菜
let removed = false

const cuisine = computed(() => cuisineOf(dish.value?.cuisine))
const course = computed(() => courseOf(dish.value?.course))
const tags = computed(() => (dish.value?.tags || []).map(tagOf).filter(Boolean))
// 早期的菜没有辣度字段，不显示「不辣」免得误导
const spiceLabel = computed(() => {
    const s = dish.value?.spice
    return typeof s === 'number' ? SPICE_LABELS[s] : ''
})
const ingredients = computed(() =>
    String(dish.value?.ingredients || '')
        .split(/[,，、;；\n]/)
        .map(s => s.trim())
        .filter(Boolean)
)
const steps = computed(() => (dish.value?.steps || []).map(s => String(s || '').trim()).filter(Boolean))
const checkedCount = computed(() => ingredients.value.filter((_, i) => checked.value[i]).length)
// 订单库聚合的次数更准确（不含已取消），拿不到时退回菜品上的计数
const orderCount = computed(() => {
    const id = dishId.value
    if (orderCounts.value && id in orderCounts.value) return orderCounts.value[id]
    return dish.value?.order_count || 0
})
const liked = computed(() => !!likedByMe.value[dishId.value])
const likeCount = computed(() => likeCounts.value[dishId.value] || 0)
const inCart = computed(() => servingsOf(dishId.value))

const applyDish = d => {
    dish.value = d
    uni.setNavigationBarTitle({ title: d.name || '菜谱详情' })
}

async function load(fresh = false) {
    const id = dishId.value
    if (!id || removed) return
    if (!fresh && getPCache('dish_' + id)) {
        try {
            applyDish(await fetchDish(id))
        } catch (e) {}
    }
    loading.value = true
    errorMsg.value = ''
    try {
        applyDish(await fetchDish(id, { fresh: true }))
    } catch (e) {
        if (!dish.value) errorMsg.value = e.message || '加载失败'
        else uni.showToast({ title: '刷新失败，显示的是缓存', icon: 'none' })
    } finally {
        loading.value = false
    }
}

const reloadComments = async () => {
    comments.value = await loadComments('dish', dishId.value)
}

const loadExtras = () => {
    loadInteractions([dishId.value]).catch(() => {})
    reloadComments().catch(() => {})
    fetchOrderCounts()
        .then(c => (orderCounts.value = c))
        .catch(() => {})
}

const onMenuChanged = () => load(true)

onLoad(options => {
    dishId.value = options.id || ''
    if (!dishId.value) {
        loading.value = false
        errorMsg.value = '缺少菜品'
        return
    }
    load()
    loadExtras()
    uni.$on('menu:changed', onMenuChanged)
})
onUnload(() => uni.$off('menu:changed', onMenuChanged))

const previewImage = () => {
    const url = dish.value?.displayUrl
    if (url) uni.previewImage({ urls: [url], current: url })
}

const goEdit = () => uni.navigateTo({ url: '/pages/recipe/edit?id=' + dishId.value })
const goCart = () => uni.navigateTo({ url: '/pages/recipe/cart' })

const notifyChanged = () => {
    clearDishCaches()
    uni.$emit('menu:changed')
}

const openMore = () =>
    showMoreActions([
        { label: '编辑', run: goEdit },
        {
            label: dish.value.hidden ? '取消隐藏' : '隐藏（其他成员看不到）',
            show: isAdmin,
            run: async () => {
                if (await toggleHidden('dishes', dish.value, 'menu')) notifyChanged()
            },
        },
        {
            label: '删除',
            run: async () => {
                const ok = await confirmDelete({
                    content: `确定删除「${dish.value.name}」？`,
                    collection: 'dishes',
                    id: dishId.value,
                    cacheKeys: 'menu',
                })
                if (!ok) return
                removed = true
                // 点菜篮里还留着这道菜的话，下单时会变成找不到的菜
                setServings(dishId.value, 0)
                notifyChanged()
                uni.showToast({ title: '已删除', icon: 'success' })
                setTimeout(() => uni.navigateBack(), 600)
            },
        },
    ])

const handleAddComment = async () => {
    const text = commentText.value.trim()
    if (!text) return
    const res = await addComment('dish', dishId.value, text, null)
    if (!res) {
        uni.showToast({ title: '评论失败', icon: 'none' })
        return
    }
    commentText.value = ''
    await reloadComments()
}

const handleDeleteComment = async commentId => {
    const ok = await deleteComment(commentId)
    if (!ok) {
        uni.showToast({ title: '删除失败', icon: 'none' })
        return
    }
    await reloadComments()
}
</script>

<style scoped>
.page {
    height: 100vh;
    display: flex;
    flex-direction: column;
}
.scroll {
    flex: 1;
    height: 0;
}
.hero {
    position: relative;
}

/* 骨架 */
.skeleton {
    padding-bottom: 40rpx;
}
.sk-hero {
    height: 520rpx;
    background: var(--bg-2);
}
.sk-card {
    margin: -60rpx 32rpx 0;
    position: relative;
    padding: 40rpx;
    border-radius: var(--r-xl);
    background: var(--card);
}
.sk-line {
    height: 28rpx;
    border-radius: 14rpx;
    background: var(--bg-2);
    margin-bottom: 20rpx;
}
.sk-line--title {
    width: 60%;
    height: 48rpx;
}
.sk-line--short {
    width: 40%;
}

/* 空状态 */
.empty {
    margin: 200rpx 48rpx 0;
    padding: 64rpx 40rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24rpx;
}
.empty-bubble {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 72rpx;
}
.empty-title {
    font-size: 30rpx;
    color: var(--ink-2);
}
.empty-btn {
    height: 80rpx;
}

/* 基本信息 */
.info {
    position: relative;
    margin: -64rpx 32rpx 0;
    padding: 40rpx 40rpx 36rpx;
    border-radius: var(--r-xl);
}
.title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16rpx;
    margin-top: 10rpx;
}
.title-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14rpx;
}
.dish-name {
    font-size: 56rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.2;
}
.dish-alias {
    display: block;
    margin-top: 6rpx;
    font-size: 24rpx;
    color: var(--muted);
    letter-spacing: 0.06em;
}
.dish-desc {
    display: block;
    margin-top: 20rpx;
    font-size: 28rpx;
    line-height: 1.8;
    color: var(--ink-2);
}
.chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 24rpx;
}
.meta-chip {
    padding: 8rpx 22rpx;
    border-radius: 999rpx;
    font-size: 23rpx;
    color: var(--ink-2);
    background: var(--bg);
}
.tag-chip {
    padding: 6rpx 20rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
    color: var(--ink-2);
    border: 1rpx solid var(--line);
    background: rgba(255, 255, 255, 0.6);
}
.stat-row {
    display: flex;
    align-items: baseline;
    gap: 12rpx;
    margin-top: 28rpx;
    padding-top: 24rpx;
    border-top: 1rpx solid var(--line);
}
.stat-num {
    font-size: 48rpx;
    font-weight: 700;
    color: var(--coral);
    line-height: 1;
}
.stat-unit {
    font-size: 24rpx;
    color: var(--muted);
    letter-spacing: 0.08em;
}
.stat-off {
    font-size: 24rpx;
    color: var(--muted);
}

/* 分区卡片 */
.section {
    margin: 28rpx 32rpx 0;
    padding: 36rpx 40rpx;
    border-radius: var(--r-xl);
}
.sec-head {
    display: flex;
    align-items: baseline;
    gap: 16rpx;
    margin-bottom: 20rpx;
}
.sec-title {
    font-size: 38rpx;
    font-weight: 700;
    color: var(--ink);
}
.sec-note {
    margin-left: auto;
    font-size: 22rpx;
    color: var(--muted);
}

.ingredient-item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 18rpx 0;
}
.ingredient-item + .ingredient-item {
    border-top: 1rpx dashed var(--line);
}
.ing-box {
    width: 40rpx;
    height: 40rpx;
    border-radius: 12rpx;
    border: 2rpx solid var(--faint);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    color: #fff;
    flex-shrink: 0;
}
.ing-text {
    font-size: 28rpx;
    color: var(--ink);
}
.ingredient-item.done .ing-box {
    background: var(--sage);
    border-color: var(--sage);
    color: var(--ink);
}
.ingredient-item.done .ing-text {
    color: var(--faint);
    text-decoration: line-through;
}

.step-item {
    display: flex;
    gap: 24rpx;
    padding: 22rpx 0;
}
.step-item + .step-item {
    border-top: 1rpx solid var(--line);
}
.step-num {
    font-size: 60rpx;
    font-weight: 700;
    line-height: 1;
    color: var(--peach);
    width: 76rpx;
    flex-shrink: 0;
}
.step-text {
    flex: 1;
    font-size: 28rpx;
    line-height: 1.8;
    color: var(--ink-2);
}

.no-steps {
    display: flex;
    align-items: center;
    gap: 24rpx;
}
.no-steps-emoji {
    font-size: 48rpx;
}
.no-steps-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
}
.no-steps-title {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--ink);
}
.no-steps-sub {
    font-size: 23rpx;
    color: var(--muted);
}
.no-steps-arrow {
    font-size: 44rpx;
    color: var(--faint);
}

.tips {
    margin: 28rpx 32rpx 0;
    padding: 32rpx 36rpx;
    border-radius: var(--r-l);
    background: rgba(245, 227, 179, 0.75);
    border: 1rpx solid rgba(255, 255, 255, 0.7);
}
.tips-label {
    display: block;
    font-size: 24rpx;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: 0.1em;
    margin-bottom: 10rpx;
}
.tips-text {
    font-size: 27rpx;
    line-height: 1.8;
    color: var(--ink-2);
}

/* 点赞评论 */
.interact-bar {
    display: flex;
    align-items: center;
    gap: 24rpx;
    margin-bottom: 8rpx;
}
.like-btn {
    display: flex;
    align-items: center;
    gap: 10rpx;
    padding: 12rpx 30rpx;
    border-radius: 999rpx;
    font-size: 26rpx;
    color: var(--ink-2);
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
}
.like-btn.liked {
    color: var(--coral);
    background: rgba(224, 122, 95, 0.1);
    border-color: rgba(224, 122, 95, 0.2);
}
.comment-count {
    font-size: 24rpx;
    color: var(--muted);
}
.comment-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 18rpx 0;
    border-top: 1rpx solid var(--line);
}
.comment-body {
    flex: 1;
    min-width: 0;
}
.comment-user {
    font-size: 24rpx;
    color: var(--ink);
    font-weight: 600;
    margin-right: 12rpx;
}
.comment-text {
    font-size: 26rpx;
    color: var(--ink-2);
    line-height: 1.6;
}
.comment-reply {
    font-size: 24rpx;
    color: var(--muted);
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
    height: 72rpx;
    background: var(--bg);
    border-radius: 999rpx;
    padding: 0 28rpx;
    font-size: 26rpx;
    color: var(--ink);
}
.comment-send {
    height: 72rpx;
    line-height: 72rpx;
    padding: 0 32rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-size: 24rpx;
    font-weight: 600;
    letter-spacing: 0.08em;
    flex-shrink: 0;
}
.bottom-space {
    height: calc(200rpx + env(safe-area-inset-bottom));
}

/* 底部操作栏 */
.action-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
    background: rgba(255, 250, 244, 0.92);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border-top: 1rpx solid var(--line);
    z-index: 20;
}
.bar-side {
    flex: 1.3;
    min-width: 0;
}
.bar-main {
    width: 100%;
    padding: 0;
}
.stepper {
    height: 96rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12rpx;
    border-radius: 999rpx;
    background: var(--ink);
}
.stepper-minus,
.stepper-plus {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    font-size: 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}
.stepper-val {
    display: flex;
    align-items: baseline;
    gap: 6rpx;
    color: #fff;
}
.stepper-num {
    font-size: 40rpx;
    font-weight: 700;
}
.stepper-unit {
    font-size: 22rpx;
    opacity: 0.8;
}
.go-cart {
    flex: 1;
    padding: 0 24rpx;
    position: relative;
}
.cart-badge {
    min-width: 36rpx;
    height: 36rpx;
    line-height: 36rpx;
    padding: 0 10rpx;
    box-sizing: border-box;
    border-radius: 999rpx;
    background: var(--coral);
    color: #fff;
    font-size: 20rpx;
    text-align: center;
}
</style>
