<template>
    <view class="modal-mask" @tap="emit('close')">
        <view class="detail-box" @tap.stop>
            <scroll-view scroll-y class="detail-scroll">
                <!-- 大图 -->
                <view class="detail-hero" v-if="dish.displayUrl" @tap="previewImage">
                    <image :src="dish.displayUrl" class="detail-img" mode="aspectFill" />
                </view>
                <view class="detail-hero detail-hero--empty" v-else>
                    <text class="detail-hero-emoji">🍽️</text>
                </view>
                <!-- 内容 -->
                <view class="detail-body">
                    <view class="detail-title-row">
                        <text class="detail-name">{{ dish.name }}</text>
                        <view class="detail-avail" :class="dish.available !== false ? 'on' : 'off'">
                            <text>{{ dish.available !== false ? '可点' : '不可点' }}</text>
                        </view>
                    </view>
                    <text class="detail-stars"
                        >{{ '★'.repeat(dish.difficulty) }}{{ '☆'.repeat(5 - dish.difficulty) }}
                        <text class="detail-diff">{{ DIFFICULTY_LABELS[dish.difficulty] }}</text></text
                    >
                    <view class="detail-tags" v-if="dish.category_names && dish.category_names.length">
                        <text class="detail-tag" v-for="cn in dish.category_names" :key="cn">{{ cn }}</text>
                    </view>
                    <view class="detail-section" v-if="dish.description">
                        <text class="detail-sec-label">📝 描述</text>
                        <text class="detail-sec-text">{{ dish.description }}</text>
                    </view>
                    <view class="detail-section" v-if="dish.ingredients">
                        <text class="detail-sec-label">🥬 食材</text>
                        <text class="detail-sec-text">{{ dish.ingredients }}</text>
                    </view>
                    <!-- 点单次数 -->
                    <view class="detail-section" v-if="dish.order_count">
                        <text class="detail-sec-label">📋 点单次数</text>
                        <text class="detail-sec-text">{{ dish.order_count }} 次</text>
                    </view>
                    <!-- 点赞 -->
                    <view class="detail-section">
                        <view class="interact-bar">
                            <view class="interact-btn" :class="{ liked: liked }" @tap="emit('toggleLike')">
                                <text>{{ liked ? '❤' : '♡' }}</text>
                                <text v-if="likeCount">{{ likeCount }}</text>
                            </view>
                            <view class="interact-btn" @tap="toggleComments">
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
                            <view class="comment-send" @tap="handleAddComment">发送</view>
                        </view>
                    </view>
                </view>
            </scroll-view>
            <view class="detail-btns">
                <view class="detail-btn outline" @tap="emit('edit')">编辑</view>
                <view class="detail-btn primary" v-if="dish.available !== false" @tap="emit('order')">点菜</view>
                <view class="detail-btn" @tap="emit('close')">关闭</view>
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
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48rpx;
}
.detail-box {
    width: 100%;
    max-height: 85vh;
    background: #fff;
    border-radius: 32rpx;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.detail-scroll {
    flex: 1;
    overflow: hidden;
}
.detail-hero {
    width: 100%;
    height: 400rpx;
    position: relative;
}
.detail-img {
    width: 100%;
    height: 100%;
}
.detail-hero--empty {
    background: #f2f2f7;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 240rpx;
}
.detail-hero-emoji {
    font-size: 80rpx;
    opacity: 0.4;
}
.detail-body {
    padding: 32rpx;
}
.detail-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8rpx;
}
.detail-name {
    font-size: 40rpx;
    font-weight: 700;
    color: #1c1c1e;
    letter-spacing: 1rpx;
    flex: 1;
}
.detail-avail {
    padding: 6rpx 18rpx;
    border-radius: 16rpx;
    font-size: 20rpx;
    font-weight: 500;
    flex-shrink: 0;
    margin-left: 16rpx;
}
.detail-avail.on {
    background: rgba(168, 197, 160, 0.2);
    color: #5a7a52;
}
.detail-avail.off {
    background: rgba(142, 142, 147, 0.1);
    color: #636366;
}
.detail-stars {
    font-size: 26rpx;
    color: #d4a574;
    display: block;
    margin-bottom: 16rpx;
}
.detail-diff {
    font-size: 22rpx;
    color: #636366;
}
.detail-tags {
    display: flex;
    gap: 10rpx;
    flex-wrap: wrap;
    margin-bottom: 20rpx;
}
.detail-tag {
    padding: 8rpx 20rpx;
    background: rgba(142, 142, 147, 0.08);
    border-radius: 20rpx;
    font-size: 22rpx;
    color: #3a3a3c;
}
.detail-section {
    margin-top: 24rpx;
    padding-top: 24rpx;
    border-top: 1rpx solid rgba(142, 142, 147, 0.08);
}
.detail-sec-label {
    font-size: 24rpx;
    color: #636366;
    display: block;
    margin-bottom: 12rpx;
    letter-spacing: 1rpx;
}
.detail-sec-text {
    font-size: 28rpx;
    color: #1c1c1e;
    line-height: 1.8;
    display: block;
}
.detail-btns {
    display: flex;
    gap: 16rpx;
    padding: 24rpx 32rpx;
    border-top: 1rpx solid rgba(142, 142, 147, 0.08);
    background: #fff;
}
.detail-btn {
    flex: 1;
    padding: 22rpx 0;
    border-radius: 24rpx;
    text-align: center;
    font-size: 28rpx;
    letter-spacing: 2rpx;
    background: #f2f2f7;
    color: #3a3a3c;
}
.detail-btn.outline {
    background: #fff;
    color: #1c1c1e;
    border: 1rpx solid rgba(142, 142, 147, 0.2);
}
.detail-btn.primary {
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
}
.detail-section .interact-bar {
    display: flex;
    gap: 20rpx;
}
.detail-section .interact-btn {
    display: flex;
    align-items: center;
    gap: 6rpx;
    font-size: 26rpx;
    color: #636366;
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    background: #f2f2f7;
}
.detail-section .interact-btn.liked {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.08);
}
.detail-section .comment-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 10rpx 0;
}
.detail-section .comment-item + .comment-item {
    border-top: 1rpx solid rgba(142, 142, 147, 0.06);
}
.detail-section .comment-body {
    flex: 1;
    min-width: 0;
}
.detail-section .comment-user {
    font-size: 22rpx;
    color: #3a3a3c;
    font-weight: 500;
    margin-right: 8rpx;
}
.detail-section .comment-text {
    font-size: 24rpx;
    color: #4a4a4a;
    line-height: 1.6;
}
.detail-section .comment-reply {
    font-size: 22rpx;
    color: #636366;
}
.detail-section .comment-del {
    font-size: 28rpx;
    color: #8e8e93;
    padding: 0 8rpx;
    flex-shrink: 0;
}
.detail-section .comment-input-row {
    display: flex;
    gap: 12rpx;
    margin-top: 12rpx;
    align-items: center;
}
.detail-section .comment-input {
    flex: 1;
    height: 60rpx;
    background: #f2f2f7;
    border-radius: 30rpx;
    padding: 0 24rpx;
    font-size: 24rpx;
    color: #1c1c1e;
    border: none;
}
.detail-section .comment-send {
    padding: 10rpx 24rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 30rpx;
    font-size: 22rpx;
    flex-shrink: 0;
}
</style>
