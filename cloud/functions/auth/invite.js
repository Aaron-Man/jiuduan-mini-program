/**
 * 邀请码与订阅类型的纯逻辑
 */
const crypto = require('crypto')

// 邀请码字符集：去掉易混淆的 0/O、1/I/L
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const INVITE_CODE_LENGTH = 6
const DEFAULT_INVITE_MAX_USES = 10
const MAX_INVITE_USES = 50
const INVITE_TTL_MS = 7 * 86400000

// 允许订阅的通知类型（与 notification/templates.json 的键一致）
const VALID_NOTIFY_TYPES = ['order_update', 'travel_remind', 'content_update', 'new_photo', 'period_remind']

/**
 * 生成加密安全的随机邀请码
 * 使用拒绝采样消除取模偏差：只接受小于字符集长度整数倍的字节
 */
function randomInviteCode(len = INVITE_CODE_LENGTH, randomBytes = crypto.randomBytes) {
    const n = INVITE_ALPHABET.length
    const limit = 256 - (256 % n)
    let code = ''
    while (code.length < len) {
        for (const b of randomBytes(len * 2)) {
            if (b < limit) code += INVITE_ALPHABET[b % n]
            if (code.length === len) break
        }
    }
    return code
}

/** 规范化用户输入的邀请码；格式不对返回空字符串 */
function normalizeInviteCode(code) {
    if (typeof code !== 'string') return ''
    const c = code.trim().toUpperCase()
    return c.length === INVITE_CODE_LENGTH ? c : ''
}

/** 管理员生成邀请码时指定的使用次数，限制在 1 ~ MAX_INVITE_USES */
function clampMaxUses(v) {
    return Math.min(Math.max(parseInt(v, 10) || DEFAULT_INVITE_MAX_USES, 1), MAX_INVITE_USES)
}

/**
 * 检查邀请码能否用于注册新成员；可用时返回 null，否则返回错误提示
 * 没有 max_uses 字段的邀请码不限制使用次数
 */
function inviteError(invite, now = new Date()) {
    if (!invite) return '邀请码无效'
    if (invite.revoked) return '邀请码已被撤销'
    if (new Date(invite.expireTime) < now) return '邀请码已过期'
    if (typeof invite.max_uses === 'number' && (invite.used_count || 0) >= invite.max_uses)
        return '邀请码使用次数已达上限'
    return null
}

module.exports = {
    INVITE_ALPHABET,
    INVITE_CODE_LENGTH,
    DEFAULT_INVITE_MAX_USES,
    MAX_INVITE_USES,
    INVITE_TTL_MS,
    VALID_NOTIFY_TYPES,
    randomInviteCode,
    normalizeInviteCode,
    clampMaxUses,
    inviteError,
}
