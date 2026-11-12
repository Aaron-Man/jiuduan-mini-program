const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 成员身份校验：只有 authorized_users 中的成员可以调用
async function getMember(openid) {
    if (!openid) return null
    const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
    return (res.data && res.data[0]) || null
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

            // 菜品列表（服务端单次上限 100 条，自动分页）
            case 'listDishes': {
                if (!(await getMember(OPENID))) return { code: 401, msg: '未授权，请先登录' }
                const PAGE_SIZE = 100
                let allData = []
                let skip = 0
                while (true) {
                    const res = await db
                        .collection('dishes')
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

            default:
                return { code: -1, msg: '未知操作' }
        }
    } catch (err) {
        console.error(`[menu] action=${action} error:`, err)
        return { code: -1, msg: '服务器错误，请重试' }
    }
}
