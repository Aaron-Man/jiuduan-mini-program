/**
 * 云开发工具函数
 * 封装微信云开发的常用操作
 * 注意：云开发初始化已在 App.vue 的 onLaunch 中完成
 */

import { ref, computed, getCurrentInstance, onUnmounted } from 'vue'
import { NOTIFY_TEMPLATES, SUBSCRIBE_SCENES, BG_COLOR_MAP } from './constants'

// 云环境 ID（统一常量，避免多处硬编码）
export const CLOUD_ENV = 'cloudbase-d5gy2odvl005e5a40'

/**
 * 获取云对象（延迟获取，避免模块加载时 wx.cloud 未就绪）
 */
function getCloud() {
    if (typeof wx === 'undefined' || !wx.cloud) {
        throw new Error('wx.cloud 不可用，请确认：1.使用微信小程序平台编译 2.已开通云开发')
    }
    return wx.cloud
}

/**
 * 确保云开发可用
 */
export function ensureInit() {
    // 仅检查可用性（云开发已在 App.vue 中初始化）
    getCloud()
}

/**
 * 注意：客户端不直连云数据库。
 * 所有集合的数据库权限应设为「所有用户不可读写」，读写一律经过带成员鉴权的云函数（db / auth / order / menu）。
 */

/**
 * 调用云函数（带超时和重试）
 */
export async function callFunction(name, data = {}, timeout = 15000, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`云函数 ${name} 调用超时`))
                }, timeout)

                getCloud().callFunction({
                    name,
                    data,
                    success: res => {
                        clearTimeout(timer)
                        resolve(res.result)
                    },
                    fail: err => {
                        clearTimeout(timer)
                        reject(err)
                    },
                })
            })
        } catch (err) {
            console.error(`[云函数] ${name} 第${attempt + 1}次调用失败:`, err)
            if (attempt >= retries) throw err
            await new Promise(r => setTimeout(r, 500))
        }
    }
}

/**
 * 上传文件到云存储（带进度）
 */
export function uploadFile(cloudPath, filePath) {
    ensureInit()
    return new Promise((resolve, reject) => {
        getCloud().uploadFile({
            cloudPath,
            filePath,
            success: res => resolve(res),
            fail: err => {
                console.error('[云存储] 上传失败:', err)
                reject(err)
            },
        })
    })
}

/**
 * 获取云文件临时 URL（批量）
 * 通过云函数调用，绕过云存储客户端权限限制
 * @param {string[]} fileList - 云文件 ID 数组
 */
export async function getTempFileURL(fileList) {
    if (!fileList || fileList.length === 0) return []
    try {
        const res = await callFunction('db', { action: 'getTempURLs', fileList })
        if (res?.fileList) {
            const list = res.fileList
            list.forEach(f => {
                if (!f.tempFileURL) console.warn('[云存储] 文件 URL 转换失败:', f.fileID, f.errMsg)
            })
            return list
        }
        console.warn('[云存储] getTempFileURL 云函数返回异常:', res)
        return []
    } catch (e) {
        console.error('[云存储] getTempFileURL 云函数调用失败:', e)
        return []
    }
}

/**
 * 将云文件 ID 安全地转换为可访问的临时 URL
 * 如果不是云文件 ID（已是 http/本地路径），直接返回原值
 */
export async function resolveFileUrl(fileID) {
    if (!fileID) return ''
    if (!fileID.startsWith('cloud://')) return fileID
    try {
        const urls = await getTempFileURL([fileID])
        if (urls.length > 0 && urls[0].tempFileURL) return urls[0].tempFileURL
        console.warn('[云存储] resolveFileUrl 转换返回空，原文件 ID:', fileID)
        return fileID
    } catch (e) {
        console.error('[云存储] resolveFileUrl 转换失败:', fileID, e)
        return fileID
    }
}

/**
 * 批量将对象列表中的云文件 ID 字段转换为临时 URL
 * @param {Array} list - 数据列表
 * @param {string} fileIdKey - 云文件 ID 字段名
 * @param {string} tempUrlKey - 转换后的临时 URL 字段名
 */
