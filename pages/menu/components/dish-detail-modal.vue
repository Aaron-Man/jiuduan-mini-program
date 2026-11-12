<template>
    <view class="modal-mask" @tap="emit('close')">
        <view class="detail-box" @tap.stop>
            <view class="sheet-handle"></view>
            <scroll-view scroll-y class="detail-scroll">
                <!-- 大图 -->
                <view class="detail-hero" v-if="dish.displayUrl" @tap="previewImage">
                    <image :src="dish.displayUrl" class="detail-img" mode="aspectFill" />
                    <view class="detail-hero-shade"></view>
                </view>
                <view class="detail-hero detail-hero--empty" v-else>
                    <view class="detail-hero-bubble"><text class="detail-hero-emoji">🍽️</text></view>
                </view>
                <!-- 内容 -->
                <view class="detail-body">
                    <text class="ui-eyebrow detail-eyebrow">TODAY'S DISH</text>
                    <view class="detail-title-row">
                        <text class="detail-name">{{ dish.name }}</text>
                        <view class="detail-avail" :class="dish.available !== false ? 'on' : 'off'">
                            <text>{{ dish.available !== false ? '可点' : '不可点' }}</text>
                        </view>
                    </view>
                    <view class="detail-stars">
                        <view
                            class="level-dot"
                            v-for="n in 5"
                            :key="n"
                            :class="{ on: n <= dish.difficulty }"
                        ></view>
                        <text class="detail-diff">{{ DIFFICULTY_LABELS[dish.difficulty] }}</text>
                    </view>
                    <view class="detail-tags" v-if="dish.category_names && dish.category_names.length">
                        <text class="detail-tag" v-for="cn in dish.category_names" :key="cn">{{ cn }}</text>
                    </view>
                    <view class="detail-section" v-if="dish.description">
                        <text class="detail-sec-label">描述</text>
                        <text class="detail-sec-text">{{ dish.description }}</text>
                    </view>
                    <view class="detail-section" v-if="dish.ingredients">
                        <text class="detail-sec-label">食材</text>
                        <text class="detail-sec-text">{{ dish.ingredients }}</text>
                    </view>
                    <!-- 点单次数 -->
                    <view class="detail-section" v-if="dish.order_count">
                        <text class="detail-sec-label">点单次数</text>
                        <text class="detail-sec-text detail-sec-num">{{ dish.order_count }}<text class="detail-sec-unit"> 次</text></text>
                    </view>
                    <!-- 点赞 -->
                    <view class="detail-section">
                        <view class="interact-bar">
                            <view class="interact-btn ui-press" :class="{ liked: liked }" @tap="emit('toggleLike')">
                                <text>{{ liked ? '❤' : '♡' }}</text>
                                <text v-if="likeCount">{{ likeCount }}</text>
                            </view>
                            <view class="interact-btn ui-press" @tap="toggleComments">
                                <text>💬</text>
                                <text v-if="commentCount">{{ commentCount }}</text>
                            </view>
                        </view>
                    </view>
                    <!-- 评论区 -->
                    <view class="detail-section" v-if="showComments">
                        <view class="comment-item" v-for="c in comments" :key="c._id">
                            <view class="comment-body">
                                <text class="comment-user">{{ c.user_name }}</text>
                                <text class="comment-text" v-if="c.reply_to_user"
                                    >回复 <text class="comment-reply">@{{ c.reply_to_user }}</text
                                    >：{{ c.content }}</text
                                >
                                <text class="comment-text" v-else>{{ c.content }}</text>
                            </view>
                            <text
                                class="comment-del"
                                v-if="c.user_id === currentUserId"
                                @tap="handleDeleteComment(c._id)"
                                >×</text
                            >
                        </view>
                        <view class="comment-input-row">
                            <input
                                class="comment-input"
                                v-model="commentText"
                                placeholder="写评论..."
                                @confirm="handleAddComment"
                            />
                            <view class="comment-send ui-press" @tap="handleAddComment">发送</view>
                        </view>
                    </view>
                </view>
            </scroll-view>
            <view class="detail-btns">
                <view class="detail-btn outline ui-press" @tap="emit('edit')">编辑</view>
                <view class="detail-btn primary ui-press" v-if="dish.available !== false" @tap="emit('order')">点菜</view>
                <view class="detail-btn ui-press" @tap="emit('close')">关闭</view>
            </view>
        </view>
    </view>
</template>

<script setup>
/**
 * 菜品详情弹窗：图片、信息、点赞、评论
 * 点赞状态由页面维护（通过 props 传入，点击时触发 toggleLike）；评论在弹窗内加载，数量变化时触发 commentsChanged
 */
import { ref } from 'vue'
import { DIFFICULTY_LABELS } from '../../../utils/constants'
import { loadComments, addComment, deleteComment } from '../../../utils/interactions'

const props = defineProps({
    dish: { type: Object, required: true },
    liked: { type: Boolean, default: false },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    currentUserId: { type: String, default: '' },
})
const emit = defineEmits(['close', 'edit', 'order', 'toggleLike', 'commentsChanged'])

const showComments = ref(false)
const comments = ref([])
const commentText = ref('')

const reloadComments = async () => {
    comments.value = await loadComments('dish', props.dish._id)
    emit('commentsChanged', comments.value.length)
}

const toggleComments = async () => {
    if (showComments.value) {
        showComments.value = false
        return
    }
    showComments.value = true
    await reloadComments()
}

