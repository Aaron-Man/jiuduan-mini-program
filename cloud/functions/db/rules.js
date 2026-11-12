/**
 * db 云函数的纯逻辑规则（不依赖 wx-server-sdk，便于单元测试）
 */

// 允许通过本云函数访问的集合
const ALLOWED_COLLECTIONS = new Set([
    'profiles',
    'categories',
    'dishes',
    'statuses',
    'journals',
    'travels',
    'memos',
    'gallery_photos',
    'gallery_categories',
    'periods',
    'likes',
    'comments',
])

// 归属于具体作者的集合：只有作者本人或管理员可修改、删除
const AUTHOR_OWNED_COLLECTIONS = new Set(['likes', 'comments'])

// 客户端不能写入的系统字段
const PROTECTED_FIELDS = ['_id', '_openid', 'owner_openid']

/**
 * 级联清理配置：删除或修改记录时，同步清理关联的云存储文件和点赞/评论
 *  files        记录中保存单个云文件 ID 的字段（删除记录时删除文件；替换为新文件时删除被替换的文件）
 *  arrayFiles   保存云文件 ID 数组的字段（修改时删除被移出数组的文件）
 *  targetType   likes / comments 中对应的 target_type
 *  targetIdField likes / comments 的 target_id 对应记录的哪个字段（默认 _id）
 */
const CASCADE = {
    statuses: { files: ['imageUrl'], targetType: 'status' },
    journals: { targetType: 'journal' },
    dishes: { files: ['image_url'], targetType: 'dish' },
    gallery_photos: { files: ['fileID'], targetType: 'photo', targetIdField: 'id' },
    travels: { files: ['cover_image'] },
    profiles: { files: ['bg_image'], arrayFiles: ['bg_images'] },
}

const MAX_QUERY_LIMIT = 100
const MAX_BATCH_UPDATES = 100
const MAX_FILES_PER_CALL = 50

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const isCloudFile = v => typeof v === 'string' && v.startsWith('cloud://')

/** 去掉客户端不允许写入的系统字段 */
function sanitizeData(data) {
    const clean = { ...data }
    PROTECTED_FIELDS.forEach(k => {
        delete clean[k]
    })
    return clean
}

function forbidden(msg = '无权限') {
    return { code: 403, msg }
}

/** 校验集合名，返回错误对象；通过时返回 null */
function checkCollection(collection) {
    if (!collection || typeof collection !== 'string') return { code: -1, msg: '缺少集合名' }
    if (!ALLOWED_COLLECTIONS.has(collection)) return forbidden(`不允许访问集合 ${collection}`)
    return null
}

/** likes / comments 记录是否允许当前成员修改或删除（作者本人或管理员） */
function canModifyAuthored(doc, member) {
    if (member.role === 'admin') return true
    return !!doc && doc.user_id === member._id
}

function chunk(list, size) {
    const out = []
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
    return out
}

/** 删除记录时需要一并删除的云文件 */
function filesOfDoc(collection, doc) {
    const cfg = CASCADE[collection]
    if (!cfg || !doc) return []
    const files = []
    ;(cfg.files || []).forEach(f => files.push(doc[f]))
    ;(cfg.arrayFiles || []).forEach(f => {
        if (Array.isArray(doc[f])) files.push(...doc[f])
    })
    return [...new Set(files.filter(isCloudFile))]
}

/** 删除记录时需要清理的点赞/评论条件；不需要时返回 null */
function interactionTargetOf(collection, doc) {
    const cfg = CASCADE[collection]
    if (!cfg || !cfg.targetType || !doc) return null
    const targetId = doc[cfg.targetIdField || '_id']
    return targetId ? { target_type: cfg.targetType, target_id: targetId } : null
}

/** 修改记录后被替换掉、且不再被任何字段引用的云文件 */
function staleFilesAfterUpdate(collection, before, patch) {
    const cfg = CASCADE[collection]
    if (!cfg || !before) return []
    const stale = []
    ;(cfg.files || []).forEach(f => {
        if (f in patch && before[f] !== patch[f]) stale.push(before[f])
    })
    ;(cfg.arrayFiles || []).forEach(f => {
        if (Array.isArray(patch[f]) && Array.isArray(before[f])) {
            stale.push(...before[f].filter(x => !patch[f].includes(x)))
        }
    })
    // 仍被其他字段引用的文件不能删（例如 profiles 中当前背景 bg_image 同时在图库 bg_images 里）
    const after = { ...before, ...patch }
    const stillUsed = new Set()
    ;(cfg.files || []).forEach(f => stillUsed.add(after[f]))
    ;(cfg.arrayFiles || []).forEach(f => {
        if (Array.isArray(after[f])) after[f].forEach(x => stillUsed.add(x))
    })
    return [...new Set(stale.filter(x => isCloudFile(x) && !stillUsed.has(x)))]
}

/** 本次修改是否涉及需要级联清理的文件字段 */
function touchesFiles(collection, patch) {
    const cfg = CASCADE[collection]
    if (!cfg) return false
    return [...(cfg.files || []), ...(cfg.arrayFiles || [])].some(f => f in patch)
}

module.exports = {
    ALLOWED_COLLECTIONS,
    AUTHOR_OWNED_COLLECTIONS,
    PROTECTED_FIELDS,
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
}
