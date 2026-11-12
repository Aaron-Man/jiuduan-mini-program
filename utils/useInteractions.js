/**
 * 点赞 & 评论交互 composable
 * 封装 interactions.js 为 Vue composable，管理响应式状态
 * 使用页面：status / journal / menu / gallery
 */
import { ref } from 'vue'
import {
    loadInteractionStats,
    toggleLike as _toggleLike,
    loadComments as _loadComments,
    addComment as _addComment,
    deleteComment as _deleteComment,
    getCurrentUser,
} from './interactions'

/**
 * @param {string} targetType - 目标类型 ('status' | 'journal' | 'dish' | 'photo')
 * @returns {Object} 交互状态与操作函数
 */
export function useInteractions(targetType) {
    const likeCounts = ref({})
    const likedByMe = ref({})
    const commentCounts = ref({})
    const expandedId = ref(null)
    const commentsMap = ref({})
    const commentText = ref('')
    const replyTo = ref('')
    const currentUserId = ref('')

    /** 批量加载点赞状态和评论计数 */
    async function loadInteractions(ids) {
        const u = getCurrentUser()
        currentUserId.value = u.user_id
        if (!ids || ids.length === 0) return
        const stats = await loadInteractionStats(targetType, ids)
        // 合并而不是覆盖：相册「加载更多」时只加载新增的 id
        likeCounts.value = { ...likeCounts.value, ...stats.likeCounts }
        likedByMe.value = { ...likedByMe.value, ...stats.likedByMe }
        commentCounts.value = { ...commentCounts.value, ...stats.commentCounts }
        // 本次加载的 id 中没有点赞/评论的，清掉旧值
        ids.forEach(id => {
            if (!(id in stats.likeCounts)) delete likeCounts.value[id]
            if (!(id in stats.likedByMe)) delete likedByMe.value[id]
            if (!(id in stats.commentCounts)) delete commentCounts.value[id]
        })
    }

    /** 切换点赞，自动更新计数和状态 */
    // 进行中的点赞请求，防止连点导致先查后写的竞态（写入两条 like）
    const _pendingLikes = new Set()
    async function toggleLike(item) {
        const id = item._id || item.id
        if (_pendingLikes.has(id)) return
        _pendingLikes.add(id)
        let liked
        try {
            liked = await _toggleLike(targetType, id)
        } finally {
            _pendingLikes.delete(id)
        }
        if (liked === null) {
            uni.showToast({ title: '操作失败，请重试', icon: 'none' })
            return
        }
        // 状态没变（例如别处已点过）时不改计数
        if (!!likedByMe.value[id] === liked) return
        likedByMe.value[id] = liked
        likeCounts.value[id] = (likeCounts.value[id] || 0) + (liked ? 1 : -1)
        if (likeCounts.value[id] <= 0) delete likeCounts.value[id]
    }

    /** 展开/收起评论区（适用于 status/journal 的内联模式） */
    async function toggleComments(id) {
        if (expandedId.value === id) {
            expandedId.value = null
            replyTo.value = ''
            return
        }
        expandedId.value = id
        replyTo.value = ''
        if (!commentsMap.value[id]) {
            commentsMap.value[id] = await _loadComments(targetType, id)
        }
    }

    /** 添加评论，自动更新评论列表和计数 */
    async function addComment(targetId, text, replyToUser) {
        if (!text || !text.trim()) return
        const result = await _addComment(targetType, targetId, text, replyToUser || null)
        if (result) {
            commentText.value = ''
            replyTo.value = ''
            commentsMap.value[targetId] = await _loadComments(targetType, targetId)
            commentCounts.value[targetId] = commentsMap.value[targetId].length
        }
    }

    /** 删除评论，自动更新评论列表和计数 */
    async function deleteComment(commentId, targetId) {
        const ok = await _deleteComment(commentId)
        if (ok) {
            if (commentsMap.value[targetId]) {
                commentsMap.value[targetId] = commentsMap.value[targetId].filter(c => c._id !== commentId)
            }
            commentCounts.value[targetId] = (commentCounts.value[targetId] || 0) - 1
            if (commentCounts.value[targetId] <= 0) delete commentCounts.value[targetId]
        }
    }

    /** 直接加载某条内容的评论（适用于 gallery/menu 的弹窗模式） */
    async function loadComments(targetId) {
        return await _loadComments(targetType, targetId)
    }

    return {
        // 响应式状态
        likeCounts,
        likedByMe,
        commentCounts,
        expandedId,
        commentsMap,
        commentText,
        replyTo,
        currentUserId,
        // 操作函数
        loadInteractions,
        toggleLike,
        toggleComments,
        addComment,
        deleteComment,
        loadComments,
    }
}
