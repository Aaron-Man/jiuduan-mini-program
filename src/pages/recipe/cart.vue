<template>
    <page-bg overlay="light" tone="butter" />
    <view class="cart-page" :class="{ 'photo-mode': isPhotoBg }">
        <!-- 空篮子 -->
        <view v-if="!cart.items.length && !submitting" class="cart-empty photo-empty ui-fade-up">
            <view class="empty-bubble"><text class="empty-emoji">🧺</text></view>
            <text class="empty-title">点菜篮是空的</text>
            <text class="empty-hint">去菜谱挑几道想吃的菜吧</text>
            <view class="back-menu-btn ui-btn ui-press" @tap="goMenu"><text>去点菜</text></view>
        </view>

        <template v-else>
            <scroll-view scroll-y class="cart-scroll">
                <view class="hero ui-fade-up">
                    <text class="ui-eyebrow">BASKET</text>
                    <text class="ui-title hero-title">这一餐吃什么</text>
                    <text class="ui-sub hero-sub">选好时间，确认后会通知家人</text>
                </view>

                <!-- 已选的菜 -->
                <view class="section-head ui-fade-up ui-d1">
                    <text class="section-title">已选 {{ count }} 道</text>
                    <text class="cart-clear ui-press" @tap="onClear">清空</text>
                </view>
                <view class="cart-list ui-card photo-glass ui-fade-up ui-d1">
                    <view class="cart-item" v-for="it in cart.items" :key="it.dishId">
                        <view class="item-main">
                            <view class="ui-press" @tap="openDish(it)">
                                <dish-cover :dish="it" size="s" />
                            </view>
                            <view class="item-info">
                                <text class="item-name" @tap="openDish(it)">{{ it.name }}</text>
                                <text class="item-cuisine">{{ cuisineLabel(it) }}</text>
                                <view class="stepper">
                                    <view class="stepper-btn stepper-minus ui-press" @tap="setServings(it.dishId, it.servings - 1)">
                                        <text>−</text>
                                    </view>
                                    <text class="servings-num">{{ it.servings }} 份</text>
                                    <view
                                        class="stepper-btn stepper-plus ui-press"
                                        :class="{ 'stepper-btn--off': it.servings >= 20 }"
                                        @tap="setServings(it.dishId, it.servings + 1)"
                                    >
                                        <text>+</text>
                                    </view>
                                </view>
                            </view>
                        </view>
                        <input
                            class="item-note"
                            :value="it.note"
                            maxlength="60"
                            placeholder="这道菜的要求，如少辣、不要香菜"
                            placeholder-class="ph"
                            @input="e => setNote(it.dishId, e.detail.value)"
                        />
                    </view>
                </view>

                <!-- 什么时候吃 -->
                <view class="section-head ui-fade-up ui-d2">
                    <text class="section-title">什么时候吃</text>
                </view>
                <view class="planner ui-card photo-glass ui-fade-up ui-d2">
                    <text class="ui-eyebrow">DATE</text>
                    <view class="chip-row">
                        <view
                            class="day-chip ui-chip ui-press"
                            :class="{ active: mealDate === d.value }"
                            v-for="d in dayOptions"
                            :key="d.value"
                            @tap="mealDate = d.value"
                        >
                            <text>{{ d.label }}</text>
                        </view>
                        <picker mode="date" :value="mealDate" :start="dayOptions[0].value" @change="onPickDate">
                            <view class="day-chip day-chip--pick ui-chip ui-press" :class="{ active: isCustomDate }">
                                <text>📅 {{ isCustomDate ? customDateLabel : '选日期' }}</text>
                            </view>
                        </picker>
                    </view>
                    <text class="ui-eyebrow planner-label">MEAL</text>
                    <view class="chip-row">
                        <view
                            class="slot-chip ui-chip ui-press"
                            :class="{ active: mealSlot === s.key }"
                            v-for="s in MEAL_SLOTS"
                            :key="s.key"
                            @tap="mealSlot = s.key"
                        >
                            <text>{{ s.emoji }} {{ s.label }}</text>
                        </view>
                    </view>
                    <text class="ui-eyebrow planner-label">NOTE</text>
                    <input
                        class="meal-note"
                        v-model="note"
                        maxlength="80"
                        placeholder="给掌勺的留句话（选填）"
                        placeholder-class="ph"
                    />
                </view>

                <view class="bottom-space"></view>
            </scroll-view>

            <!-- 底部结算栏 -->
            <view class="cart-bar photo-glass">
                <view class="cart-summary">
                    <text class="summary-main ui-serif">共 {{ count }} 道 · {{ totalServings }} 份</text>
                    <text class="summary-sub">{{ whenLabel }}</text>
                </view>
                <view class="submit-btn ui-btn ui-press" :class="{ 'ui-btn--disabled': submitting }" @tap="onSubmit">
                    <text>{{ submitting ? '下单中…' : '确认下单' }}</text>
                </view>
            </view>
        </template>
    </view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed } from 'vue'
