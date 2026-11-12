<template>
    <page-bg />
    <scroll-view scroll-y class="page-scroll" :class="{ 'page-scroll--transparent': bgImage }">
        <view v-if="journal" class="detail-wrap">
            <!-- 顶部 -->
            <view class="detail-hero">
                <text class="detail-mood" v-if="journal.mood">{{ journal.mood }}</text>
                <text class="detail-title">{{ journal.title }}</text>
                <text class="detail-date">{{ formatTime(journal.createTime) }}</text>
            </view>

            <!-- 正文 -->
            <view class="detail-body">
                <text class="detail-text">{{ journal.content }}</text>
            </view>

            <!-- 底部信息 -->
            <view class="detail-footer" v-if="journal.updateTime">
                <text class="detail-update">最后编辑 {{ formatTime(journal.updateTime) }}</text>
            </view>
        </view>

        <view v-else class="empty-area">
            <text class="empty-emoji">📖</text>
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
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, formatRelativeTime, getPCache, setPCache, useSharedBg } from '../../utils/cloud'

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
</script>

<style scoped>
.page-scroll {
    height: 100vh;
    background: #f5f0eb;
}
.page-scroll--transparent {
    background: transparent;
}

.detail-wrap {
    padding: 0 32rpx;
}

.detail-hero {
    padding: 48rpx 0 32rpx;
}
.detail-mood {
    font-size: 56rpx;
    display: block;
    margin-bottom: 16rpx;
}
.detail-title {
    font-size: 44rpx;
    font-weight: 700;
    color: #1c1c1e;
    display: block;
    line-height: 1.4;
    letter-spacing: 1rpx;
}
.detail-date {
    font-size: 24rpx;
    color: #c7c7cc;
    display: block;
    margin-top: 12rpx;
    letter-spacing: 1rpx;
}

.detail-body {
    background: #fff;
    border-radius: 24rpx;
    padding: 36rpx 32rpx;
    box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.03);
    border: 1rpx solid rgba(142, 142, 147, 0.06);
}
.detail-text {
    font-size: 30rpx;
    color: #4a4a4a;
    line-height: 2;
    white-space: pre-wrap;
    letter-spacing: 0.5rpx;
}

.detail-footer {
    padding: 24rpx 8rpx;
}
.detail-update {
    font-size: 22rpx;
    color: #c7c7cc;
    letter-spacing: 1rpx;
}

.empty-area {
    text-align: center;
    padding: 200rpx 0;
}
.empty-emoji {
    font-size: 72rpx;
    display: block;
}
.empty-text {
    font-size: 28rpx;
    color: #8e8e93;
    display: block;
    margin-top: 16rpx;
}

.bottom-space {
    height: 80rpx;
}
</style>
