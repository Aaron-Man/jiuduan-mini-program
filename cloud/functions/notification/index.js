const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 订阅消息通知云函数
 *
 * action: send    - 发送给指定用户
 *         sendAll - 发送给除操作者外的所有用户
 *
 * 参数:
 *   type     - 通知类型
 *   toUser   - 目标用户 _id（sendAll 时不需要；sendAll 时操作者由服务端根据 OPENID 确定并排除）
 *   data     - 模板数据
 *   page     - 跳转页面（可选）
 */

// 订阅消息模板 ID：唯一数据源是同目录的 templates.json，客户端 utils/constants.js 也从这里读取
const TEMPLATE_IDS = require('./templates.json')
const { normalizePage, buildMsgData } = require('./messages')

// 成员身份校验：只有 authorized_users 中的成员可以触发通知
async function getMember(openid) {
    if (!openid) return null
    const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
    return (res.data && res.data[0]) || null
}

exports.main = async (event, context) => {
    try {
        const { action = 'send', type, toUser, data = {}, page } = event

        const { OPENID } = cloud.getWXContext()
        const member = await getMember(OPENID)
        if (!member) return { success: false, code: 401, msg: '未授权，请先登录' }

        if (!type) {
            return { success: false, msg: '缺少通知类型' }
        }

        const templateId = TEMPLATE_IDS[type]
        if (!templateId) {
            return { success: false, msg: `模板「${type}」未配置，请在微信公众平台创建后填入` }
        }

        // 确定接收者列表
        let targetOpenIds = []

        if (action === 'sendAll') {
            // 发送给所有已订阅该类型通知的用户（排除操作者；操作者以服务端身份为准，不信任客户端传入的 fromUser）
            const usersRes = await db
                .collection('authorized_users')
                .where({ _id: db.command.neq(member._id), notify_types: type })
                .limit(100)
                .get()
            targetOpenIds = (usersRes.data || []).filter(u => u.openid).map(u => u.openid)
        } else {
            // 发送给指定用户（需检查是否订阅了该类型）
            if (!toUser) return { success: false, msg: '缺少目标用户' }
            const userRes = await db.collection('authorized_users').doc(toUser).get()
            if (userRes.data && userRes.data.openid) {
                const userNotifyTypes = userRes.data.notify_types || []
                if (userNotifyTypes.includes(type)) {
                    targetOpenIds = [userRes.data.openid]
                }
            }
        }

        if (targetOpenIds.length === 0) {
            return { success: false, msg: '没有可发送的目标用户' }
        }

        // 构造消息数据
        const msgData = buildMsgData(type, data)

        // 批量发送（逐个发送，微信不支持批量）
        const results = []
        for (const openid of targetOpenIds) {
            try {
                const result = await cloud.openapi.subscribeMessage.send({
                    touser: openid,
                    templateId,
                    page: normalizePage(page),
                    data: msgData,
                })
                results.push({ openid, success: true, result })
            } catch (err) {
                results.push({ openid, success: false, msg: err.errMsg })
            }
        }

        const successCount = results.filter(r => r.success).length
        return { success: true, sent: successCount, total: targetOpenIds.length, results }
    } catch (err) {
        console.error('[notification] error:', err)
        return { success: false, msg: err.errMsg || '发送失败' }
    }
}
