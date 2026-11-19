const cloud = require('wx-server-sdk')
const fs = require('fs')
const path = require('path')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const TAXONOMY = require('./taxonomy.json')

// 列表只返回卡片需要的字段；做法、小贴士等长内容在 getDish 时再取
const LIST_FIELDS = {
    name: true,
    alias: true,
    description: true,
    image_url: true,
    cuisine: true,
    course: true,
    tags: true,
    time_min: true,
    servings: true,
    difficulty: true,
    spice: true,
    available: true,
    hidden: true,
    source: true,
    category_ids: true,
    category_id: true,
    ingredients: true,
    order_count: true,
    sort_order: true,
    createTime: true,
}
const MAX_PAGE = 50
const SORTS = {
    // 默认：按手动排序。家里的菜 sort_order 是 0 开始的小数字，精选菜谱从 10000 开始，所以家里的菜总在前面
    default: [['sort_order', 'asc'], ['order_count', 'desc']],
    popular: [['order_count', 'desc'], ['sort_order', 'asc']],
    new: [['createTime', 'desc']],
    quick: [['time_min', 'asc'], ['order_count', 'desc']],
}

// 成员身份校验：只有 authorized_users 中的成员可以调用
async function getMember(openid) {
    if (!openid) return null
    const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
    return (res.data && res.data[0]) || null
}

const escapeRegExp = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const cuisinesOfRegion = key => ((TAXONOMY.regions.find(r => r.key === key) || {}).cuisines || []).map(c => c.key)

/**
 * 把筛选参数转成查询条件
 * scope：family 家里添加的（包括早期没有 source 字段的菜）/ builtin 精选菜谱 / 空为全部
 */
function buildWhere(event, member) {
    const conds = []
    if (member.role !== 'admin') conds.push({ hidden: _.neq(true) })
    if (event.scope === 'builtin') conds.push({ source: 'builtin' })
    if (event.scope === 'family') conds.push({ source: _.neq('builtin') })
    if (event.cuisine) conds.push({ cuisine: event.cuisine })
    else if (event.region) conds.push({ cuisine: _.in(cuisinesOfRegion(event.region)) })
    if (event.course) conds.push({ course: event.course })
    if (Array.isArray(event.tags) && event.tags.length) conds.push({ tags: _.all(event.tags.slice(0, 5)) })
    if (event.categoryId) conds.push({ category_ids: event.categoryId })
    if (event.maxTime) conds.push({ time_min: _.lte(Number(event.maxTime)) })
    if (event.maxDifficulty) conds.push({ difficulty: _.lte(Number(event.maxDifficulty)) })
    const kw = String(event.keyword || '').trim().slice(0, 20)
    if (kw) {
        const re = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })
        conds.push(_.or([{ name: re }, { alias: re }, { ingredients: re }, { description: re }]))
    }
    return conds.length ? _.and(conds) : {}
}

/** 精选菜谱数据：recipes/*.json，每个文件是一个数组 */
function loadBuiltinRecipes() {
    const dir = path.join(__dirname, 'recipes')
    if (!fs.existsSync(dir)) return []
    return fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
}

