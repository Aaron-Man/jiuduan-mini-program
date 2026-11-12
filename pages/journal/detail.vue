<template>
    <page-bg tone="lilac" />
    <scroll-view scroll-y class="page-scroll" :class="{ 'page-scroll--transparent': bgImage }">
        <view v-if="journal" class="detail-wrap">
            <!-- 顶部 -->
            <view class="detail-hero ui-fade-up">
                <view class="detail-eyebrow">
                    <text class="ui-eyebrow">JOURNAL</text>
                    <view class="eyebrow-dot" v-if="dateEyebrow"></view>
                    <text class="ui-eyebrow" v-if="dateEyebrow">{{ dateEyebrow }}</text>
                </view>
                <text class="detail-title">{{ journal.title }}</text>
                <view class="detail-byline">
                    <view class="detail-mood" v-if="journal.mood">
                        <text>{{ moodEmoji }}</text>
                        <text class="detail-mood-label">{{ journal.mood }}</text>
                    </view>
                    <text class="detail-date">{{ formatTime(journal.createTime) }}</text>
                    <text class="detail-sep">·</text>
                    <text class="detail-date">约 {{ readMinutes }} 分钟读完</text>
                </view>
                <view class="detail-rule"></view>
            </view>

            <!-- 正文 -->
            <view class="detail-body ui-fade-up ui-d2">
                <text class="detail-text">{{ journal.content }}</text>
            </view>

            <!-- 底部信息 -->
            <view class="detail-end ui-fade-up ui-d3">
                <view class="end-line"></view>
                <text class="end-mark">FIN</text>
                <view class="end-line"></view>
            </view>
            <view class="detail-footer" v-if="journal.updateTime">
                <text class="detail-update">最后编辑 {{ formatTime(journal.updateTime) }}</text>
            </view>
        </view>

        <view v-else class="empty-area ui-fade-up">
            <view class="empty-bubble">
                <text class="empty-emoji">📖</text>
            </view>
            <text class="empty-text">{{
                loadState === 'loading'
                    ? '加载中...'
                    : loadState === 'missing'
                      ? '这篇日志不存在或已被删除'
                      : '加载失败，请返回重试'
            }}</text>
        </view>

        <view class="bottom-space"></view>
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, formatRelativeTime, getPCache, setPCache, useSharedBg } from '../../utils/cloud'
import { MOOD_OPTIONS } from '../../utils/constants'

const journal = ref(null)
// loading | ok | missing | error
const loadState = ref('loading')
const { bgImage } = useSharedBg()

onLoad(async options => {
    const id = options?.id
    if (!id) {
        loadState.value = 'missing'
        return
    }
    // 缓存优先：先尝试从 PCache 快速恢复
    const cached = getPCache('journal_' + id)
    if (cached) {
        journal.value = cached
        loadState.value = 'ok'
    }
    // 后台从云函数加载最新数据
    try {
        const res = await callFunction('db', {
            action: 'query',
            collection: 'journals',
            where: { _id: id },
            limit: 1,
            withCount: false,
        })
        if (!Array.isArray(res?.data)) throw new Error(res?.msg || '查询失败')
        if (res.data.length > 0) {
            journal.value = res.data[0]
            setPCache('journal_' + id, res.data[0])
            loadState.value = 'ok'
        } else {
            journal.value = null
            loadState.value = 'missing'
        }
    } catch (e) {
        console.error('[日志详情] 加载失败:', e)
        if (!journal.value) loadState.value = 'error'
    }
})

const formatTime = t => formatRelativeTime(t)

// 以下仅用于页面展示
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const dateEyebrow = computed(() => {
    const t = journal.value?.createTime
    const d = t ? new Date(t) : null
    if (!d || isNaN(d.getTime())) return ''
    return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} · ${d.getFullYear()}`
})
const moodEmoji = computed(() => MOOD_OPTIONS.find(m => m.label === journal.value?.mood)?.emoji || '✨')
const readMinutes = computed(() => Math.max(1, Math.ceil((journal.value?.content || '').length / 400)))
</script>

<style scoped>
.page-scroll {
    height: 100vh;
    background: transparent;
}
.page-scroll--transparent {
    background: transparent;
}

.detail-wrap {
    padding: 0 44rpx;
}

/* 标题区 */
.detail-hero {
    padding: 72rpx 0 8rpx;
}
.detail-eyebrow {
    display: flex;
    align-items: center;
    gap: 16rpx;
}
.eyebrow-dot {
    width: 8rpx;
    height: 8rpx;
    border-radius: 50%;
    background: var(--plum);
    opacity: 0.6;
}
.detail-title {
    display: block;
    margin-top: 28rpx;
    font-family: var(--font-serif);
    font-size: 68rpx;
    font-weight: 700;
    line-height: 1.22;
    letter-spacing: 0.01em;
    color: var(--ink);
    word-break: break-all;
}
.detail-byline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14rpx;
    margin-top: 32rpx;
}
.detail-mood {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 8rpx 20rpx;
    border-radius: 999rpx;
    background: rgba(212, 200, 240, 0.55);
    font-size: 24rpx;
}
.detail-mood-label {
    font-size: 22rpx;
    color: var(--ink-2);
    letter-spacing: 0.1em;
}
.detail-date {
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.08em;
}
.detail-sep {
    font-size: 22rpx;
    color: var(--faint);
}
.detail-rule {
    width: 88rpx;
    height: 4rpx;
    margin-top: 48rpx;
    border-radius: 4rpx;
    background: var(--ink);
}

/* 正文 */
.detail-body {
    margin-top: 48rpx;
    padding: 56rpx 48rpx;
    background: rgba(255, 255, 255, 0.62);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.detail-text {
    font-size: 31rpx;
    color: var(--ink-2);
    line-height: 2.1;
    letter-spacing: 0.04em;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: justify;
}

/* 文末 */
.detail-end {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24rpx;
    margin-top: 64rpx;
}
.end-line {
    width: 72rpx;
    height: 1rpx;
    background: var(--faint);
}
.end-mark {
    font-family: var(--font-serif);
    font-size: 22rpx;
    font-style: italic;
    letter-spacing: 0.4em;
    color: var(--muted);
}
.detail-footer {
    padding: 20rpx 0 0;
    text-align: center;
}
.detail-update {
    font-size: 20rpx;
    color: var(--muted);
    letter-spacing: 0.1em;
}

/* 空状态 */
.empty-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 220rpx 48rpx 0;
}
.empty-bubble {
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #ece6fa 0%, #d4c8f0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-soft);
    margin-bottom: 40rpx;
}
.empty-emoji {
    font-size: 88rpx;
}
.empty-text {
    font-family: var(--font-serif);
    font-size: 34rpx;
    font-weight: 700;
    color: var(--ink);
    text-align: center;
    letter-spacing: 0.04em;
}

.bottom-space {
    height: calc(120rpx + env(safe-area-inset-bottom));
}
</style>
