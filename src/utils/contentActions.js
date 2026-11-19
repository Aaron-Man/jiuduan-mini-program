/**
 * 内容页通用操作：删除确认、切换「上首页」、管理员隐藏 / 展示
 * 使用页面：status / journal / memo / travel / menu / orders / period / gallery / wish / anniversary / capsule
 */
import { dbUpdate, dbDelete, clearPCache } from './cloud'

/**
 * 列表加载失败时的统一处理：记录日志；页面上还没有任何数据时提示用户（有缓存数据时不打扰）
 * @param hasData 当前是否已有数据（例如来自缓存）
 */
export function handleLoadError(e, hasData = false) {
    console.error('[加载] 失败:', e)
    if (!hasData) uni.showToast({ title: '加载失败，下拉刷新重试', icon: 'none' })
}

/** Promise 化的确认弹窗，返回用户是否点了确定 */
export function confirmModal(content, title = '确认') {
    return new Promise(resolve => {
        uni.showModal({ title, content, success: res => resolve(!!res.confirm), fail: () => resolve(false) })
    })
}

/**
 * 弹窗确认后删除一条记录，失败时提示用户
 * @returns 是否删除成功
 */
export async function confirmDelete({ content, remove, collection, id, cacheKeys = [], onDone }) {
    if (!(await confirmModal(content))) return false
    ;[].concat(cacheKeys, '_home').forEach(k => clearPCache(k))
    try {
        if (remove) await remove()
        else await dbDelete(collection, id)
        if (onDone) await onDone()
        return true
    } catch (e) {
        console.error('[删除] 失败:', e)
        uni.showToast({ title: '删除失败', icon: 'none' })
        return false
    }
}

/**
 * 卡片右下角「···」的更多操作，避免每张卡片上堆一排小按钮
 * @param actions [{ label, run, show }]：show 为 false 的不显示
 */
export function showMoreActions(actions) {
    const list = actions.filter(a => a.show !== false)
    uni.showActionSheet({
        itemList: list.map(a => a.label),
        success: ({ tapIndex }) => list[tapIndex] && list[tapIndex].run(),
    })
}

/** 当前登录的是否为管理员（隐藏 / 展示内容只有管理员可以操作，云函数也会校验） */
export function isAdminUser() {
    return (uni.getStorageSync('auth_user') || {}).role === 'admin'
}

/**
 * 管理员切换记录的隐藏状态：隐藏后其他成员完全看不到（由 db 云函数过滤），管理员仍能看到并恢复
 * @param cacheKeys 额外要清掉的页面缓存（默认清掉与集合同名的缓存和首页缓存）
 * @returns 是否成功
 */
export async function toggleHidden(collection, item, cacheKeys = []) {
    const hidden = !item.hidden
    if (hidden && !(await confirmModal('隐藏后其他成员将看不到这条内容，你可以随时取消隐藏。', '隐藏内容'))) return false
    try {
        await dbUpdate(collection, item._id, { hidden })
        item.hidden = hidden
        ;[collection, '_home', ...[].concat(cacheKeys)].forEach(k => clearPCache(k))
        uni.showToast({ title: hidden ? '已隐藏' : '已恢复展示', icon: 'success' })
        return true
    } catch (e) {
        uni.showToast({ title: e.message || '操作失败', icon: 'none' })
        return false
    }
}

/** 切换记录的「显示在首页」标记（乐观更新本地对象） */
export async function toggleShowOnHome(collection, item) {
    try {
        await dbUpdate(collection, item._id, { showOnHome: !item.showOnHome })
        item.showOnHome = !item.showOnHome
        // 页面列表缓存的 key 与集合名相同
        clearPCache(collection)
        clearPCache('_home')
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    }
}
