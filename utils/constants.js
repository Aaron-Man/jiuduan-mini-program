import TEMPLATE_IDS from '../cloud/functions/notification/templates.json'

// tabBar 页面路径：必须与 pages.json 中的 tabBar.list 一致
export const TAB_PAGES = ['/pages/home/home', '/pages/menu/menu', '/pages/orders/orders', '/pages/settings/settings']

/** 跳转页面：tab 页用 switchTab，其他用 navigateTo */
export function navigateToPage(url) {
    const path = url.split('?')[0]
    if (TAB_PAGES.includes(path)) uni.switchTab({ url: path })
    else uni.navigateTo({ url })
}

// 心情选项
export const MOOD_OPTIONS = [
    { emoji: '😊', label: '开心' },
    { emoji: '🥰', label: '甜蜜' },
    { emoji: '😋', label: '嘴馋' },
    { emoji: '😴', label: '慵懒' },
    { emoji: '🤔', label: '思考' },
    { emoji: '😤', label: '生气' },
    { emoji: '🥺', label: '委屈' },
    { emoji: '🎉', label: '庆祝' },
]

// 订单状态映射
export const ORDER_STATUS_MAP = {
    pending: { label: '待处理', color: 'warning' },
    cooking: { label: '烹饪中', color: 'primary' },
    done: { label: '已完成', color: 'success' },
    cancelled: { label: '已取消', color: 'danger' },
}

// 旅行状态映射
export const TRAVEL_STATUS_MAP = {
    planning: { label: '计划中', color: 'primary' },
    ongoing: { label: '进行中', color: 'accent' },
    completed: { label: '已完成', color: 'success' },
}

// 备忘颜色 - 温暖私密配色
export const MEMO_COLORS = [
    '#fdf6f0', // 暖杏
    '#f0f4ed', // 抹茶
    '#fef8e7', // 淡金
    '#eef2f8', // 雾蓝
    '#f5f0f8', // 淡紫
    '#faf3ed', // 暖橙
]

// 功能卡片渐变色
export const FUNC_CARD_GRADIENTS = {
    status: 'linear-gradient(135deg, #f8ece4 0%, #f2ddd0 100%)',
    journal: 'linear-gradient(135deg, #f0e8f5 0%, #e4d5ed 100%)',
    travel: 'linear-gradient(135deg, #e4eef8 0%, #d0dff0 100%)',
    memo: 'linear-gradient(135deg, #fef8e4 0%, #f8edc8 100%)',
    gallery: 'linear-gradient(135deg, #f5e4f0 0%, #edd0e4 100%)',
    menu: 'linear-gradient(135deg, #e8f5e4 0%, #d5edd0 100%)',
    orders: 'linear-gradient(135deg, #fef0e4 0%, #f8e0c8 100%)',
    settings: 'linear-gradient(135deg, #ede8e4 0%, #ddd5d0 100%)',
}

// 难度标签
export const DIFFICULTY_LABELS = {
    1: '简单',
    2: '较易',
    3: '中等',
    4: '较难',
    5: '困难',
}

// 相册分类 emoji
export const CATEGORY_EMOJIS = [
    '📷',
    '🌈',
    '🍜',
    '✈️',
    '🤳',
    '🐾',
    '🏔️',
    '📌',
    '🎉',
    '🎨',
    '🎵',
    '🏠',
    '💕',
    '🌸',
    '🎄',
    '⭐',
]

// 背景颜色预设映射（预设名称 -> CSS 颜色）
export const BG_COLOR_MAP = {
    warm_white: '#faf6f1',
    apricot: '#f5e6da',
    misty_blue: '#dce8f0',
    matcha: '#dfe8d8',
    lavender: '#e8e0f0',
    warm_gray: '#e8e5e0',
    sakura: '#f5e0e8',
    cream: '#f8f0e0',
}

// 背景预设（设置页、背景页共用）；style 来自 BG_COLOR_MAP
const BG_PRESET_NAMES = {
    warm_white: '暖白',
    apricot: '杏粉',
    misty_blue: '雾蓝',
    matcha: '抹茶',
    lavender: '藤紫',
    warm_gray: '暖灰',
    sakura: '樱粉',
    cream: '奶油',
}

export const BG_PRESETS = [
    { name: '默认', value: 'none', style: '#f2f2f7' },
    ...Object.keys(BG_PRESET_NAMES).map(value => ({ name: BG_PRESET_NAMES[value], value, style: BG_COLOR_MAP[value] })),
]

// 订阅消息模板 ID（在微信公众平台创建模板后填入）
// 唯一数据源：cloud/functions/notification/templates.json（云函数与客户端共用，修改一处即可）
export const NOTIFY_TEMPLATES = TEMPLATE_IDS

// 各场景请求订阅的模板（wx.requestSubscribeMessage 单次最多 3 个，第一个为本场景最相关的类型）
export const SUBSCRIBE_SCENES = {
    content: ['content_update', 'new_photo', 'order_update'],
    photo: ['new_photo', 'content_update', 'order_update'],
    order: ['order_update', 'content_update', 'new_photo'],
    travel: ['travel_remind', 'content_update', 'order_update'],
    period: ['period_remind', 'content_update', 'order_update'],
}

// 通知类型说明（用于设置页展示）
export const NOTIFY_TYPES = [
    { key: 'order_update', name: '点菜通知', desc: '菜品状态变更时提醒', icon: '🍳' },
    { key: 'travel_remind', name: '旅行提醒', desc: '出发前提醒', icon: '✈️' },
    { key: 'content_update', name: '动态提醒', desc: '新心情/日志提醒', icon: '💌' },
    { key: 'new_photo', name: '相册提醒', desc: '新照片上传提醒', icon: '📷' },
    { key: 'period_remind', name: '经期提醒', desc: '经期前后提醒', icon: '🌸' },
]