export async function resolveFileUrls(list, fileIdKey = 'imageUrl', tempUrlKey = 'tempUrl') {
    const fileIDs = list.map(item => item[fileIdKey]).filter(u => u && u.startsWith('cloud://'))
    if (fileIDs.length === 0) return
    try {
        const urls = await getTempFileURL(fileIDs)
        const urlMap = {}
        urls.forEach(u => {
            if (u.tempFileURL) urlMap[u.fileID] = u.tempFileURL
        })
        list.forEach(item => {
            if (item[fileIdKey] && urlMap[item[fileIdKey]]) {
                item[tempUrlKey] = urlMap[item[fileIdKey]]
            }
        })
    } catch (e) {
        console.error('[云存储] resolveFileUrls 批量转换失败:', e)
    }
}

/**
 * 解析 db 云函数的查询结果；未授权或出错时抛出异常，交给调用方的 catch 处理
 */
function unwrapQuery(res, collection) {
    if (res && Array.isArray(res.data)) return res
    throw new Error(res?.msg || `查询 ${collection} 失败`)
}

/**
 * 获取集合全部记录（经 db 云函数，自动分页，服务端单次最多 100 条）
 * @param {Object} [options.truncate] 长文本字段只取开头一段，如 { content: 120 }（被截断的记录带 _truncated: true）
 */
export async function fetchAllRecords(collection, { where = {}, orderBy = 'createTime', orderType = 'desc', truncate } = {}) {
    const PAGE_SIZE = 100
    let allData = []
    let skip = 0
    while (true) {
        const res = unwrapQuery(
            await callFunction('db', {
                action: 'query',
                collection,
                where,
                orderBy,
                orderType,
                limit: PAGE_SIZE,
                skip,
                withCount: false,
                truncate,
            }),
            collection
        )
        allData = allData.concat(res.data)
        if (res.data.length < PAGE_SIZE) break
        skip += PAGE_SIZE
    }
    return allData
}

/**
 * 按 _id 读取一条完整记录，不存在时返回 null
 */
export async function getRecord(collection, id) {
    const res = unwrapQuery(
        await callFunction('db', { action: 'query', collection, where: { _id: id }, limit: 1, withCount: false }),
        collection
    )
    return res.data[0] || null
}

/**
 * 读取空间资料（profiles 集合的第一条记录），不存在时返回 null
 */
export async function getProfile() {
    const res = unwrapQuery(
        await callFunction('db', {
            action: 'query',
            collection: 'profiles',
            limit: 1,
            withCount: false,
        }),
        'profiles'
    )
    return res.data[0] || null
}

/**
 * 写入空间资料：已有则更新，没有才新建（先查后写，避免各页面各自 add 出多条 profiles）
 * @returns {Promise<string>} profiles 文档 _id
 */
export async function saveProfile(patch) {
    const p = await getProfile()
    if (p) {
        await dbUpdate('profiles', p._id, { ...patch, updateTime: new Date() })
        return p._id
    }
    const res = await dbAdd('profiles', { ...patch, createTime: new Date(), updateTime: new Date() })
    if (!res || !res._id) throw new Error(res?.msg || '创建空间资料失败')
    return res._id
}

/**
 * 通用数据库操作（通过云函数，绕过客户端权限限制）
 */
// db 云函数出错时返回 { code, msg }（成功时是数据库 SDK 的原始结果，没有 code 字段），这里转成异常
function unwrapWrite(res, op, collection) {
    if (res && typeof res.code === 'number' && res.code !== 0) {
        throw new Error(res.msg || `${op} ${collection} 失败`)
    }
    return res
}
export async function dbUpdate(collection, id, data) {
    return unwrapWrite(await callFunction('db', { action: 'update', collection, id, data }), 'update', collection)
}
export async function dbDelete(collection, id) {
    return unwrapWrite(await callFunction('db', { action: 'remove', collection, id }), 'remove', collection)
}
/**
 * 批量更新多条记录（一次云函数调用最多 100 条，超出自动分批）
 * @param {Array<{ id: string, data: Object }>} updates
 */
export async function dbBatchUpdate(collection, updates) {
    let updated = 0
    for (let i = 0; i < updates.length; i += 100) {
        const res = unwrapWrite(
            await callFunction('db', { action: 'batchUpdate', collection, updates: updates.slice(i, i + 100) }),
            'batchUpdate',
            collection
        )
        updated += res?.updated || 0
    }
    return { updated }
}
export async function dbAdd(collection, data) {
    return unwrapWrite(await callFunction('db', { action: 'add', collection, data }), 'add', collection)
}

/**
 * 相对时间格式化（刚刚 / 3分钟前 / 2小时前 / 昨天 / 3天前）
 */
