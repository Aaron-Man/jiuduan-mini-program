<template>
    <page-bg tone="mint" />
    <scroll-view scroll-y class="page">
        <view class="head ui-fade-up">
            <text class="ui-eyebrow">Our bucket list</text>
            <text class="ui-title">心愿清单</text>
            <text class="ui-sub">想和家人一起做的事，一件一件实现</text>
        </view>

        <!-- 进度 -->
        <view class="progress ui-card ui-fade-up ui-d1">
            <view class="progress-top">
                <view>
                    <text class="progress-num ui-serif">{{ doneCount }}</text>
                    <text class="progress-total"> / {{ wishes.length }}</text>
                </view>
                <text class="progress-pct ui-serif">{{ percent }}%</text>
            </view>
            <view class="bar"><view class="bar-fill" :style="{ width: percent + '%' }"></view></view>
            <text class="progress-hint">{{ progressHint }}</text>
        </view>

        <!-- 分类 -->
        <scroll-view scroll-x class="chips ui-fade-up ui-d2" :show-scrollbar="false">
            <view class="ui-chip chip" :class="{ active: !category }" @tap="category = ''">全部</view>
            <view
                v-for="c in WISH_CATEGORIES"
                :key="c.key"
                class="ui-chip chip"
                :class="{ active: category === c.key }"
                @tap="category = c.key"
                >{{ c.emoji }} {{ c.label }}</view
            >
        </scroll-view>

        <view class="tabs ui-fade-up ui-d2">
            <view class="tab" :class="{ active: tab === 'todo' }" @tap="tab = 'todo'">想做 · {{ todoList.length }}</view>
            <view class="tab" :class="{ active: tab === 'done' }" @tap="tab = 'done'">已实现 · {{ doneList.length }}</view>
        </view>

        <view class="list">
            <view
                v-for="(w, idx) in shownList"
                :key="w._id"
                class="wish ui-card ui-fade-up"
                :class="['ui-d' + Math.min(idx + 1, 6), { 'wish--done': w.done }]"
                @tap="openActions(w)"
            >
                <view class="wish-icon" :style="{ background: themeOf(catOf(w.category).color).grad }">
                    <text>{{ catOf(w.category).emoji }}</text>
                </view>
                <view class="wish-body">
                    <text class="wish-title">{{ w.title }}</text>
                    <text class="wish-note" v-if="w.note">{{ w.note }}</text>
                    <text class="wish-meta" v-if="w.done">✓ 实现于 {{ formatDay(w.doneTime) }}</text>
                    <text class="wish-meta" v-else>{{ catOf(w.category).label }} · 许愿于 {{ formatDay(w.createTime) }}</text>
                </view>
                <view class="check ui-press" :class="{ on: w.done }" @tap.stop="toggleDone(w)">
                    <text v-if="w.done">✓</text>
                </view>
                <!-- 完成时的小烟花 -->
                <view class="burst" v-if="burstId === w._id">
                    <text v-for="n in 8" :key="n" class="burst-item" :class="'burst-' + n">{{ ['✦', '❤', '✿', '★'][n % 4] }}</text>
                </view>
            </view>
        </view>

        <view v-if="!loading && shownList.length === 0" class="empty ui-fade-up">
            <view class="empty-bubble"><text>{{ tab === 'done' ? '🏆' : '🌠' }}</text></view>
            <text class="empty-title ui-serif">{{ tab === 'done' ? '第一个心愿，就快实现了' : '许下一个心愿吧' }}</text>
            <text class="empty-hint">{{ tab === 'done' ? '完成的心愿会收藏在这里' : '去看一次极光、学会一道菜、拍一组全家福' }}</text>
        </view>

        <view class="bottom-space"></view>
    </scroll-view>

    <view class="ui-fab ui-press" @tap="openForm()"><text>＋</text></view>

    <view class="mask" v-if="showForm" @tap="showForm = false">
        <view class="sheet" @tap.stop>
            <view class="sheet-handle"></view>
            <text class="sheet-title ui-serif">{{ form._id ? '编辑心愿' : '许个心愿' }}</text>
            <input class="field" v-model="form.title" placeholder="我想……" maxlength="30" />
            <textarea class="field field--area" v-model="form.note" placeholder="补充一点细节（可选）" maxlength="100" />
            <text class="label">分类</text>
            <view class="cat-grid">
                <view
                    v-for="c in WISH_CATEGORIES"
                    :key="c.key"
                    class="cat-cell"
                    :class="{ active: form.category === c.key }"
                    :style="form.category === c.key ? { background: themeOf(c.color).grad } : {}"
                    @tap="form.category = c.key"
                >
                    <text class="cat-emoji">{{ c.emoji }}</text>
                    <text class="cat-label">{{ c.label }}</text>
                </view>
            </view>
            <view class="ui-btn sheet-btn" :class="{ disabled: !form.title.trim() || submitting }" @tap="submit">
                {{ submitting ? '保存中…' : '保存' }}
            </view>
        </view>
    </view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed, onMounted } from 'vue'
