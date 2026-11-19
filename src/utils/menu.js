/**
 * 菜谱与点菜的数据层
 * - 分类体系：cloud/functions/menu/taxonomy.json（云函数和小程序共用，改一处即可）
 * - 列表分页加载：每个筛选条件的第一页会缓存，翻页时才继续请求
 * - 点菜篮：全局共享（菜谱页、详情页、下单页看到的是同一个），保存在本地，切页面、重进小程序都不会丢
 */
import { reactive, computed } from 'vue'
import TAXONOMY from '../../cloud/functions/menu/taxonomy.json'
import { callFunction, getPCache, setPCache, clearPCache, resolveFileUrls, restoreFileUrls, cacheFileUrls, sendNotificationToAll } from './cloud'

export { TAXONOMY }
export const REGIONS = TAXONOMY.regions
export const COURSES = TAXONOMY.courses
export const TAGS = TAXONOMY.tags
export const MEAL_SLOTS = TAXONOMY.mealSlots
export const PAGE_SIZE = 20

const CUISINE_MAP = {}
REGIONS.forEach(r => r.cuisines.forEach(c => (CUISINE_MAP[c.key] = { ...c, region: r.key, regionLabel: r.label })))
// 早期家里添加的菜没有菜系，按家常菜展示
const FALLBACK_CUISINE = CUISINE_MAP['cn-home']

export const cuisineOf = key => CUISINE_MAP[key] || FALLBACK_CUISINE
export const courseOf = key => COURSES.find(c => c.key === key) || null
export const tagOf = key => TAGS.find(t => t.key === key) || null
export const slotOf = key => MEAL_SLOTS.find(s => s.key === key) || null
export const SPICE_LABELS = ['不辣', '微辣', '中辣', '特辣']

/** 一句话的菜品信息：菜系 · 餐别 · 时间 */
export function dishMeta(d) {
    const parts = [cuisineOf(d.cuisine).label]
    const c = courseOf(d.course)
    if (c) parts.push(c.label)
    if (d.time_min) parts.push(d.time_min + ' 分钟')
    return parts.join(' · ')
}

// ===== 列表 =====
const cacheKeyOf = params => 'dishes_' + JSON.stringify(params)

/** 解析云函数返回，出错时抛出 */
function unwrap(res, fallbackMsg) {
    if (!res || res.code) throw new Error(res?.msg || fallbackMsg)
    return res
}

/**
 * 加载一页菜品
 * @param params 筛选：{ scope, region, cuisine, course, tags, categoryId, keyword, maxTime, maxDifficulty, sort }
 * @returns {{ data, hasMore }}
 */
export async function fetchDishPage(params, skip = 0) {
    const res = unwrap(
        await callFunction('menu', { action: 'listDishes', ...params, skip, limit: PAGE_SIZE }),
        '加载菜品失败'
    )
    const data = res.data || []
    await resolveFileUrls(data, 'image_url', 'displayUrl')
    cacheFileUrls(data, 'image_url', 'displayUrl')
    // 只缓存筛选组合的第一页；搜索词千变万化，缓存会在手机存储里越积越多
    if (skip === 0 && !params.keyword) setPCache(cacheKeyOf(params), { data, hasMore: !!res.hasMore })
    return { data, hasMore: !!res.hasMore }
}

/** 某个筛选条件第一页的缓存（先显示缓存再刷新） */
export function cachedDishPage(params) {
    if (params.keyword) return null
    const c = getPCache(cacheKeyOf(params))
    if (c) restoreFileUrls(c.data, 'image_url', 'displayUrl')
    return c
}

/** 菜品有增删改时，清掉所有列表缓存和计数缓存 */
export function clearDishCaches() {
    try {
        uni.getStorageInfoSync()
            .keys.filter(k => k.startsWith('pc_dishes_') || k.startsWith('pc_dish_'))
            .forEach(k => uni.removeStorageSync(k))
    } catch (e) {}
    clearPCache('menu_facets')
    clearPCache('menu')
}

/** 各菜系 / 餐别的数量（筛选栏上的数字），缓存 5 分钟 */
export async function fetchFacets() {
    const cached = getPCache('menu_facets')
    if (cached) return cached
    const res = unwrap(await callFunction('menu', { action: 'facets' }), '加载分类失败')
    setPCache('menu_facets', res.data)
    return res.data
}

