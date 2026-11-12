<template>
    <view class="photo-sheet-mask" @tap="emit('close')">
        <view class="photo-sheet" @tap.stop>
            <view class="sheet-hero">
                <image v-if="photo.displayUrl" :src="photo.displayUrl" class="sheet-img" mode="aspectFit" />
            </view>
            <view class="sheet-interact">
                <view class="interact-bar">
                    <view class="interact-btn" :class="{ liked: liked }" @tap="emit('toggleLike')">
                        <text>{{ liked ? '❤' : '♡' }}</text>
                        <text v-if="likeCount">{{ likeCount }}</text>
                    </view>
                    <view class="interact-btn" @tap="previewImage">
                        <text>🔍</text>
                        <text>查看大图</text>
                    </view>
                </view>
                <view class="sheet-comments">
                    <view class="comment-item" v-for="c in comments" :key="c._id">
                        <view class="comment-body">
                            <text class="comment-user">{{ c.user_name }}</text>
                            <text class="comment-text" v-if="c.reply_to_user"
                                >回复 <text class="comment-reply">@{{ c.reply_to_user }}</text
                                >：{{ c.content }}</text
                            >
                            <text class="comment-text" v-else>{{ c.content }}</text>
                        </view>
                        <text class="comment-del" v-if="c.user_id === currentUserId" @tap="handleDeleteComment(c._id)"
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
            <view class="sheet-close" @tap="emit('close')">
                <text>关闭</text>
            </view>
        </view>
    </view>
</template>

<script setup>
/**
 * 照片详情：大图、点赞、评论
 * 点赞状态由页面维护（props 传入，点击时触发 toggleLike）；评论在弹窗内加载
 */
import { ref, onMounted } from 'vue'
import { loadComments, addComment, deleteComment } from '../../../utils/interactions'

const props = defineProps({
    photo: { type: Object, required: true },
    liked: { type: Boolean, default: false },
    likeCount: { type: Number, default: 0 },
    currentUserId: { type: String, default: '' },
})
const emit = defineEmits(['close', 'toggleLike'])

const comments = ref([])
const commentText = ref('')

// 相册的点赞/评论以照片的自定义 id 关联
const reloadComments = async () => {
    comments.value = await loadComments('photo', props.photo.id)
}
onMounted(reloadComments)

const handleAddComment = async () => {
    if (!commentText.value.trim()) return
    const res = await addComment('photo', props.photo.id, commentText.value, null)
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
    comments.value = comments.value.filter(c => c._id !== commentId)
}

const previewImage = () => {
    const url = props.photo.displayUrl
    if (url) uni.previewImage({ urls: [url], current: url, fail: () => {} })
}
</script>

<style scoped>
.photo-sheet-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
}
.photo-sheet {
    width: 100%;
    max-height: 85vh;
    background: #fff;
    border-radius: 32rpx 32rpx 0 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.sheet-hero {
    width: 100%;
    height: 480rpx;
    background: #f2f2f7;
    flex-shrink: 0;
}
.sheet-img {
    width: 100%;
    height: 100%;
}
.sheet-interact {
    flex: 1;
    overflow-y: auto;
    padding: 24rpx 28rpx;
    -webkit-overflow-scrolling: touch;
}
.sheet-interact .interact-bar {
    display: flex;
    gap: 20rpx;
    margin-bottom: 20rpx;
    padding-bottom: 16rpx;
    border-bottom: 1rpx solid rgba(142, 142, 147, 0.08);
}
.sheet-interact .interact-btn {
    display: flex;
    align-items: center;
    gap: 6rpx;
    font-size: 26rpx;
    color: #8e8e93;
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    background: #f2f2f7;
}
.sheet-interact .interact-btn.liked {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.08);
}
.sheet-comments {
}
.sheet-comments .comment-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12rpx 0;
}
.sheet-comments .comment-item + .comment-item {
    border-top: 1rpx solid rgba(142, 142, 147, 0.06);
}
.sheet-comments .comment-body {
    flex: 1;
    min-width: 0;
}
.sheet-comments .comment-user {
    font-size: 24rpx;
    color: #3a3a3c;
    font-weight: 500;
    margin-right: 8rpx;
}
.sheet-comments .comment-text {
    font-size: 26rpx;
    color: #4a4a4a;
    line-height: 1.6;
}
.sheet-comments .comment-reply {
    font-size: 22rpx;
    color: #8e8e93;
}
.sheet-comments .comment-del {
    font-size: 28rpx;
    color: #c7c7cc;
    padding: 0 8rpx;
    flex-shrink: 0;
}
.sheet-comments .comment-input-row {
    display: flex;
    gap: 12rpx;
    margin-top: 16rpx;
    align-items: center;
}
.sheet-comments .comment-input {
    flex: 1;
    height: 64rpx;
    background: #f2f2f7;
    border-radius: 32rpx;
    padding: 0 24rpx;
    font-size: 26rpx;
    color: #1c1c1e;
    border: none;
}
.sheet-comments .comment-send {
    padding: 12rpx 28rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 32rpx;
    font-size: 24rpx;
    flex-shrink: 0;
}
.sheet-close {
    padding: 24rpx;
    text-align: center;
    font-size: 28rpx;
    color: #8e8e93;
    border-top: 1rpx solid rgba(142, 142, 147, 0.08);
}
</style>
