<template>
    <page-bg tone="lilac" />
    <scroll-view scroll-y class="page">
        <view class="head ui-fade-up">
            <text class="ui-eyebrow">Time capsule</text>
            <text class="ui-title">时光胶囊</text>
            <text class="ui-sub">写一封信给未来，到了那天才能打开</text>
        </view>

        <view class="stats ui-fade-up ui-d1">
            <view class="stat">
                <text class="stat-num ui-serif">{{ sealed.length }}</text>
                <text class="stat-label">封存中</text>
            </view>
            <view class="stat-sep"></view>
            <view class="stat">
                <text class="stat-num ui-serif">{{ opened.length }}</text>
                <text class="stat-label">已开启</text>
            </view>
            <view class="stat-sep"></view>
            <view class="stat">
                <text class="stat-num ui-serif">{{ nextOpenDays === null ? '—' : nextOpenDays }}</text>
                <text class="stat-label">天后开启下一封</text>
            </view>
        </view>

        <view class="section" v-if="opened.length">
            <text class="ui-eyebrow section-label">Ready to open</text>
            <view
                v-for="(c, idx) in opened"
                :key="c._id"
                class="letter letter--open ui-fade-up ui-press"
                :class="'ui-d' + Math.min(idx + 2, 6)"
                @tap="openLetter(c)"
                @longpress="removeCapsule(c)"
            >
                <view class="letter-flap"></view>
                <view class="letter-body">
                    <text class="letter-to">To {{ c.to_name || '我们' }}</text>
                    <text class="letter-title ui-serif">{{ c.title }}</text>
                    <text class="letter-meta">From {{ c.from_name || '家人' }} · 写于 {{ formatDay(c.createTime) }}</text>
                </view>
                <view class="seal seal--open"><text>✉️</text></view>
            </view>
        </view>

        <view class="section" v-if="sealed.length">
            <text class="ui-eyebrow section-label">Sealed</text>
            <view
                v-for="(c, idx) in sealed"
                :key="c._id"
                class="letter letter--sealed ui-fade-up"
                :class="['ui-d' + Math.min(idx + 2, 6), { shake: shakeId === c._id }]"
                @tap="tapSealed(c)"
                @longpress="removeCapsule(c)"
            >
                <view class="letter-flap"></view>
                <view class="letter-body">
                    <text class="letter-to">To {{ c.to_name || '我们' }}</text>
                    <text class="letter-title ui-serif">{{ c.title }}</text>
                    <text class="letter-meta">{{ formatDay(c.open_date) }} 开启 · 还有 {{ daysLeft(c.open_date) }} 天</text>
                </view>
                <view class="seal"><text>🔒</text></view>
            </view>
        </view>

        <view v-if="!loading && capsules.length === 0" class="empty ui-fade-up">
            <view class="empty-bubble"><text>💌</text></view>
            <text class="empty-title ui-serif">写给一年后的你们</text>
            <text class="empty-hint">封存一段此刻的心情，等到约定的日子再一起打开</text>
            <view class="ui-btn empty-btn" @tap="openForm">写第一封信</view>
        </view>

        <view class="bottom-space"></view>
    </scroll-view>

    <view class="ui-fab ui-press" @tap="openForm"><text>✎</text></view>

    <!-- 读信 -->
    <view class="reader-mask" v-if="reading" @tap="reading = null">
        <view class="paper" @tap.stop>
            <text class="paper-date">{{ formatDay(reading.createTime) }}</text>
            <text class="paper-to ui-serif">亲爱的 {{ reading.to_name || '我们' }}：</text>
            <text class="paper-title ui-serif">{{ reading.title }}</text>
            <text class="paper-content">{{ reading.content }}</text>
            <text class="paper-from ui-serif">—— {{ reading.from_name || '家人' }}</text>
            <view class="ui-btn ui-btn--ghost paper-close" @tap="reading = null">收好这封信</view>
        </view>
    </view>

    <!-- 写信 -->
    <view class="mask" v-if="showForm" @tap="showForm = false">
        <view class="sheet" @tap.stop>
            <view class="sheet-handle"></view>
            <text class="sheet-title ui-serif">写给未来</text>
            <input class="field" v-model="form.to_name" placeholder="写给谁？例如：一年后的我们" maxlength="12" />
            <input class="field" v-model="form.title" placeholder="信的标题" maxlength="20" />
            <textarea class="field field--area" v-model="form.content" placeholder="想对未来说的话……" :maxlength="LONG_TEXT_MAX" />
            <text class="char-count" :class="{ 'char-count--full': form.content.length >= LONG_TEXT_MAX }"
                >{{ form.content.length }} / {{ LONG_TEXT_MAX }}</text
            >
            <text class="label">什么时候打开</text>
            <view class="quick">
                <view
                    v-for="q in quickPicks"
                    :key="q.label"
                    class="ui-chip"
                    :class="{ active: form.open_date === q.date }"
                    @tap="form.open_date = q.date"
                    >{{ q.label }}</view
                >
            </view>
            <picker mode="date" :value="form.open_date" :start="tomorrow" @change="form.open_date = $event.detail.value">
                <view class="field field--pick">
                    <text :class="{ placeholder: !form.open_date }">{{ form.open_date || '或者选择一个日子' }}</text>
                    <text class="field-arrow">›</text>
                </view>
            </picker>
            <view class="ui-btn sheet-btn" :class="{ disabled: !canSubmit || submitting }" @tap="submit">
                {{ submitting ? '封存中…' : '封存这封信' }}
            </view>
        </view>
    </view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed, onMounted } from 'vue'
