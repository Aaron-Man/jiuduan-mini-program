<template>
    <view class="photo-sheet-mask" @tap="emit('close')">
        <view class="photo-sheet" @tap.stop>
            <view class="sheet-grabber"></view>
            <view class="sheet-hero">
                <image v-if="photo.displayUrl" :src="photo.displayUrl" class="sheet-img" mode="aspectFit" />
            </view>
            <view class="sheet-interact">
                <view class="sheet-meta" v-if="photo.caption || photo.categoryName">
                    <text class="sheet-caption" v-if="photo.caption">{{ photo.caption }}</text>
                    <text class="sheet-cat" v-if="photo.categoryName">{{ photo.categoryName }}</text>
                </view>
                <view class="interact-bar">
                    <view class="interact-btn ui-press" :class="{ liked: liked }" @tap="emit('toggleLike')">
                        <text>{{ liked ? '❤' : '♡' }}</text>
                        <text v-if="likeCount">{{ likeCount }}</text>
                    </view>
                    <view class="interact-btn ui-press" @tap="previewImage">
                        <text>🔍</text>
                        <text>查看大图</text>
                    </view>
                </view>
                <view class="sheet-comments">
                    <text class="ui-eyebrow comments-eyebrow">COMMENTS · {{ comments.length }}</text>
                    <view class="comment-item" v-for="c in comments" :key="c._id">
                        <view class="comment-avatar">
                            <text>{{ (c.user_name || '·').slice(0, 1) }}</text>
                        </view>
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
                        <view class="comment-send ui-press" @tap="handleAddComment">发送</view>
                    </view>
                </view>
            </view>
            <view class="sheet-close ui-press" @tap="emit('close')">
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
    background: rgba(30, 26, 23, 0.35);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-end;
}
.photo-sheet {
    width: 100%;
    max-height: 88vh;
    background: var(--card-solid);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    box-shadow: 0 -24rpx 60rpx -24rpx rgba(80, 56, 36, 0.25);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: env(safe-area-inset-bottom);
    animation: sheet-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes sheet-up {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}
.sheet-grabber {
    width: 72rpx;
    height: 8rpx;
    border-radius: 8rpx;
    background: var(--faint);
    align-self: center;
    margin: 18rpx 0 22rpx;
    flex-shrink: 0;
}
.sheet-hero {
    margin: 0 32rpx;
    height: 600rpx;
    border-radius: var(--r-l);
    overflow: hidden;
    background: var(--bg-2);
    flex-shrink: 0;
    box-shadow: var(--shadow-soft);
}
.sheet-img {
    width: 100%;
    height: 100%;
    display: block;
}
.sheet-interact {
    flex: 1;
    overflow-y: auto;
    padding: 28rpx 36rpx 16rpx;
    -webkit-overflow-scrolling: touch;
}
.sheet-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 14rpx;
    margin-bottom: 20rpx;
}
.sheet-caption {
    font-family: var(--font-serif);
    font-size: 34rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
}
.sheet-cat {
    height: 48rpx;
    line-height: 48rpx;
    padding: 0 20rpx;
    border-radius: 999rpx;
    background: var(--rose);
    font-size: 22rpx;
    color: var(--ink-2);
}
.sheet-interact .interact-bar {
    display: flex;
    gap: 16rpx;
    margin-bottom: 28rpx;
    padding-bottom: 28rpx;
    border-bottom: 1rpx solid var(--line);
}
.sheet-interact .interact-btn {
    display: flex;
    align-items: center;
    gap: 10rpx;
    height: 68rpx;
    padding: 0 28rpx;
    font-size: 26rpx;
    color: var(--ink-2);
    border-radius: 999rpx;
    background: var(--bg);
    border: 1rpx solid var(--line);
}
.sheet-interact .interact-btn.liked {
    color: var(--coral);
    background: rgba(224, 122, 95, 0.12);
    border-color: transparent;
}
.comments-eyebrow {
    display: block;
    margin-bottom: 12rpx;
}
.sheet-comments .comment-item {
    display: flex;
    align-items: flex-start;
    gap: 18rpx;
    padding: 16rpx 0;
}
.sheet-comments .comment-avatar {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 600;
    color: var(--ink-2);
    flex-shrink: 0;
}
.sheet-comments .comment-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.sheet-comments .comment-user {
    font-size: 22rpx;
    color: var(--muted);
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-bottom: 2rpx;
}
.sheet-comments .comment-text {
    font-size: 26rpx;
    color: var(--ink);
    line-height: 1.6;
}
.sheet-comments .comment-reply {
    font-size: 24rpx;
    color: var(--plum);
}
.sheet-comments .comment-del {
    font-size: 30rpx;
    color: var(--faint);
    padding: 0 8rpx;
    flex-shrink: 0;
}
.sheet-comments .comment-input-row {
    display: flex;
    gap: 12rpx;
    margin-top: 20rpx;
    align-items: center;
    padding: 8rpx 8rpx 8rpx 28rpx;
    background: var(--bg);
    border: 1rpx solid var(--line);
    border-radius: 999rpx;
}
.sheet-comments .comment-input {
    flex: 1;
    height: 64rpx;
    background: transparent;
    padding: 0;
    font-size: 26rpx;
    color: var(--ink);
    border: none;
}
.sheet-comments .comment-send {
    height: 64rpx;
    line-height: 64rpx;
    padding: 0 30rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    font-size: 24rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    flex-shrink: 0;
}
.sheet-close {
    margin: 8rpx 32rpx 24rpx;
    height: 88rpx;
    line-height: 88rpx;
    text-align: center;
    font-size: 28rpx;
    font-weight: 500;
    color: var(--ink);
    letter-spacing: 0.08em;
    border-radius: 999rpx;
    background: var(--bg);
    border: 1rpx solid var(--line);
    flex-shrink: 0;
}
</style>