/** 单道菜的完整内容（做法、小贴士） */
export async function fetchDish(id, { fresh = false } = {}) {
    if (!fresh) {
        const c = getPCache('dish_' + id)
        if (c) {
            restoreFileUrls([c], 'image_url', 'displayUrl')
            if (c.displayUrl || !c.image_url) return c
        }
    }
    const res = unwrap(await callFunction('menu', { action: 'getDish', id }), '加载菜品失败')
    const dish = res.data
    await resolveFileUrls([dish], 'image_url', 'displayUrl')
    setPCache('dish_' + id, dish)
    return dish
}

/** 每道菜的点单次数（不含已取消），在订单库里聚合，比菜品上的计数字段更准确 */
export async function fetchOrderCounts() {
    const cached = getPCache('menu_order_counts')
    if (cached) return cached
    const res = unwrap(await callFunction('order', { action: 'countByDish' }), '加载点菜次数失败')
    setPCache('menu_order_counts', res.data || {}, 60000)
    return res.data || {}
}

// ===== 点菜篮 =====
const CART_KEY = 'menu_cart'
const readCart = () => {
    try {
        const v = uni.getStorageSync(CART_KEY)
        return Array.isArray(v) ? v : []
    } catch (e) {
        return []
    }
}
const cart = reactive({ items: readCart() })
const saveCart = () => {
    try {
        uni.setStorageSync(CART_KEY, cart.items)
    } catch (e) {}
}

/** 点菜篮：items 为 [{ dishId, name, cuisine, image_url, displayUrl, servings, note }] */
export function useCart() {
    const count = computed(() => cart.items.length)
    const totalServings = computed(() => cart.items.reduce((n, it) => n + (it.servings || 1), 0))
    const find = id => cart.items.find(it => it.dishId === id)
    const add = dish => {
        const hit = find(dish._id)
        if (hit) hit.servings = Math.min((hit.servings || 1) + 1, 20)
        else
            cart.items.push({
                dishId: dish._id,
                name: dish.name,
                cuisine: dish.cuisine || '',
                image_url: dish.image_url || '',
                displayUrl: dish.displayUrl || '',
                servings: 1,
                note: '',
            })
        saveCart()
    }
    const setServings = (id, n) => {
        const hit = find(id)
        if (!hit) return
        if (n <= 0) cart.items.splice(cart.items.indexOf(hit), 1)
        else hit.servings = Math.min(n, 20)
        saveCart()
    }
    const setNote = (id, note) => {
        const hit = find(id)
        if (hit) {
            hit.note = note
            saveCart()
        }
    }
    const remove = id => setServings(id, 0)
    const clear = () => {
        cart.items.splice(0, cart.items.length)
        saveCart()
    }
    const servingsOf = id => (find(id) || {}).servings || 0
    return { cart, count, totalServings, add, setServings, setNote, remove, clear, servingsOf }
}

/**
 * 提交点菜篮：一餐一批订单，并通知家人一次
 * @returns 新订单的批次号
 */
export async function submitCart({ mealDate, mealSlot, note }) {
    const { cart: c, clear } = useCart()
    if (!c.items.length) throw new Error('点菜篮是空的')
    const res = await callFunction('order', {
        action: 'addOrders',
        mealDate,
        mealSlot,
        note,
        items: c.items.map(it => ({ dishId: it.dishId, dishName: it.name, servings: it.servings, note: it.note })),
    })
    if (!res?.success) throw new Error(res?.msg || '下单失败')
    const names = c.items.map(it => it.name)
    const slot = slotOf(mealSlot)
    const u = uni.getStorageSync('auth_user')
    sendNotificationToAll(
        'order_update',
        u?._id,
        {
            dishName: names.length > 1 ? `${names[0]} 等 ${names.length} 道菜` : names[0],
            status: 'pending',
            note: (slot ? slot.label : '') + (note ? ' · ' + note : '') || '新的点菜',
        },
        '/pages/orders/orders'
    )
    clear()
    clearPCache('orders')
    clearPCache('menu_order_counts')
    return res.batchId
}
