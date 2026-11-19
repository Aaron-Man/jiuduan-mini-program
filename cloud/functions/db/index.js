const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, mergeResult: false })
const db = cloud.database()

/**
 * 通用数据库代理（仅限已授权成员调用）
 *
 * 安全约束：
 *  1. 调用者必须是 authorized_users 中的成员
 *  2. 只能操作 ALLOWED_COLLECTIONS 中的集合；authorized_users / invite_codes 只能经 auth 云函数操作
 *  3. likes / comments 只有作者本人或管理员可以修改、删除；作者信息由服务端写入，客户端无法伪造
 *  4. 客户端不能写入 _id / _openid / owner_openid 等系统字段
 */

const {
    HIDEABLE_COLLECTIONS,
    hidesFrom,
    ALLOWED_COLLECTIONS,
    AUTHOR_OWNED_COLLECTIONS,
    CASCADE,
    MAX_QUERY_LIMIT,
    MAX_BATCH_UPDATES,
    MAX_FILES_PER_CALL,
    isPlainObject,
    isCloudFile,
    sanitizeData,
    forbidden,
    checkCollection,
    canModifyAuthored,
    chunk,
    filesOfDoc,
    interactionTargetOf,
    staleFilesAfterUpdate,
    touchesFiles,
    maskCapsule,
    EXCERPT_LENGTH,
    truncateFields,
} = require('./rules')

// 成员身份缓存：同一个热实例内短时间复用，减少重复查询
const MEMBER_CACHE_TTL = 30 * 1000
const memberCache = new Map()

async function getMember(openid) {
    if (!openid) return null
    const hit = memberCache.get(openid)
    if (hit && hit.expire > Date.now()) return hit.user
    const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
    const user = (res.data && res.data[0]) || null
    // 只缓存「是成员」的结果，避免新成员注册后短时间内仍被拒绝
    if (user) memberCache.set(openid, { user, expire: Date.now() + MEMBER_CACHE_TTL })
    else memberCache.delete(openid)
    return user
}

/** likes / comments：只有作者本人或管理员可以修改、删除 */
async function checkAuthorPermission(collection, id, member) {
    if (!AUTHOR_OWNED_COLLECTIONS.has(collection)) return null
    if (member.role === 'admin') return null
    let doc
    try {
        doc = (await db.collection(collection).doc(id).get()).data
    } catch (e) {
        return { code: -1, msg: '记录不存在' }
    }
    if (!canModifyAuthored(doc, member)) return forbidden('只能操作自己的记录')
    return null
}

/** 删除云文件（失败只记录日志，不影响主流程） */
async function removeFiles(ids) {
    const list = [...new Set(ids.filter(isCloudFile))]
    for (const batch of chunk(list, MAX_FILES_PER_CALL)) {
        try {
            await cloud.deleteFile({ fileList: batch })
        } catch (e) {
            console.warn('[db] 删除文件失败:', e)
        }
    }
}

/** 记录被删除后：删除其文件和点赞/评论；删除菜谱分类时从菜品中移除该分类 */
async function cascadeRemove(collection, doc) {
    if (collection === 'categories') {
        try {
            await db
                .collection('dishes')
                .where({ category_ids: doc._id })
                .update({ data: { category_ids: db.command.pull(doc._id) } })
        } catch (e) {
            console.warn('[db] 清理菜品分类失败:', e)
        }
        return
    }
    await removeFiles(filesOfDoc(collection, doc))
    const target = interactionTargetOf(collection, doc)
    if (target) {
        for (const col of ['likes', 'comments']) {
            try {
                await db.collection(col).where(target).remove()
            } catch (e) {
                console.warn(`[db] 清理 ${col} 失败:`, e)
            }
        }
    }
}

/** 记录被修改后：删除被替换掉的文件 */
async function cascadeUpdate(collection, before, patch) {
    await removeFiles(staleFilesAfterUpdate(collection, before, patch))
}