exports.main = async (event, context) => {
    const { action } = event
    const { OPENID } = cloud.getWXContext()

    try {
        switch (action) {
            // 只返回调用者自己的 openid，无需成员身份
            case 'getOpenId': {
                return { openid: OPENID }
            }

            /**
             * 菜品列表
             * - 传了 limit：分页 + 筛选 + 搜索，只返回卡片字段，{ data, hasMore }
             * - 没传 limit：返回全部菜品（旧版本小程序仍在这样调用，发布新版本前要保持兼容）
             */
            case 'listDishes': {
                const member = await getMember(OPENID)
                if (!member) return { code: 401, msg: '未授权，请先登录' }
                if (event.limit === undefined) {
                    const cond = member.role === 'admin' ? {} : { hidden: _.neq(true) }
                    const PAGE_SIZE = 100
                    let allData = []
                    let skip = 0
                    while (true) {
                        const res = await db
                            .collection('dishes')
                            .where(cond)
                            .orderBy('sort_order', 'asc')
                            .orderBy('createTime', 'desc')
                            .skip(skip)
                            .limit(PAGE_SIZE)
                            .get()
                        allData = allData.concat(res.data || [])
                        if (res.data.length < PAGE_SIZE) break
                        skip += PAGE_SIZE
                    }
                    return { data: allData }
                }
                const limit = Math.min(Math.max(parseInt(event.limit, 10) || 20, 1), MAX_PAGE)
                const skip = Math.max(parseInt(event.skip, 10) || 0, 0)
                let query = db.collection('dishes').where(buildWhere(event, member)).field(LIST_FIELDS)
                for (const [field, dir] of SORTS[event.sort] || SORTS.default) query = query.orderBy(field, dir)
                // 多取一条判断是否还有下一页，省掉一次 count
                const res = await query.skip(skip).limit(limit + 1).get()
                const rows = res.data || []
                return { data: rows.slice(0, limit), hasMore: rows.length > limit }
            }

            // 单道菜的完整内容（做法、小贴士）
            case 'getDish': {
                const member = await getMember(OPENID)
                if (!member) return { code: 401, msg: '未授权，请先登录' }
                if (!event.id) return { code: -1, msg: '缺少菜品ID' }
                const res = await db.collection('dishes').where({ _id: event.id }).limit(1).get()
                const dish = (res.data || [])[0]
                if (!dish || (dish.hidden === true && member.role !== 'admin')) return { code: 404, msg: '菜品不存在' }
                return { data: dish }
            }

            // 各菜系 / 餐别的菜品数量，用于筛选栏上的数字
            case 'facets': {
                const member = await getMember(OPENID)
                if (!member) return { code: 401, msg: '未授权，请先登录' }
                const $ = db.command.aggregate
                const match = member.role === 'admin' ? {} : { hidden: _.neq(true) }
                const group = async field => {
                    const r = await db
                        .collection('dishes')
                        .aggregate()
                        .match(match)
                        .group({ _id: '$' + field, count: $.sum(1) })
                        .limit(1000)
                        .end()
                    const out = {}
                    ;(r.list || []).forEach(x => {
                        out[x._id || ''] = x.count
                    })
                    return out
                }
                const [cuisine, course, source] = await Promise.all([group('cuisine'), group('course'), group('source')])
                const total = Object.values(source).reduce((a, b) => a + b, 0)
                return { data: { cuisine, course, builtin: source.builtin || 0, total } }
            }

            /**
             * 导入精选菜谱（仅管理员）：按 builtin_key 判断，已经导入过的不会重复添加，也不会覆盖家里改过的内容
             */
            case 'importBuiltin': {
                const member = await getMember(OPENID)
                if (!member || member.role !== 'admin') return { code: 403, msg: '只有管理员可以导入菜谱' }
                const recipes = loadBuiltinRecipes()
                const existing = new Set()
                for (let skip = 0; ; skip += 100) {
                    const res = await db
                        .collection('dishes')
                        .where({ source: 'builtin' })
                        .field({ builtin_key: true })
                        .skip(skip)
                        .limit(100)
                        .get()
                    ;(res.data || []).forEach(d => existing.add(d.builtin_key))
                    if ((res.data || []).length < 100) break
                }
                const todo = recipes.filter(r => r.key && !existing.has(r.key))
                const now = new Date()
                let added = 0
                for (let i = 0; i < todo.length; i += 20) {
                    await Promise.all(
                        todo.slice(i, i + 20).map((r, j) =>
                            db.collection('dishes').add({
                                data: {
                                    name: r.name,
                                    alias: r.alias || '',
                                    description: r.description || '',
                                    cuisine: r.cuisine,
                                    course: r.course,
                                    tags: r.tags || [],
                                    time_min: r.time_min || null,
                                    servings: r.servings || 2,
                                    difficulty: r.difficulty || 2,
                                    spice: r.spice || 0,
                                    ingredients: r.ingredients || '',
                                    steps: r.steps || [],
                                    tips: r.tips || '',
                                    image_url: null,
                                    available: true,
                                    category_ids: [],
                                    order_count: 0,
                                    // 精选菜谱排在家里的菜后面
                                    sort_order: 10000 + i + j,
                                    source: 'builtin',
                                    builtin_key: r.key,
                                    owner_openid: OPENID,
                                    createTime: now,
                                },
                            })
                        )
                    )
                    added += Math.min(20, todo.length - i)
                }
                return { success: true, added, skipped: recipes.length - todo.length, total: recipes.length }
            }

            default:
                return { code: -1, msg: '未知操作' }
        }
    } catch (err) {
        console.error(`[menu] action=${action} error:`, err)
        return { code: -1, msg: '服务器错误，请重试' }
    }
}