import { fetchAllRecords, getRecord, dbAdd, clearPCache, requestSubscribeFor, sendNotificationToAll } from '../../utils/cloud'
import { LONG_TEXT_MAX } from '../../utils/constants'
import { confirmDelete, handleLoadError } from '../../utils/contentActions'
import { dateToStr } from '../../utils/usePeriodData'
import { parseDate, diffDays } from '../../utils/anniversary'

const capsules = ref([])
const loading = ref(true)
const reading = ref(null)
const showForm = ref(false)
const submitting = ref(false)
const shakeId = ref('')
const form = ref({ to_name: '', title: '', content: '', open_date: '' })

const today = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}
const tomorrow = dateToStr(new Date(Date.now() + 86400000))
const daysLeft = date => Math.max(diffDays(today(), parseDate(date)), 0)
const formatDay = t => {
    if (!t) return ''
    const d = typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) ? parseDate(t) : new Date(t)
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

const after = (months, years = 0) => {
    const d = today()
    d.setFullYear(d.getFullYear() + years, d.getMonth() + months)
    return dateToStr(d)
}
const quickPicks = [
    { label: '一个月后', date: after(1) },
    { label: '半年后', date: after(6) },
    { label: '一年后', date: after(0, 1) },
    { label: '三年后', date: after(0, 3) },
]

// 服务端会给未到日期的信件加上 locked 并隐藏正文
const opened = computed(() =>
    capsules.value.filter(c => !c.locked).sort((a, b) => (a.open_date < b.open_date ? 1 : -1))
)
const sealed = computed(() => capsules.value.filter(c => c.locked).sort((a, b) => (a.open_date > b.open_date ? 1 : -1)))
const nextOpenDays = computed(() => (sealed.value.length ? daysLeft(sealed.value[0].open_date) : null))
const canSubmit = computed(() => form.value.title.trim() && form.value.content.trim() && form.value.open_date)

const fetchData = async () => {
    try {
        // 列表不需要正文，打开信件时再加载全文（一封信可能有上万字）
        capsules.value = await fetchAllRecords('capsules', { orderBy: 'open_date', orderType: 'asc', truncate: { content: 0 } })
    } catch (e) {
        handleLoadError(e, capsules.value.length > 0)
    } finally {
        loading.value = false
    }
}
onMounted(fetchData)