export function formatRelativeTime(t) {
    if (!t) return ''
    const now = Date.now()
    const d = new Date(t).getTime()
    const diff = now - d
    const minute = 60000
    const hour = 3600000
    const day = 86400000
    if (diff < minute) return '刚刚'
    if (diff < hour) return Math.floor(diff / minute) + '分钟前'
    if (diff < day) return Math.floor(diff / hour) + '小时前'
    if (diff < day * 2) return '昨天'
    if (diff < day * 7) return Math.floor(diff / day) + '天前'
    const date = new Date(t)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 获取时段问候语
 */
export function getGreeting() {
    const h = new Date().getHours()
    if (h < 6) return { text: '夜深了', emoji: '🌙' }
    if (h < 9) return { text: '早上好', emoji: '🌅' }
    if (h < 12) return { text: '上午好', emoji: '☀️' }
    if (h < 14) return { text: '中午好', emoji: '' }
    if (h < 18) return { text: '下午好', emoji: '🌤️' }
    if (h < 22) return { text: '晚上好', emoji: '🌆' }
    return { text: '晚安', emoji: '🌙' }
}

/**
 * 持久化缓存（localStorage 级，跨页面/跨会话有效）
 * 用于菜谱、相册等列表数据的缓存，实现「缓存优先 + 后台刷新」策略
 */
export function setPCache(key, data, ttl = 300000) {
    try {
        uni.setStorageSync('pc_' + key, JSON.stringify({ d: data, e: Date.now() + ttl }))
    } catch (e) {}
}
export function getPCache(key) {
    try {
        const raw = uni.getStorageSync('pc_' + key)
        if (!raw) return null
        const item = JSON.parse(raw)
        if (Date.now() < item.e) return item.d
        uni.removeStorageSync('pc_' + key)
    } catch (e) {}
    return null
}
export function clearPCache(key) {
    try {
        if (key) uni.removeStorageSync('pc_' + key)
        else {
            uni.getStorageInfoSync()
                .keys.filter(k => k.startsWith('pc_'))
                .forEach(k => uni.removeStorageSync(k))
        }
    } catch (e) {}
}

/**
 * 文件 URL 缓存（cloudID → tempURL 映射，跨页面共享）
 * 云文件临时 URL 有效期约 24 小时，缓存 12 小时安全
 */
export function cacheFileUrls(items, fileIdKey = 'fileID', tempUrlKey = 'displayUrl') {
    const map = getPCache('_fileUrls') || {}
    items.forEach(item => {
        if (item[fileIdKey]?.startsWith('cloud://') && item[tempUrlKey]) {
            map[item[fileIdKey]] = item[tempUrlKey]
        }
    })
    setPCache('_fileUrls', map, 43200000)
}
export function restoreFileUrls(items, fileIdKey = 'fileID', tempUrlKey = 'displayUrl') {
    const map = getPCache('_fileUrls') || {}
    let hit = false
    items.forEach(item => {
        if (item[fileIdKey]?.startsWith('cloud://') && map[item[fileIdKey]]) {
            item[tempUrlKey] = map[item[fileIdKey]]
            hit = true
        }
    })
    return hit
}

/**
 * 请求订阅消息授权
 * @param {string[]} tmplIds - 模板 ID 数组
 */
export function requestSubscribe(tmplIds) {
    return new Promise(resolve => {
        if (!tmplIds || tmplIds.length === 0) {
            resolve({ granted: false })
            return
        }
        // 微信限制单次最多 3 个模板，超出会导致整次请求失败
        const validIds = [...new Set(tmplIds.filter(Boolean))].slice(0, 3)
        if (validIds.length === 0) {
            resolve({ granted: false, reason: 'no_valid_templates' })
            return
        }
        wx.requestSubscribeMessage({
            tmplIds: validIds,
            success(res) {
                const granted = validIds.filter(id => res[id] === 'accept')
                resolve({ granted: granted.length > 0, grantedIds: granted, detail: res })
            },
            fail(err) {
                console.warn('[通知] 订阅请求失败:', err)
                resolve({ granted: false, reason: err.errMsg })
            },
        })
    })
}

/**
 * 按场景请求订阅授权（必须在用户点击事件中同步调用）
 * @param {'content'|'photo'|'order'|'travel'|'period'} scene - 见 constants.js 中的 SUBSCRIBE_SCENES
 */
export function requestSubscribeFor(scene) {
    const keys = SUBSCRIBE_SCENES[scene] || []
    return requestSubscribe(keys.map(k => NOTIFY_TEMPLATES[k]))
}

/**
 * 全局共享背景状态
 * App 启动时加载一次，所有页面共享同一份背景数据，避免重复加载
 */
const _globalBg = {
    raw: '', // 原始存储值（color:xxx / cloud://xxx / 空）
    resolved: '', // 解析后的可显示值（临时 URL / color:xxx / 空）
    isPreset: false, // 是否为预设颜色
    ready: false, // 是否已完成首次加载
}

/**
 * App 启动时调用一次：从 Storage 加载背景并解析
 */
export async function initGlobalBg() {
    const raw = uni.getStorageSync('bg_image') || ''
    _globalBg.raw = raw
    if (!raw) {
        _globalBg.resolved = ''
        _globalBg.isPreset = false
    } else if (raw.startsWith('color:')) {
        _globalBg.resolved = raw
        _globalBg.isPreset = true
    } else if (raw.startsWith('cloud://')) {
        try {
            _globalBg.resolved = (await resolveFileUrl(raw)) || ''
        } catch (e) {
            _globalBg.resolved = ''
        }
        _globalBg.isPreset = false
    } else {
        _globalBg.resolved = raw
        _globalBg.isPreset = false
    }
    _globalBg.ready = true
    // 初始化完成后通知所有监听者（处理页面在 init 完成前就已挂载的情况）
    _bgListeners.forEach(fn => fn(_globalBg.resolved))
}

/**
 * 页面 / 组件 composable：返回共享的响应式背景数据（只读），自动跟随全局背景变化
 * 用法：const { bgImage, isPresetBg, bgPresetStyle } = useSharedBg()
 */
export function useSharedBg() {
    const bgImage = ref(_globalBg.resolved)
    // 自动注册背景变更监听，组件/页面卸载时自动注销；页面无需再手动 onBgChange / onShow 同步
    const off = onBgChange(v => {
        bgImage.value = v
    })
    if (getCurrentInstance()) onUnmounted(off)
    const isPresetBg = computed(() => !!bgImage.value && bgImage.value.startsWith('color:'))
    const bgPresetStyle = computed(() => {
        if (!isPresetBg.value) return ''
        return BG_COLOR_MAP[bgImage.value.replace('color:', '')] || '#f2f2f7'
    })
    return { bgImage, isPresetBg, bgPresetStyle }
}

/**
 * 设置页调用：应用新的背景设置，更新全局状态 + Storage + DB
 * @param {string} newRaw - 新的原始值（color:xxx / cloud://xxx / 空字符串）
 */
export async function applyBgChange(newRaw) {
    _globalBg.raw = newRaw
    uni.setStorageSync('bg_image', newRaw)
    if (!newRaw) {
        _globalBg.resolved = ''
        _globalBg.isPreset = false
    } else if (newRaw.startsWith('color:')) {
        _globalBg.resolved = newRaw
        _globalBg.isPreset = true
    } else if (newRaw.startsWith('cloud://')) {
        try {
            _globalBg.resolved = (await resolveFileUrl(newRaw)) || ''
        } catch (e) {
            _globalBg.resolved = ''
        }
        _globalBg.isPreset = false
    } else {
        _globalBg.resolved = newRaw
        _globalBg.isPreset = false
    }
    // 通知所有已注册的页面更新背景
    _bgListeners.forEach(fn => fn(_globalBg.resolved))
}

/**
 * 注册背景变更监听（页面 onShow 时同步最新背景）
 * @param {Function} fn - 回调函数，接收新的 resolved bgImage
 * @returns {Function} 取消监听的函数
 */
const _bgListeners = new Set()
export function onBgChange(fn) {
    _bgListeners.add(fn)
    return () => _bgListeners.delete(fn)
}

/**
 * 获取当前全局背景原始值（供设置页读取当前状态）
 */
export function getGlobalBgRaw() {
    return _globalBg.raw
}
export function getGlobalBgResolved() {
    return _globalBg.resolved
}

/**
 * 发送订阅消息给所有其他用户（排除当前操作者）
 */
export async function sendNotificationToAll(type, fromUser, data, page) {
    try {
        return await callFunction('notification', { action: 'sendAll', type, fromUser, data, page })
    } catch (e) {
        console.warn('[通知] 群发失败:', e)
        return { success: false }
    }
}