import { fetchAllRecords, dbAdd, dbUpdate, getPCache, setPCache, clearPCache, requestSubscribeFor, sendNotificationToAll } from '../../utils/cloud'
import { WISH_CATEGORIES, themeOf } from '../../utils/constants'
import { confirmDelete, handleLoadError } from '../../utils/contentActions'

const wishes = ref([])
const loading = ref(true)
const category = ref('')
const tab = ref('todo')
const showForm = ref(false)
const submitting = ref(false)
const burstId = ref('')
const emptyForm = () => ({ _id: '', title: '', note: '', category: 'travel' })
const form = ref(emptyForm())

const catOf = key => WISH_CATEGORIES.find(c => c.key === key) || WISH_CATEGORIES[WISH_CATEGORIES.length - 1]
const inCategory = computed(() => wishes.value.filter(w => !category.value || w.category === category.value))
const todoList = computed(() => inCategory.value.filter(w => !w.done))
const doneList = computed(() =>
    inCategory.value.filter(w => w.done).sort((a, b) => new Date(b.doneTime || 0) - new Date(a.doneTime || 0))
)
const shownList = computed(() => (tab.value === 'done' ? doneList.value : todoList.value))
const doneCount = computed(() => wishes.value.filter(w => w.done).length)
const percent = computed(() => (wishes.value.length ? Math.round((doneCount.value / wishes.value.length) * 100) : 0))
const progressHint = computed(() => {
    if (!wishes.value.length) return '从第一个心愿开始'
    if (percent.value === 100) return '全部实现！该许新的愿望啦 🎉'
    if (percent.value >= 50) return '已经过半，继续冲 ✨'
    return `还有 ${wishes.value.length - doneCount.value} 个心愿在等你们`
})

