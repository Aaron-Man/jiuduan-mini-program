/**
 * 点赞 & 评论共享逻辑
 * 集合：likes / comments
 * 字段：target_type ('status'|'journal'|'photo'|'dish'), target_id, user_id, user_name, createTime
 *
 * 注意：所有读写都通过 db 云函数执行，绕过客户端数据库权限限制
 */
import { callFunction, dbAdd, dbDelete } from './cloud'

/** 通过 db 云函数查询集合记录 */
async function queryRecords(collection, { where = {}, orderBy = 'createTime', orderType = 'desc' } = {}) {
    const res = await callFunction('db', {
        action: 'query',
        collection,
        where,
        orderBy,
        orderType,
        limit: 100,
    })
    return res?.data || []
}

/**
 * 获取当前用户信息（用于点赞/评论记录）
 */
export function getCurrentUser() {
    const user = uni.getStorageSync('auth_user')
    if (!user) return { user_id: '', user_name: '匿名' }
    return { user_id: user._id || '', user_name: user.nickname || '匿名' }
}

/**
 * 批量加载点赞数、评论数和「我是否点过赞」（在服务端聚合计数）
 * @returns {Promise<{ likeCounts: Object<string, number>, likedByMe: Object<string, boolean>, commentCounts: Object<string, number> }>}
 */
export async function loadInteractionStats(targetType, targetIds) {
    const empty = { likeCounts: {}, likedByMe: {}, commentCounts: {} }
    if (!targetIds || targetIds.length === 0) return empty
    try {
        const res = await callFunction('db', { action: 'interactionStats', targetType, targetIds })
        if (!res || res.code) throw new Error(res?.msg || '加载互动数据失败')
        return {
            likeCounts: res.likeCounts || {},
            likedByMe: res.likedByMe || {},
            commentCounts: res.commentCounts || {},
        }
    } catch (e) {
        console.warn('[interactions] loadInteractionStats failed:', e)
        return empty
    }
}

/**
 * 切换点赞状态
 * @returns {Promise<boolean|null>} 点赞后是否为已赞状态；失败时返回 null（调用方不应改动计数）
 */
export async function toggleLike(targetType, targetId) {
    const { user_id, user_name } = getCurrentUser()
    if (!user_id) return null

    try {
        const existing = await queryRecords('likes', {
            where: { target_type: targetType, target_id: targetId, user_id },
        })
        if (existing.length > 0) {
            await dbDelete('likes', existing[0]._id)
            return false
        } else {
            await dbAdd('likes', {
                target_type: targetType,
                target_id: targetId,
                user_id,
                user_name,
                createTime: new Date(),
            })
            return true
        }
    } catch (e) {
        console.warn('[interactions] toggleLike failed:', e)
        return null
    }
}

/**
 * 批量加载评论计数
 * @returns {Object<string, number>} 每个 targetId 对应的评论数
 */
export async function loadCommentCounts(targetType, targetIds) {
    if (!targetIds || targetIds.length === 0) return {}
    try {
        const res = await callFunction('db', {
            action: 'batchLikeQuery',
            collection: 'comments',
            targetIds,
            where: { target_type: targetType },
        })
        const allComments = res?.data || []
        const counts = {}
        targetIds.forEach(id => {
            counts[id] = allComments.filter(c => c.target_id === id).length
        })
        return counts
    } catch (e) {
        console.warn('[interactions] loadCommentCounts failed:', e)
        return {}
    }
}

/**
 * 加载某条内容的所有评论
 */
export async function loadComments(targetType, targetId) {
    try {
        return await queryRecords('comments', {
            where: { target_type: targetType, target_id: targetId },
            orderBy: 'createTime',
            orderType: 'asc',
        })
    } catch (e) {
        console.warn('[interactions] loadComments failed:', e)
        return []
    }
}

/**
 * 添加评论
 */
export async function addComment(targetType, targetId, content, replyToUser = null) {
    const { user_id, user_name } = getCurrentUser()
    if (!user_id || !content.trim()) return null
    try {
        return await dbAdd('comments', {
            target_type: targetType,
            target_id: targetId,
            user_id,
            user_name,
            content: content.trim(),
            reply_to_user: replyToUser,
            createTime: new Date(),
        })
    } catch (e) {
        console.warn('[interactions] addComment failed:', e)
        return null
    }
}

/**
 * 删除评论（仅作者可删；db 云函数在服务端再次校验作者，这里的检查只用于界面提示）
 */
export async function deleteComment(commentId) {
    const { user_id } = getCurrentUser()
    try {
        // 验证是否为评论作者（通过云函数查询）
        const res = await queryRecords('comments', { where: { _id: commentId } })
        if (res.length > 0 && res[0].user_id === user_id) {
            await dbDelete('comments', commentId)
            return true
        }
        return false
    } catch (e) {
        console.warn('[interactions] deleteComment failed:', e)
        return false
    }
}
