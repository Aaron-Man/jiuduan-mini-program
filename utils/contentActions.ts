/**
 * 内容页通用操作：删除确认、切换「上首页」
 * 使用页面：status / journal / memo / travel / menu / orders / period
 */
import { dbUpdate, dbDelete, clearPCache } from './cloud'
import type { CloudRecord } from './types'

export interface ConfirmDeleteOptions {
    /** 确认弹窗文案 */
    content: string
    /** 自定义删除方法（默认 dbDelete(collection, id)） */
    remove?: () => Promise<unknown>
    collection?: string
    id?: string
    /** 删除前需要清除的持久化缓存 */
    cacheKeys?: string | string[]
    /** 删除成功后的回调 */
    onDone?: () => unknown
}

/**
 * 列表加载失败时的统一处理：记录日志；页面上还没有任何数据时提示用户（有缓存数据时不打扰）
 * @param hasData 当前是否已有数据（例如来自缓存）
 */
export function handleLoadError(e: unknown, hasData = false): void {
    console.error('[加载] 失败:', e)
    if (!hasData) uni.showToast({ title: '加载失败，下拉刷新重试', icon: 'none' })
}

/** Promise 化的确认弹窗，返回用户是否点了确定 */
export function confirmModal(content: string, title = '确认'): Promise<boolean> {
    return new Promise(resolve => {
        uni.showModal({ title, content, success: res => resolve(!!res.confirm), fail: () => resolve(false) })
    })
}

/**
 * 弹窗确认后删除一条记录，失败时提示用户
 * @returns 是否删除成功
 */
export async function confirmDelete({
    content,
    remove,
    collection,
    id,
    cacheKeys = [],
    onDone,
}: ConfirmDeleteOptions): Promise<boolean> {
    if (!(await confirmModal(content))) return false
    ;([] as string[]).concat(cacheKeys).forEach(k => clearPCache(k))
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

/** 切换记录的「显示在首页」标记（乐观更新本地对象） */
export async function toggleShowOnHome(collection: string, item: CloudRecord): Promise<void> {
    try {
        await dbUpdate(collection, item._id, { showOnHome: !item.showOnHome })
        item.showOnHome = !item.showOnHome
        clearPCache('_homeSpotlight')
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    }
}