import { requestSubscribeFor, useSharedBg } from '../../utils/cloud'
import { MEAL_SLOTS, cuisineOf, slotOf, useCart, submitCart } from '../../utils/menu'

const { isPhotoBg } = useSharedBg()
const { cart, count, totalServings, setServings, setNote, clear } = useCart()

const pad = n => (n < 10 ? '0' + n : '' + n)
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseKey = k => {
    const [y, m, d] = k.split('-').map(Number)
    return new Date(y, m - 1, d)
}

const dayOptions = (() => {
    const base = new Date()
    return ['今天', '明天', '后天'].map((label, i) => {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
        return { label, value: keyOf(d) }
    })
})()

// 按现在的时间猜是哪一餐，大多数时候不用再点
const defaultSlot = () => {
    const h = new Date().getHours()
    if (h < 10) return 'breakfast'
    if (h < 15) return 'lunch'
    if (h < 21) return 'dinner'
    return 'night'
}

const mealDate = ref(dayOptions[0].value)
const mealSlot = ref(defaultSlot())
const note = ref('')
const submitting = ref(false)

const isCustomDate = computed(() => !dayOptions.some(d => d.value === mealDate.value))
const customDateLabel = computed(() => {
    const d = parseKey(mealDate.value)
    return `${d.getMonth() + 1}月${d.getDate()}日`
})
const whenLabel = computed(() => {
    const day = dayOptions.find(d => d.value === mealDate.value)
    const slot = slotOf(mealSlot.value)
    return `${day ? day.label : customDateLabel.value} · ${slot ? slot.emoji + ' ' + slot.label : ''}`
})

const cuisineLabel = it => cuisineOf(it.cuisine).label
const onPickDate = e => (mealDate.value = e.detail.value)
const openDish = it => uni.navigateTo({ url: '/pages/recipe/detail?id=' + it.dishId })
const goMenu = () => uni.switchTab({ url: '/pages/menu/menu' })

const onClear = () => {
    uni.showModal({
        title: '清空点菜篮',
        content: `确定清空已选的 ${count.value} 道菜？`,
        confirmColor: '#e07a5f',
        success: res => {
            if (res.confirm) clear()
        },
    })
}

const onSubmit = async () => {
    if (submitting.value || !cart.items.length) return
    // 订阅弹窗只能在点击事件里同步发起，所以放在任何 await 之前
    requestSubscribeFor('order')
    submitting.value = true
    try {
        await submitCart({ mealDate: mealDate.value, mealSlot: mealSlot.value, note: note.value.trim() })
        uni.showToast({ title: '下单成功', icon: 'success' })
        uni.$emit('orders:changed')
        // 留一点时间让提示被看到，再切到订单页
        setTimeout(() => uni.switchTab({ url: '/pages/orders/orders' }), 500)
    } catch (e) {
        submitting.value = false
        uni.showToast({ title: e.message || '下单失败，请重试', icon: 'none' })
    }
}
</script>

<style scoped>
.cart-page {
    position: relative;
    height: 100vh;
}
.cart-scroll {
    height: 100vh;
    background: transparent;
}

/* Hero */
.hero {
    padding: 40rpx 40rpx 8rpx;
    display: flex;
    flex-direction: column;
}
.hero-title {
    display: block;
    margin-top: 12rpx;
}
.hero-sub {
    display: block;
    margin-top: 12rpx;
    letter-spacing: 0.06em;
}

