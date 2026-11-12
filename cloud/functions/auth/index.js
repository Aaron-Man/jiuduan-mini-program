const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const {
    INVITE_TTL_MS,
    VALID_NOTIFY_TYPES,
    randomInviteCode,
    normalizeInviteCode,
    clampMaxUses,
    inviteError,
} = require('./invite')

exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { action } = event

    try {
        switch (action) {
            // 检查当前用户是否已授权
            case 'checkAuth': {
                const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
                if (res.data.length > 0) {
                    return { authorized: true, user: res.data[0] }
                }
                return { authorized: false }
            }

            // 检查系统状态（是否有用户，不创建任何用户）
            case 'checkSystemStatus': {
                const countRes = await db.collection('authorized_users').count()
                return { hasUsers: countRes.total > 0, userCount: countRes.total }
            }

            // 首次启动自动注册为管理员（仅当系统无任何用户时）
            case 'initAdmin': {
                // 先检查当前 openid 是否已存在（防止重复注册）
                const existRes = await db.collection('authorized_users').where({ openid }).limit(1).get()
                if (existRes.data.length > 0) {
                    return { success: false, msg: '你已是系统用户' }
                }
                // 检查系统是否已有管理员
                const countRes = await db.collection('authorized_users').count()
                if (countRes.total > 0) {
                    return { success: false, msg: '系统已有管理员' }
                }
                const nickname = (event.nickname || '管理员').slice(0, 20)
                const addRes = await db.collection('authorized_users').add({
                    data: {
                        openid,
                        nickname,
                        avatar_url: event.avatar_url || '',
                        role: 'admin',
                        createTime: new Date(),
                    },
                })
                return { success: true, userId: addRes._id }
            }

            // 生成邀请码（仅管理员）
            case 'generateInvite': {
                const adminRes = await db.collection('authorized_users').where({ openid, role: 'admin' }).limit(1).get()
                if (adminRes.data.length === 0) {
                    return { success: false, msg: '只有管理员可以生成邀请码' }
                }
                // 使用加密安全的随机数生成，并确保不与现有邀请码重复
                let code = ''
                for (let i = 0; i < 5; i++) {
                    const candidate = randomInviteCode()
                    const dup = await db.collection('invite_codes').where({ code: candidate }).limit(1).get()
                    if (dup.data.length === 0) {
                        code = candidate
                        break
                    }
                }
                if (!code) return { success: false, msg: '生成失败，请重试' }
                const maxUses = clampMaxUses(event.maxUses)
                await db.collection('invite_codes').add({
                    data: {
                        code,
                        created_by: openid,
                        used: false,
                        used_count: 0,
                        max_uses: maxUses,
                        revoked: false,
                        createTime: new Date(),
                        expireTime: new Date(Date.now() + INVITE_TTL_MS), // 7天有效
                    },
                })
                return { success: true, code, maxUses }
            }

            // 撤销邀请码（仅管理员）
            case 'revokeInvite': {
                const adminRes = await db.collection('authorized_users').where({ openid, role: 'admin' }).limit(1).get()
                if (adminRes.data.length === 0) {
                    return { success: false, msg: '只有管理员可以撤销邀请码' }
                }
                const { codeId } = event
                if (!codeId) return { success: false, msg: '缺少邀请码ID' }
                await db
                    .collection('invite_codes')
                    .doc(codeId)
                    .update({
                        data: { revoked: true, updateTime: new Date() },
                    })
                return { success: true }
            }

            // 使用邀请码注册（有效期内可多人使用，最多 max_uses 次）
            case 'register': {
                const code = normalizeInviteCode(event.code)
                if (!code) {
                    return { success: false, msg: '请输入6位邀请码' }
                }

                const codeRes = await db.collection('invite_codes').where({ code }).limit(1).get()
                const inviteCode = codeRes.data[0] || null
                if (!inviteCode) {
                    return { success: false, msg: '邀请码无效' }
                }

                // 已注册的成员直接登录，不占用邀请码次数
                const existRes = await db.collection('authorized_users').where({ openid }).limit(1).get()
                if (existRes.data.length > 0) {
                    return { success: true, userId: existRes.data[0]._id, alreadyRegistered: true }
                }

                // 检查邀请码：是否撤销、过期、超过使用次数
                const err = inviteError(inviteCode)
                if (err) return { success: false, msg: err }

                // 注册新用户（使用用户输入的昵称）
                const userNickname =
                    event.nickname && event.nickname.trim()
                        ? event.nickname.trim().slice(0, 20)
                        : `成员${Date.now().toString(36).slice(-4).toUpperCase()}`
                const addRes = await db.collection('authorized_users').add({
                    data: {
                        openid,
                        nickname: userNickname,
                        avatar_url: '',
                        role: 'member',
                        invited_by: inviteCode.created_by,
                        createTime: new Date(),
                    },
                })

                // 记录使用人数（不标记为已使用，允许多人使用同一邀请码）
                await db
                    .collection('invite_codes')
                    .doc(inviteCode._id)
                    .update({
                        data: { used_count: _.inc(1) },
                    })

                // 直接返回完整用户对象，减少前端一次查询
                const newUser = {
                    _id: addRes._id,
                    openid,
                    nickname: userNickname,
                    avatar_url: '',
                    role: 'member',
                    invited_by: inviteCode.created_by,
                    createTime: new Date(),
                }
                return { success: true, userId: addRes._id, user: newUser }
            }

            // 获取所有用户（仅管理员，支持分页）
            case 'listUsers': {
                const adminRes = await db.collection('authorized_users').where({ openid, role: 'admin' }).limit(1).get()
                if (adminRes.data.length === 0) {
                    return { success: false, msg: '无权限' }
                }
                const { skip = 0, limit = 50 } = event
                const usersRes = await db
                    .collection('authorized_users')
                    .orderBy('createTime', 'asc')
                    .skip(skip)
                    .limit(limit)
                    .get()
                const countRes = await db.collection('authorized_users').count()
                return { success: true, users: usersRes.data, total: countRes.total }
            }

            // 移除用户（仅管理员，同时清理该用户创建的内容）
            case 'removeUser': {
                const adminRes = await db.collection('authorized_users').where({ openid, role: 'admin' }).limit(1).get()
                if (adminRes.data.length === 0) {
                    return { success: false, msg: '无权限' }
                }
                const { userId } = event
                if (!userId) return { success: false, msg: '缺少用户ID' }
                // 不能移除自己
                const targetRes = await db.collection('authorized_users').doc(userId).get()
                if (targetRes.data.openid === openid) {
                    return { success: false, msg: '不能移除自己' }
                }
                const targetOpenid = targetRes.data.openid
                // 清理该用户创建的内容。
                // 内容记录的创建者保存在 owner_openid 字段（由 db 云函数写入；没有该字段的记录不会被清理）；
                // 点赞、评论按 user_id 关联到 authorized_users._id
                const cleanup = [
                    ...['statuses', 'journals', 'travels', 'memos', 'gallery_photos'].map(col => [
                        col,
                        { owner_openid: targetOpenid },
                    ]),
                    ['likes', { user_id: userId }],
                    ['comments', { user_id: userId }],
                ]
                for (const [col, cond] of cleanup) {
                    try {
                        await db.collection(col).where(cond).remove()
                    } catch (e) {
                        // 集合可能不存在，忽略错误
                        console.warn(`清理 ${col} 失败:`, e)
                    }
                }
                // 移除用户记录
                await db.collection('authorized_users').doc(userId).remove()
                return { success: true }
            }

            // 更新用户角色（仅管理员）
            case 'updateUserRole': {
                const adminRes = await db.collection('authorized_users').where({ openid, role: 'admin' }).limit(1).get()
                if (adminRes.data.length === 0) {
                    return { success: false, msg: '无权限' }
                }
                const { userId, role } = event
                if (!userId || !['admin', 'member'].includes(role)) {
                    return { success: false, msg: '参数无效' }
                }
                // 不能修改自己的角色
                const targetRes = await db.collection('authorized_users').doc(userId).get()
                if (targetRes.data.openid === openid) {
                    return { success: false, msg: '不能修改自己的角色' }
                }
                // 如果撤消管理员，检查是否只剩一个管理员
                if (role === 'member' && targetRes.data.role === 'admin') {
                    const adminCount = await db.collection('authorized_users').where({ role: 'admin' }).count()
                    if (adminCount.total <= 1) {
                        return { success: false, msg: '系统至少需要一个管理员' }
                    }
                }
                await db
                    .collection('authorized_users')
                    .doc(userId)
                    .update({
                        data: { role, updateTime: new Date() },
                    })
                return { success: true }
            }

            // 获取当前用户信息
            // 家庭成员概览（所有成员可见，只返回展示用字段）
            case 'listMembers': {
                const meRes = await db.collection('authorized_users').where({ openid }).limit(1).get()
                if (meRes.data.length === 0) return { success: false, msg: '未授权' }
                const res = await db.collection('authorized_users').orderBy('createTime', 'asc').limit(50).get()
                const members = res.data.map(u => ({
                    _id: u._id,
                    openid: u.openid,
                    nickname: u.nickname,
                    avatar_url: u.avatar_url,
                    role: u.role,
                }))
                return { success: true, members }
            }

            case 'getCurrentUser': {
                const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
                if (res.data.length > 0) {
                    return { success: true, user: res.data[0] }
                }
                return { success: false }
            }

            // 更新用户信息
            case 'updateUser': {
                const { nickname, avatar_url } = event
                if (
                    nickname !== undefined &&
                    (typeof nickname !== 'string' || nickname.trim().length === 0 || nickname.trim().length > 20)
                ) {
                    return { success: false, msg: '昵称需为1-20个字符' }
                }
                const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
                if (res.data.length === 0) {
                    return { success: false, msg: '用户不存在' }
                }
                const updateData = { updateTime: new Date() }
                if (nickname !== undefined) updateData.nickname = nickname.trim()
                if (avatar_url !== undefined) updateData.avatar_url = avatar_url
                await db.collection('authorized_users').doc(res.data[0]._id).update({ data: updateData })
                // 换头像后删除旧头像文件
                const oldAvatar = res.data[0].avatar_url
                if (
                    avatar_url !== undefined &&
                    oldAvatar &&
                    oldAvatar !== avatar_url &&
                    oldAvatar.startsWith('cloud://')
                ) {
                    try {
                        await cloud.deleteFile({ fileList: [oldAvatar] })
                    } catch (e) {
                        console.warn('[auth] 删除旧头像失败:', e)
                    }
                }
                return { success: true }
            }

            // 更新订阅偏好
            // add / remove：原子地增删单个类型（避免先读后写的竞态）
            // types：整体覆盖
            case 'updateSubscription': {
                const { types, add, remove } = event
                const res = await db.collection('authorized_users').where({ openid }).limit(1).get()
                if (res.data.length === 0) return { success: false, msg: '用户不存在' }
                let notifyTypes
                if (add !== undefined || remove !== undefined) {
                    const t = add !== undefined ? add : remove
                    if (!VALID_NOTIFY_TYPES.includes(t)) return { success: false, msg: '无效的通知类型' }
                    notifyTypes = add !== undefined ? _.addToSet(t) : _.pull(t)
                } else {
                    notifyTypes = (Array.isArray(types) ? types : []).filter(t => VALID_NOTIFY_TYPES.includes(t))
                }
                await db
                    .collection('authorized_users')
                    .doc(res.data[0]._id)
                    .update({
                        data: { notify_types: notifyTypes, updateTime: new Date() },
                    })
                return { success: true }
            }

            // 获取邀请码列表（仅管理员）
            case 'listInviteCodes': {
                const adminRes = await db.collection('authorized_users').where({ openid, role: 'admin' }).limit(1).get()
                if (adminRes.data.length === 0) {
                    return { success: false, msg: '无权限' }
                }
                const codesRes = await db
                    .collection('invite_codes')
                    .where({ created_by: openid })
                    .orderBy('createTime', 'desc')
                    .limit(50)
                    .get()
                return { success: true, codes: codesRes.data }
            }

            default:
                return { success: false, msg: '未知操作: ' + action }
        }
    } catch (err) {
        console.error(`[auth] action=${action} error:`, err)
        return { success: false, msg: '服务器错误，请重试' }
    }
}
