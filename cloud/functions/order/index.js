const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const VALID_STATUSES = ['pending', 'cooking', 'done', 'cancelled']

// 成员身份校验：只有 authorized_users 中的成员可以调用
async function getMember(openid) {
    if (!openid) return null
    const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
    return (res.data && res.data[0]) || null
}

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    const { action, dishId, dishName, note } = event

    try {
        const member = await getMember(wxContext.OPENID)
        if (!member) return { code: 401, msg: '未授权，请先登录' }

        switch (action) {
            case 'listOrders': {
                // 自动分页取全部订单（服务端单次最多返回 100 条）
                const PAGE_SIZE = 100
                let all = []
                for (let skip = 0; ; skip += PAGE_SIZE) {
                    const res = await db
                        .collection('orders')
                        .orderBy('createTime', 'desc')
                        .skip(skip)
                        .limit(PAGE_SIZE)
                        .get()
                    all = all.concat(res.data || [])
                    if ((res.data || []).length < PAGE_SIZE) break
                }
                return { data: all }
            }

            case 'countByDish': {
                // 统计每道菜的点单次数（排除已取消的订单），在数据库中聚合，不受 1000 条上限影响
                const $ = db.command.aggregate
                const agg = await db
                    .collection('orders')
                    .aggregate()
                    .match({ status: _.neq('cancelled'), dishId: _.neq(null) })
                    .group({ _id: '$dishId', count: $.sum(1) })
                    .limit(10000)
                    .end()
                const counts = {}
                for (const r of agg.list || []) {
                    if (r._id) counts[r._id] = r.count
                }
                return { data: counts }
            }

            case 'addOrder': {
                const name = (dishName || '').trim()
                if (!name) return { code: -1, msg: '菜品名称不能为空' }
                const randomOrderId = Math.floor(10000000 + Math.random() * 90000000).toString()
                const result = await db.collection('orders').add({
                    data: {
                        dishId: dishId || null,
                        dishName: name,
                        note: (note || '').trim() || null,
                        customOrderId: randomOrderId,
                        openid: wxContext.OPENID,
                        status: 'pending',
                        createTime: new Date(),
                        updateTime: new Date(),
                    },
                })
                // 递增菜品点单次数
                if (dishId) {
                    try {
                        await db
                            .collection('dishes')
                            .doc(dishId)
                            .update({
                                data: { order_count: _.inc(1) },
                            })
                    } catch (e) {
                        console.warn('[order] 更新点单次数失败:', e)
                    }
                }
                return result
            }

            case 'updateOrderStatus': {
                if (!event.id) return { code: -1, msg: '缺少订单ID' }
                if (!VALID_STATUSES.includes(event.status)) {
                    return { code: -1, msg: '无效的状态值' }
                }
                // 取消订单时递减点单次数
                if (event.status === 'cancelled') {
                    try {
                        const order = await db.collection('orders').doc(event.id).get()
                        if (order.data && order.data.dishId && order.data.status !== 'cancelled') {
                            await db
                                .collection('dishes')
                                .doc(order.data.dishId)
                                .update({
                                    data: { order_count: _.inc(-1) },
                                })
                        }
                    } catch (e) {
                        console.warn('[order] 取消时更新点单次数失败:', e)
                    }
                }
                return await db
                    .collection('orders')
                    .doc(event.id)
                    .update({
                        data: { status: event.status, updateTime: new Date() },
                    })
            }

            case 'deleteOrder': {
                if (!event.id) return { code: -1, msg: '缺少订单ID' }
                // 删除前检查状态，非 cancelled 则递减点单次数
                try {
                    const order = await db.collection('orders').doc(event.id).get()
                    if (order.data && order.data.dishId && order.data.status !== 'cancelled') {
                        await db
                            .collection('dishes')
                            .doc(order.data.dishId)
                            .update({
                                data: { order_count: _.inc(-1) },
                            })
                    }
                } catch (e) {
                    console.warn('[order] 删除时更新点单次数失败:', e)
                }
                return await db.collection('orders').doc(event.id).remove()
            }

            default:
                return { code: -1, msg: '未知操作' }
        }
    } catch (err) {
        console.error(`[order] action=${action} error:`, err)
        return { code: -1, msg: '服务器错误，请重试' }
    }
}