.section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 0 48rpx;
    margin: 40rpx 0 18rpx;
}
.section-title {
    font-family: var(--font-serif);
    font-size: 34rpx;
    font-weight: 700;
    color: var(--ink);
}
.cart-clear {
    font-size: 24rpx;
    color: var(--coral);
    letter-spacing: 0.08em;
    padding: 6rpx 0 6rpx 24rpx;
}

/* 菜品列表 */
.cart-list {
    margin: 0 32rpx;
    padding: 8rpx 28rpx;
}
.cart-item {
    padding: 24rpx 0;
    border-bottom: 1rpx solid var(--line);
}
.cart-item:last-child {
    border-bottom: none;
}
.item-main {
    display: flex;
    align-items: center;
    gap: 24rpx;
}
.item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.item-name {
    font-family: var(--font-serif);
    font-size: 32rpx;
    font-weight: 700;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.item-cuisine {
    font-size: 22rpx;
    color: var(--muted);
    margin-top: 4rpx;
    letter-spacing: 0.06em;
}
.stepper {
    display: flex;
    align-items: center;
    margin-top: 14rpx;
}
.stepper-btn {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
    font-size: 32rpx;
    color: var(--ink);
    line-height: 1;
}
.stepper-plus {
    background: var(--ink);
    border-color: var(--ink);
    color: #fff;
}
.stepper-btn--off {
    opacity: 0.35;
}
.servings-num {
    min-width: 96rpx;
    text-align: center;
    font-size: 26rpx;
    font-weight: 600;
    color: var(--ink);
}
.item-note {
    margin-top: 18rpx;
    height: 68rpx;
    padding: 0 24rpx;
    border-radius: var(--r-s);
    background: rgba(255, 255, 255, 0.6);
    border: 1rpx solid var(--line);
    font-size: 24rpx;
    color: var(--ink);
}
.ph {
    color: var(--faint);
}

/* 时间选择 */
.planner {
    margin: 0 32rpx;
    padding: 32rpx 28rpx;
    display: flex;
    flex-direction: column;
}
.planner-label {
    margin-top: 32rpx;
}
.chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-top: 16rpx;
}
.day-chip,
.slot-chip {
    padding: 14rpx 30rpx;
    font-size: 26rpx;
}
.meal-note {
    margin-top: 16rpx;
    height: 80rpx;
    padding: 0 24rpx;
    border-radius: var(--r-m);
    background: rgba(255, 255, 255, 0.6);
    border: 1rpx solid var(--line);
    font-size: 26rpx;
    color: var(--ink);
}

/* 底部结算栏 */
.cart-bar {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(24rpx + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 18rpx 18rpx 18rpx 36rpx;
    border-radius: 999rpx;
    background: var(--card-solid);
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow);
    z-index: 20;
}
.cart-summary {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.summary-main {
    font-size: 32rpx;
    font-weight: 700;
    color: var(--ink);
}
.summary-sub {
    font-size: 22rpx;
    color: var(--muted);
    margin-top: 4rpx;
    letter-spacing: 0.04em;
}
.submit-btn {
    height: 88rpx;
    padding: 0 44rpx;
    flex-shrink: 0;
}

.bottom-space {
    height: calc(200rpx + env(safe-area-inset-bottom));
}

/* 空状态 */
.cart-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 180rpx 0 120rpx;
}
.empty-bubble {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    background: var(--butter);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-soft);
    margin-bottom: 36rpx;
}
.empty-emoji {
    font-size: 88rpx;
}
.empty-title {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
}
.empty-hint {
    font-size: 24rpx;
    color: var(--muted);
    margin-top: 12rpx;
    letter-spacing: 0.06em;
}
.back-menu-btn {
    margin-top: 48rpx;
}

/* 照片背景：直接压在照片上的标题改白字 */
.photo-mode .section-title {
    color: var(--photo-text);
    text-shadow: var(--photo-shadow);
}
.photo-mode .cart-clear {
    color: var(--photo-text);
    text-shadow: var(--photo-shadow);
}
</style>