const openLetter = async c => {
    // 注意：hideLoading 会同时关闭 toast，所以要先关 loading 再提示
    uni.showLoading({ title: '拆信中' })
    let full = null
    try {
        full = await getRecord('capsules', c._id)
    } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: '加载失败，请重试', icon: 'none' })
        return
    }
    uni.hideLoading()
    if (!full || full.locked) {
        uni.showToast({ title: '这封信还不能打开', icon: 'none' })
        return
    }
    reading.value = full
    uni.vibrateShort({ type: 'light' })
}

const tapSealed = c => {
    shakeId.value = c._id
    uni.vibrateShort({ type: 'heavy' })
    uni.showToast({ title: `还要再等 ${daysLeft(c.open_date)} 天哦`, icon: 'none' })
    setTimeout(() => {
        if (shakeId.value === c._id) shakeId.value = ''
    }, 500)
}

const removeCapsule = c =>
    confirmDelete({ content: `删除「${c.title}」这封信？删除后无法恢复`, collection: 'capsules', id: c._id, onDone: fetchData })

const openForm = () => {
    const me = uni.getStorageSync('auth_user')
    form.value = { to_name: '', title: '', content: '', open_date: quickPicks[2].date, from_name: me?.nickname || '' }
    showForm.value = true
}

const submit = async () => {
    if (!canSubmit.value || submitting.value) return
    if (form.value.open_date <= dateToStr(today())) {
        uni.showToast({ title: '开启日期要在明天之后', icon: 'none' })
        return
    }
    requestSubscribeFor('content')
    submitting.value = true
    const data = {
        to_name: form.value.to_name.trim(),
        title: form.value.title.trim(),
        content: form.value.content.trim(),
        open_date: form.value.open_date,
        from_name: form.value.from_name,
        createTime: new Date(),
    }
    try {
        await dbAdd('capsules', data)
        showForm.value = false
        clearPCache('capsules')
        uni.vibrateShort({ type: 'medium' })
        uni.showToast({ title: '已封存 💌', icon: 'none' })
        const u = uni.getStorageSync('auth_user')
        sendNotificationToAll(
            'content_update',
            u?._id,
            { title: '新的时光胶囊', contentType: '时光胶囊', summary: `${formatDay(data.open_date)} 开启` },
            '/pages/capsule/capsule'
        )
        fetchData()
    } catch (e) {
        uni.showToast({ title: '封存失败', icon: 'none' })
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
.stats {
    display: flex;
    align-items: center;
    margin: 0 32rpx 12rpx;
    padding: 28rpx 12rpx;
    border-radius: var(--r-l);
    background: var(--card);
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
}
.stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
}
.stat-num {
    font-size: 52rpx;
    font-weight: 700;
    line-height: 1.1;
}
.stat-label {
    font-size: 20rpx;
    color: var(--muted);
}
.stat-sep {
    width: 1rpx;
    height: 56rpx;
    background: var(--line);
}
.section {
    padding: 28rpx 32rpx 0;
    display: flex;
    flex-direction: column;
    gap: 24rpx;
}
.section-label {
    padding-left: 8rpx;
}

/* 信封 */
.letter {
    position: relative;
    min-height: 220rpx;
    border-radius: var(--r-l);
    overflow: hidden;
    padding: 40rpx 40rpx 36rpx;
    box-shadow: var(--shadow);
}
.letter--open {
    background: linear-gradient(160deg, #fffaf3 0%, #fbeee4 100%);
}
.letter--sealed {
    background: linear-gradient(160deg, #ece6f8 0%, #dcd3f1 100%);
}
.letter-flap {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 120rpx;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 100%);
    -webkit-clip-path: polygon(0 0, 100% 0, 50% 100%);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.letter-body {
    position: relative;
    padding-right: 120rpx;
}
.letter-to {
    display: block;
    font-size: 22rpx;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--muted);
}
.letter-title {
    display: block;
    margin: 12rpx 0 10rpx;
    font-size: 40rpx;
    font-weight: 700;
    color: var(--ink);
}
.letter-meta {
    display: block;
    font-size: 22rpx;
    color: var(--ink-2);
}
.seal {
    position: absolute;
    right: 40rpx;
    top: 50%;
    width: 96rpx;
    height: 96rpx;
    margin-top: -48rpx;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #a8869d 0%, #6b4e71 70%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    box-shadow: 0 10rpx 24rpx -8rpx rgba(107, 78, 113, 0.7);
}
.seal--open {
    background: radial-gradient(circle at 35% 30%, #f6b9a4 0%, #e07a5f 70%);
    box-shadow: 0 10rpx 24rpx -8rpx rgba(224, 122, 95, 0.7);
    animation: float 3s ease-in-out infinite;
}
@keyframes float {
    0%,
    100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-8rpx);
    }
}
.shake {
    animation: shake 0.45s;
}
@keyframes shake {
    0%,
    100% {
        transform: translateX(0);
    }
    20%,
    60% {
        transform: translateX(-12rpx);
    }
    40%,
    80% {
        transform: translateX(12rpx);
    }
}

/* 读信 */
.reader-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 300;
    background: rgba(30, 26, 23, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48rpx;
    box-sizing: border-box;
}
.paper {
    width: 100%;
    max-height: 82vh;
    overflow-y: auto;
    box-sizing: border-box;
    padding: 64rpx 56rpx 48rpx;
    border-radius: 12rpx;
    background-color: #fffaf2;
    box-shadow: 0 40rpx 80rpx -30rpx rgba(0, 0, 0, 0.5);
    animation: unfold 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    transform-origin: top center;
}
@keyframes unfold {
    from {
        opacity: 0;
        transform: perspective(800px) rotateX(-40deg) translateY(-40rpx);
    }
    to {
        opacity: 1;
        transform: perspective(800px) rotateX(0) translateY(0);
    }
}
.paper-date {
    display: block;
    text-align: right;
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.16em;
}
.paper-to {
    display: block;
    margin-top: 24rpx;
    font-size: 32rpx;
    color: var(--ink);
}
.paper-title {
    display: block;
    margin: 16rpx 0 24rpx;
    font-size: 44rpx;
    font-weight: 700;
    color: var(--ink);
}
.paper-content {
    display: block;
    font-size: 30rpx;
    line-height: 64rpx;
    /* 信纸横线：与行高相同的周期，画在每一行底部 */
    background-image: repeating-linear-gradient(
        180deg,
        transparent 0,
        transparent 63rpx,
        rgba(180, 150, 120, 0.22) 63rpx,
        rgba(180, 150, 120, 0.22) 64rpx
    );
    color: var(--ink-2);
    white-space: pre-wrap;
}
.paper-from {
    display: block;
    text-align: right;
    margin-top: 40rpx;
    font-size: 30rpx;
    color: var(--ink);
}
.paper-close {
    margin-top: 48rpx;
}

/* 空状态 */
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
    background: linear-gradient(135deg, #ebe4f9 0%, #f8d3d8 100%);
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
.empty-btn {
    margin-top: 24rpx;
}
.bottom-space {
    height: 220rpx;
}

/* 写信弹层 */
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
    max-height: 90vh;
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
    height: 480rpx;
    padding: 24rpx 28rpx;
    line-height: 1.7;
}
.char-count {
    display: block;
    text-align: right;
    margin: -8rpx 8rpx 20rpx;
    font-size: 22rpx;
    color: var(--muted);
}
.char-count--full {
    color: var(--coral);
}
.field--pick {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.placeholder {
    color: var(--faint);
}
.field-arrow {
    font-size: 40rpx;
    color: var(--faint);
}
.label {
    display: block;
    font-size: 22rpx;
    letter-spacing: 0.2em;
    color: var(--muted);
    margin: 8rpx 0 16rpx;
}
.quick {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-bottom: 20rpx;
}
.sheet-btn {
    margin-top: 28rpx;
}
</style>