/** 集合还没在控制台创建时，数据库会报 DATABASE_COLLECTION_NOT_EXIST（-502005） */
function isMissingCollection(e) {
    const msg = String((e && (e.errMsg || e.message)) || '')
    return !!e && (e.errCode === -502005 || /COLLECTION_NOT_EXIST|collection not exist/i.test(msg))
}

/** 创建集合；已存在时忽略 */
async function ensureCollection(name) {
    try {
        await db.createCollection(name)
    } catch (e) {
        if (!/exist/i.test(String(e.errMsg || e.message || ''))) throw e
    }
}

/** 非管理员只能看到未隐藏的记录：给查询条件加上 hidden != true */
function visibleWhere(collection, member, where) {
    if (!hidesFrom(collection, member)) return where
    return { ...(where || {}), hidden: db.command.neq(true) }
}

/** 非管理员不能修改、删除被隐藏的记录（对他们来说这条记录不存在） */
async function checkHiddenPermission(collection, id, member) {
    if (!hidesFrom(collection, member)) return null
    const doc = await getDoc(collection, id)
    if (doc && doc.hidden === true) return { code: -1, msg: '记录不存在' }
    return null
}

async function getDoc(collection, id) {
    try {
        return (await db.collection(collection).doc(id).get()).data || null
    } catch (e) {
        return null
    }
}