const handleAddComment = async () => {
    if (!commentText.value.trim()) return
    const res = await addComment('dish', props.dish._id, commentText.value, null)
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

const previewImage = () => {
    const url = props.dish.displayUrl
    if (url) uni.previewImage({ urls: [url], current: url })
}
</script>

<style scoped>
@keyframes mask-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
@keyframes sheet-up {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(30, 26, 23, 0.35);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: mask-in 0.25s ease both;
}
.detail-box {
    position: relative;
    width: 100%;
    max-height: 88vh;
    background: var(--card-solid);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -24rpx 60rpx -24rpx rgba(30, 26, 23, 0.3);
    animation: sheet-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sheet-handle {
    position: absolute;
    top: 16rpx;
    left: 50%;
    width: 72rpx;
    height: 8rpx;
    margin-left: -36rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.85);
    box-shadow: 0 2rpx 8rpx rgba(30, 26, 23, 0.15);
    z-index: 3;
}
.detail-scroll {
    flex: 1;
    overflow: hidden;
}
.detail-hero {
    width: 100%;
    height: 560rpx;
    position: relative;
}
.detail-img {
    width: 100%;
    height: 100%;
    display: block;
}
.detail-hero-shade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 160rpx;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 100%);
}
.detail-hero--empty {
    height: 320rpx;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
}
.detail-hero-bubble {
    width: 168rpx;
    height: 168rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
}
.detail-hero-emoji {
    font-size: 80rpx;
}
.detail-body {
    padding: 8rpx 44rpx 40rpx;
}
.detail-eyebrow {
    display: block;
    margin-bottom: 8rpx;
}
.detail-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;
}
.detail-name {
    font-family: var(--font-serif);
    font-size: 52rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.2;
    flex: 1;
}
.detail-avail {
    padding: 8rpx 22rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
    font-weight: 600;
    flex-shrink: 0;
    margin-left: 16rpx;
    letter-spacing: 0.08em;
}
.detail-avail.on {
    background: var(--sage);
    color: var(--ink);
}
.detail-avail.off {
    background: var(--bg-2);
    color: var(--muted);
}
.detail-stars {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-bottom: 24rpx;
}
.level-dot {
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background: var(--line);
}
.level-dot.on {
    background: var(--coral);
}
.detail-diff {
    font-size: 22rpx;
    color: var(--muted);
    margin-left: 10rpx;
    letter-spacing: 0.12em;
}
.detail-tags {
    display: flex;
    gap: 12rpx;
    flex-wrap: wrap;
    margin-bottom: 8rpx;
}
.detail-tag {
    padding: 8rpx 24rpx;
    background: rgba(244, 199, 180, 0.4);
    border-radius: 999rpx;
    font-size: 22rpx;
    color: var(--ink-2);
    letter-spacing: 0.06em;
}
.detail-section {
    margin-top: 32rpx;
    padding-top: 32rpx;
    border-top: 1rpx solid var(--line);
}
.detail-sec-label {
    font-size: 20rpx;
    font-weight: 600;
    color: var(--muted);
    display: block;
    margin-bottom: 14rpx;
    letter-spacing: 0.32em;
}
.detail-sec-text {
    font-size: 28rpx;
    color: var(--ink-2);
    line-height: 1.8;
    display: block;
}
.detail-sec-num {
    font-family: var(--font-serif);
    font-size: 56rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.1;
}
.detail-sec-unit {
    font-family: var(--font-sans);
    font-size: 24rpx;
    font-weight: 400;
    color: var(--muted);
}
.detail-btns {
    display: flex;
    gap: 16rpx;
    padding: 24rpx 40rpx calc(24rpx + env(safe-area-inset-bottom));
    border-top: 1rpx solid var(--line);
    background: var(--card-solid);
}
.detail-btn {
    flex: 1;
    height: 88rpx;
    line-height: 88rpx;
    border-radius: 999rpx;
    text-align: center;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.1em;
    background: var(--bg);
    color: var(--ink-2);
}
.detail-btn.outline {
    background: rgba(255, 255, 255, 0.7);
    color: var(--ink);
    border: 1rpx solid var(--line);
    box-sizing: border-box;
}
.detail-btn.primary {
    flex: 1.4;
    background: var(--ink);
    color: #fff;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.detail-section .interact-bar {
    display: flex;
    gap: 16rpx;
}
.detail-section .interact-btn {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: 26rpx;
    color: var(--ink-2);
    padding: 12rpx 28rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
}
.detail-section .interact-btn.liked {
    color: var(--coral);
    background: rgba(224, 122, 95, 0.1);
    border-color: rgba(224, 122, 95, 0.2);
}
.detail-section .comment-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16rpx 0;
}
.detail-section .comment-item + .comment-item {
    border-top: 1rpx solid var(--line);
}
.detail-section .comment-body {
    flex: 1;
    min-width: 0;
}
.detail-section .comment-user {
    font-size: 24rpx;
    color: var(--ink);
    font-weight: 600;
    margin-right: 12rpx;
}
.detail-section .comment-text {
    font-size: 26rpx;
    color: var(--ink-2);
    line-height: 1.6;
}
.detail-section .comment-reply {
    font-size: 24rpx;
    color: var(--muted);
}
.detail-section .comment-del {
    font-size: 30rpx;
    color: var(--faint);
    padding: 0 8rpx;
    flex-shrink: 0;
}
.detail-section .comment-input-row {
    display: flex;
    gap: 12rpx;
    margin-top: 16rpx;
    align-items: center;
}
.detail-section .comment-input {
    flex: 1;
    height: 72rpx;
    background: var(--bg);
    border-radius: 999rpx;
    padding: 0 28rpx;
    font-size: 26rpx;
    color: var(--ink);
    border: none;
}
.detail-section .comment-send {
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
</style>
