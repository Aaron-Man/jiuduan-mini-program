/**
 * 订阅消息内容构造
 */

const STATUS_LABELS = {
    pending: '待处理',
    cooking: '烹饪中',
    done: '已完成',
    cancelled: '已取消',
}

// 跳转页面只允许小程序内的绝对路径
const isValidPage = p => typeof p === 'string' && /^\/?pages\/[\w\-/]+(\?[\w\-=&%.]*)?$/.test(p)

/** 规范化跳转页面：只允许 pages/... 路径，去掉开头的 / */
const normalizePage = p => (isValidPage(p) ? p.replace(/^\//, '') : '')

/**
 * 根据通知类型构造消息数据
 * 微信订阅消息模板字段名为 thing1/thing2/thing3 等，
 * 具体对应关系需在微信公众平台查看模板关键词列表
 */
function buildMsgData(type, data) {
    switch (type) {
        case 'order_update':
            return {
                thing1: { value: (data.dishName || '菜品').slice(0, 20) },
                thing2: { value: (STATUS_LABELS[data.status] || data.status || '状态更新').slice(0, 20) },
                thing3: { value: (data.note || '无').slice(0, 20) },
            }
        case 'travel_remind':
            return {
                thing1: { value: (data.title || '旅行').slice(0, 20) },
                thing2: { value: (data.destination || '目的地').slice(0, 20) },
                thing3: { value: (data.startDate || '待定').slice(0, 20) },
            }
        case 'content_update':
            return {
                thing1: { value: (data.title || '新内容').slice(0, 20) },
                thing2: { value: (data.contentType || '动态').slice(0, 20) },
                thing3: { value: (data.summary || '快来看看吧').slice(0, 20) },
            }
        case 'new_photo':
            return {
                thing1: { value: (data.title || '新照片').slice(0, 20) },
                thing2: { value: (data.category || '相册').slice(0, 20) },
                thing3: { value: (data.summary || '快来看看吧').slice(0, 20) },
            }
        case 'period_remind':
            return {
                thing1: { value: (data.title || '经期提醒').slice(0, 20) },
                thing2: { value: (data.contentType || '经期管理').slice(0, 20) },
                thing3: { value: (data.summary || '').slice(0, 20) },
            }
        default:
            // 通用格式
            return {
                thing1: { value: (data.title || '通知').slice(0, 20) },
                thing2: { value: (data.content || '').slice(0, 20) },
                thing3: { value: (data.note || '').slice(0, 20) },
            }
    }
}

module.exports = { STATUS_LABELS, isValidPage, normalizePage, buildMsgData }