const formatDay = t => {
    if (!t) return ''
    const d = new Date(t)
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

const fetchData = async () => {
    try {
        wishes.value = await fetchAllRecords('wishes', { orderBy: 'createTime', orderType: 'desc' })
        setPCache('wishes', wishes.value)
    } catch (e) {
        handleLoadError(e, wishes.value.length > 0)
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    const cached = getPCache('wishes')
    if (cached) {
        wishes.value = cached
        loading.value = false
    }
    fetchData()
})

const toggleDone = async w => {
    const done = !w.done
    const patch = { done, doneTime: done ? new Date().toISOString() : null }
    Object.assign(w, patch)
    if (done) {
        burstId.value = w._id
        uni.vibrateShort({ type: 'medium' })
        setTimeout(() => {
            if (burstId.value === w._id) burstId.value = ''
        }, 900)
    }
    clearPCache('wishes')
    try {
        await dbUpdate('wishes', w._id, patch)
        if (done) {
            const u = uni.getStorageSync('auth_user')
            sendNotificationToAll('content_update', u?._id, { title: '心愿实现啦', contentType: '心愿清单', summary: w.title }, '/pages/wish/wish')
        }
    } catch (e) {
        Object.assign(w, { done: !done, doneTime: null })
        uni.showToast({ title: '操作失败', icon: 'none' })
    }
}

const openForm = w => {
    form.value = w ? { _id: w._id, title: w.title, note: w.note || '', category: w.category || 'other' } : emptyForm()
    showForm.value = true
}

const openActions = w => {
    uni.showActionSheet({
        itemList: ['编辑', w.done ? '标为未实现' : '标为已实现', '删除'],
        success: ({ tapIndex }) => {
            if (tapIndex === 0) openForm(w)
            else if (tapIndex === 1) toggleDone(w)
            else
                confirmDelete({
                    content: `删除心愿「${w.title}」？`,
                    collection: 'wishes',
                    id: w._id,
                    cacheKeys: 'wishes',
                    onDone: fetchData,
                })
        },
    })
}

const submit = async () => {
    if (!form.value.title.trim() || submitting.value) return
    const isNew = !form.value._id
    // 订阅必须在用户点击手势中同步调用
    if (isNew) requestSubscribeFor('content')
    submitting.value = true
    const data = { title: form.value.title.trim(), note: form.value.note.trim(), category: form.value.category }
    try {
        if (isNew) await dbAdd('wishes', { ...data, done: false, createTime: new Date() })
        else await dbUpdate('wishes', form.value._id, { ...data, updateTime: new Date() })
        showForm.value = false
        tab.value = 'todo'
        clearPCache('wishes')
        uni.showToast({ title: isNew ? '心愿已许下' : '已保存', icon: 'success' })
        fetchData()
    } catch (e) {
        uni.showToast({ title: '保存失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
.page {
    height: 100vh;
    background: transparent;
}
.head {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    padding: 40rpx 40rpx 28rpx;
}
.progress {
    margin: 0 32rpx 28rpx;
    padding: 36rpx 36rpx 32rpx;
}
.progress-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
}
.progress-num {
    font-size: 88rpx;
    font-weight: 700;
    line-height: 1;
}
.progress-total {
    font-size: 30rpx;
    color: var(--muted);
}
.progress-pct {
    font-size: 44rpx;
    color: var(--ink-2);
    font-style: italic;
}
.bar {
    height: 20rpx;
    border-radius: 999rpx;
    background: rgba(30, 26, 23, 0.06);
    margin: 24rpx 0 16rpx;
    overflow: hidden;
}
.bar-fill {
    height: 100%;
    border-radius: 999rpx;
    background: linear-gradient(90deg, #c9dfcf 0%, #9cc8b0 50%, #c7dbf2 100%);
    transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.progress-hint {
    font-size: 24rpx;
    color: var(--muted);
}
.chips {
    white-space: nowrap;
    padding: 0 32rpx;
    box-sizing: border-box;
}
.chip {
    margin-right: 16rpx;
}
.tabs {
    display: flex;
    gap: 40rpx;
    padding: 32rpx 40rpx 20rpx;
}
.tab {
    font-size: 28rpx;
    color: var(--muted);
    padding-bottom: 10rpx;
    border-bottom: 4rpx solid transparent;
}
.tab.active {
    color: var(--ink);
    font-weight: 700;
    border-bottom-color: var(--ink);
}
.list {
    padding: 0 32rpx;
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}
.wish {
    position: relative;
    display: flex;
    align-items: center;
    gap: 24rpx;
    padding: 28rpx;
}
.wish--done {
    opacity: 0.78;
}
.wish--done .wish-title {
    text-decoration: line-through;
    text-decoration-color: rgba(30, 26, 23, 0.3);
}
.wish-icon {
    width: 88rpx;
    height: 88rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    flex-shrink: 0;
}
.wish-body {
    flex: 1;
    min-width: 0;
}
.wish-title {
    display: block;
    font-size: 30rpx;
    font-weight: 600;
    color: var(--ink);
}
.wish-note {
    display: block;
    font-size: 24rpx;
    color: var(--ink-2);
    margin-top: 4rpx;
}
.wish-meta {
    display: block;
    font-size: 22rpx;
    color: var(--muted);
    margin-top: 8rpx;
}
.check {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    border: 3rpx solid var(--faint);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 28rpx;
    font-weight: 700;
    flex-shrink: 0;
}
.check.on {
    background: var(--ink);
    border-color: var(--ink);
    animation: pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pop {
    0% {
        transform: scale(0.6);
    }
    100% {
        transform: scale(1);
    }
}
.burst {
    position: absolute;
    right: 56rpx;
    top: 50%;
    pointer-events: none;
}
.burst-item {
    position: absolute;
    font-size: 26rpx;
    color: var(--coral);
    animation: burst 0.85s ease-out forwards;
}
.burst-1 { --dx: 0rpx; --dy: -90rpx; }
.burst-2 { --dx: 64rpx; --dy: -64rpx; color: #9cc8b0; }
.burst-3 { --dx: 90rpx; --dy: 0rpx; }
.burst-4 { --dx: 64rpx; --dy: 64rpx; color: #b9a7e6; }
.burst-5 { --dx: 0rpx; --dy: 90rpx; }
.burst-6 { --dx: -64rpx; --dy: 64rpx; color: #f0b85a; }
.burst-7 { --dx: -90rpx; --dy: 0rpx; }
.burst-8 { --dx: -64rpx; --dy: -64rpx; color: #9cc8b0; }
@keyframes burst {
    from {
        opacity: 1;
        transform: translate(0, 0) scale(0.4);
    }
    to {
        opacity: 0;
        transform: translate(var(--dx), var(--dy)) scale(1.2);
    }
}
.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60rpx 48rpx;
    gap: 16rpx;
}
.empty-bubble {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    background: var(--grad-mint);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 68rpx;
    box-shadow: var(--shadow-soft);
}
.empty-title {
    font-size: 38rpx;
    font-weight: 700;
    margin-top: 12rpx;
}
.empty-hint {
    font-size: 24rpx;
    color: var(--muted);
    text-align: center;
}
.bottom-space {
    height: 220rpx;
}
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
    margin-bottom: 28rpx;
}
.field {
    height: 96rpx;
    padding: 0 28rpx;
    border-radius: var(--r-m);
    background: var(--bg);
    font-size: 28rpx;
    color: var(--ink);
    margin-bottom: 20rpx;
    width: 100%;
    box-sizing: border-box;
}
.field--area {
    height: 160rpx;
    padding: 24rpx 28rpx;
}
.label {
    display: block;
    font-size: 22rpx;
    letter-spacing: 0.2em;
    color: var(--muted);
    margin: 8rpx 0 16rpx;
}
.cat-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
}
.cat-cell {
    width: calc((100% - 32rpx) / 3);
    padding: 20rpx 0;
    border-radius: var(--r-m);
    background: var(--bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6rpx;
    border: 3rpx solid transparent;
}
.cat-cell.active {
    border-color: var(--ink);
}
.cat-emoji {
    font-size: 40rpx;
}
.cat-label {
    font-size: 22rpx;
    color: var(--ink-2);
}
.sheet-btn {
    margin-top: 36rpx;
}
</style>