exports.main = async (event, context) => {
    const { OPENID } = cloud.getWXContext()
    const {
        action,
        collection,
        id,
        data,
        where,
        orderBy,
        orderType,
        limit,
        skip,
        fileList,
        targetIds,
        collections,
        withCount,
        truncate,
    } = event

    try {
        const member = await getMember(OPENID)
        if (!member) return { code: 401, msg: '未授权，请先登录' }

        switch (action) {
            case 'update': {
                const err = checkCollection(collection)
                if (err) return err
                if (!id || !isPlainObject(data)) return { code: -1, msg: '缺少参数' }
                const permErr =
                    (await checkAuthorPermission(collection, id, member)) ||
                    (await checkHiddenPermission(collection, id, member))
                if (permErr) return permErr
                // 只有管理员可以改 hidden；其他成员提交的 hidden 字段直接忽略（编辑表单可能把整条记录带回来）
                const patch = sanitizeData(data, member.role === 'admin' && HIDEABLE_COLLECTIONS.has(collection))
                if (AUTHOR_OWNED_COLLECTIONS.has(collection)) {
                    // 作者信息不可修改
                    delete patch.user_id
                    delete patch.user_name
                }
                const before = touchesFiles(collection, patch) ? await getDoc(collection, id) : null
                const res = await db.collection(collection).doc(id).update({ data: patch })
                await cascadeUpdate(collection, before, patch)
                return res
            }

            case 'batchUpdate': {
                // 批量更新（拖拽排序等）：一次调用更新多条记录
                const err = checkCollection(collection)
                if (err) return err
                if (AUTHOR_OWNED_COLLECTIONS.has(collection)) return forbidden('该集合不支持批量更新')
                const { updates } = event
                if (!Array.isArray(updates) || updates.length === 0) return { updated: 0 }
                if (updates.length > MAX_BATCH_UPDATES) return { code: -1, msg: `单次最多更新 ${MAX_BATCH_UPDATES} 条` }
                const valid = updates.filter(u => u && typeof u.id === 'string' && isPlainObject(u.data))
                const patches = valid.map(u => ({ id: u.id, data: sanitizeData(u.data) }))
                // 非管理员的排序列表里没有隐藏的记录，不允许改动它们
                if (hidesFrom(collection, member) && patches.length) {
                    const hiddenRes = await db
                        .collection(collection)
                        .where({ _id: db.command.in(patches.map(p => p.id)), hidden: true })
                        .field({ _id: true })
                        .get()
                    const hiddenIds = new Set((hiddenRes.data || []).map(d => d._id))
                    for (let i = patches.length - 1; i >= 0; i--) if (hiddenIds.has(patches[i].id)) patches.splice(i, 1)
                }
                if (patches.some(p => touchesFiles(collection, p.data)))
                    return { code: -1, msg: '批量更新不支持修改文件字段' }
                let updated = 0
                for (const group of chunk(patches, 20)) {
                    const results = await Promise.all(
                        group.map(p => db.collection(collection).doc(p.id).update({ data: p.data }))
                    )
                    updated += results.reduce((n, r) => n + ((r.stats && r.stats.updated) || 0), 0)
                }
                return { updated }
            }

            case 'interactionStats': {
                // 点赞数、评论数在服务端聚合，并返回当前用户点过赞的记录
                const { targetType } = event
                if (!targetType || !Array.isArray(targetIds) || targetIds.length === 0) {
                    return { likeCounts: {}, commentCounts: {}, likedByMe: {} }
                }
                const cmd = db.command
                const $ = db.command.aggregate
                const likeCounts = {}
                const commentCounts = {}
                const likedByMe = {}
                for (const batch of chunk(targetIds, 100)) {
                    const match = { target_type: targetType, target_id: cmd.in(batch) }
                    const [likesAgg, commentsAgg, mine] = await Promise.all([
                        db
                            .collection('likes')
                            .aggregate()
                            .match(match)
                            .group({ _id: '$target_id', count: $.sum(1) })
                            .limit(1000)
                            .end(),
                        db
                            .collection('comments')
                            .aggregate()
                            .match(match)
                            .group({ _id: '$target_id', count: $.sum(1) })
                            .limit(1000)
                            .end(),
                        db
                            .collection('likes')
                            .where({ ...match, user_id: member._id })
                            .field({ target_id: true })
                            .limit(1000)
                            .get(),
                    ])
                    ;(likesAgg.list || []).forEach(r => {
                        likeCounts[r._id] = r.count
                    })
                    ;(commentsAgg.list || []).forEach(r => {
                        commentCounts[r._id] = r.count
                    })
                    ;(mine.data || []).forEach(r => {
                        likedByMe[r.target_id] = true
                    })
                }
                return { likeCounts, commentCounts, likedByMe }
            }

            case 'add': {
                const err = checkCollection(collection)
                if (err) return err
                if (!isPlainObject(data)) return { code: -1, msg: '缺少参数' }
                const doc = sanitizeData(data)
                // 记录创建者（服务端写入，不信任客户端）
                doc.owner_openid = OPENID
                if (AUTHOR_OWNED_COLLECTIONS.has(collection)) {
                    doc.user_id = member._id
                    doc.user_name = member.nickname || '成员'
                }
                try {
                    return await db.collection(collection).add({ data: doc })
                } catch (e) {
                    // 新功能的集合尚未创建（如 wishes / anniversaries / capsules）：自动创建后重试
                    if (!isMissingCollection(e)) throw e
                    await ensureCollection(collection)
                    return await db.collection(collection).add({ data: doc })
                }
            }

            case 'remove': {
                const err = checkCollection(collection)
                if (err) return err
                if (!id) return { code: -1, msg: '缺少参数' }
                const permErr =
                    (await checkAuthorPermission(collection, id, member)) ||
                    (await checkHiddenPermission(collection, id, member))
                if (permErr) return permErr
                const before = CASCADE[collection] || collection === 'categories' ? await getDoc(collection, id) : null
                const res = await db.collection(collection).doc(id).remove()
                if (before) await cascadeRemove(collection, before)
                return res
            }

            case 'query': {
                const err = checkCollection(collection)
                if (err) return err
                let query = db.collection(collection)
                const cond = visibleWhere(collection, member, isPlainObject(where) ? where : {})
                if (Object.keys(cond).length > 0) {
                    query = query.where(cond)
                }
                const pageSize = Math.min(Math.max(parseInt(limit, 10) || MAX_QUERY_LIMIT, 1), MAX_QUERY_LIMIT)
                const skipCount = Math.max(parseInt(skip, 10) || 0, 0)
                const dataQuery = orderBy ? query.orderBy(orderBy, orderType === 'asc' ? 'asc' : 'desc') : query
                // 时光胶囊在开启日期之前不返回正文；truncate 指定的长文本字段只返回开头一段
                const present = list =>
                    list.map(d => truncateFields(collection === 'capsules' ? maskCapsule(d) : d, truncate))
                try {
                    if (withCount === false) {
                        const dataRes = await dataQuery.skip(skipCount).limit(pageSize).get()
                        return { data: present(dataRes.data) }
                    }
                    const [countRes, dataRes] = await Promise.all([
                        query.count(),
                        dataQuery.skip(skipCount).limit(pageSize).get(),
                    ])
                    return { data: present(dataRes.data), total: countRes.total }
                } catch (e) {
                    // 集合还没创建：当作空列表，第一次新增时会自动创建
                    if (isMissingCollection(e)) return withCount === false ? { data: [] } : { data: [], total: 0 }
                    throw e
                }
            }

            case 'batchCount': {
                // 批量计数：一次返回多个集合的记录数
                if (!Array.isArray(collections) || collections.length === 0) return { data: {} }
                const cmd = db.command
                const result = {}
                await Promise.all(
                    collections
                        .filter(n => ALLOWED_COLLECTIONS.has(n))
                        .map(async name => {
                            try {
                                const res = await db
                                    .collection(name)
                                    .where(visibleWhere(name, member, { _id: cmd.exists(true) }))
                                    .count()
                                result[name] = res.total || 0
                            } catch {
                                result[name] = 0
                            }
                        })
                )
                return { data: result }
            }

            case 'batchQueryMarked': {
                // 批量查询标记为首页显示或置顶的内容
                // memos 集合需同时匹配 showOnHome 和 isPinned
                if (!Array.isArray(collections) || collections.length === 0) return { data: {} }
                const cmd = db.command
                const result = {}
                await Promise.all(
                    collections
                        .filter(n => ALLOWED_COLLECTIONS.has(n))
                        .map(async name => {
                            try {
                                // memos 集合使用 OR 查询：showOnHome=true 或 isPinned=true
                                const marked =
                                    name === 'memos'
                                        ? cmd.or({ showOnHome: cmd.eq(true) }, { isPinned: cmd.eq(true) })
                                        : { showOnHome: cmd.eq(true) }
                                const cond = hidesFrom(name, member)
                                    ? cmd.and([marked, { hidden: cmd.neq(true) }])
                                    : marked
                                const res = await db.collection(name).where(cond).limit(100).get()
                                result[name] = (res.data || []).map(d => truncateFields(d, { content: EXCERPT_LENGTH }))
                            } catch {
                                result[name] = []
                            }
                        })
                )
                return { data: result }
            }

            case 'getTempURLs': {
                // 通过云函数获取云文件临时 URL，绕过云存储权限限制
                if (!Array.isArray(fileList) || fileList.length === 0) return { fileList: [] }
                const ids = fileList.filter(f => typeof f === 'string' && f.startsWith('cloud://'))
                try {
                    let all = []
                    // getTempFileURL 单次最多 50 个文件
                    for (const batch of chunk(ids, MAX_FILES_PER_CALL)) {
                        const res = await cloud.getTempFileURL({ fileList: batch })
                        all = all.concat(res.fileList || [])
                    }
                    return { fileList: all }
                } catch (e) {
                    console.error('[db] getTempURLs error:', e)
                    return { code: -1, msg: e.message || '获取临时URL失败' }
                }
            }

            case 'deleteFile': {
                if (!Array.isArray(fileList) || fileList.length === 0) return { code: -1, msg: '缺少文件列表' }
                const ids = fileList.filter(f => typeof f === 'string' && f.startsWith('cloud://'))
                if (ids.length === 0) return { code: -1, msg: '文件 ID 无效' }
                if (ids.length > MAX_FILES_PER_CALL)
                    return { code: -1, msg: `单次最多删除 ${MAX_FILES_PER_CALL} 个文件` }
                return await cloud.deleteFile({ fileList: ids })
            }

            default:
                return { code: -1, msg: '未知操作' }
        }
    } catch (err) {
        console.error(`[db] action=${action} collection=${collection} error:`, err)
        return { code: -1, msg: err.message || '操作失败' }
    }
}
