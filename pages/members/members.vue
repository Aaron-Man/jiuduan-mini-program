<template>
    <page-bg overlay="light" tone="lilac" />
    <scroll-view
        scroll-y
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage }"
        refresher-enabled
        refresher-default-style="black"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <!-- 杂志式标题区 -->
        <view class="mast ui-fade-up">
            <text class="ui-eyebrow">FAMILY</text>
            <text class="ui-title mast-title">家庭成员</text>
            <text class="ui-sub mast-sub">共 {{ total }} 位成员</text>
        </view>

        <!-- 邀请码区域 -->
        <view class="section ui-fade-up ui-d1">
            <view class="invite-card">
                <view class="invite-header">
                    <view class="invite-icon ui-bubble ui-bubble--lilac"><text>🎫</text></view>
                    <view class="invite-head-text">
                        <text class="invite-eyebrow">ADMIT ONE · INVITATION</text>
                        <text class="invite-title">邀请码</text>
                    </view>
                </view>
                <!-- 票根撕线 -->
                <view class="ticket-perf">
                    <view class="ticket-notch ticket-notch--l"></view>
                    <view class="ticket-dash"></view>
                    <view class="ticket-notch ticket-notch--r"></view>
                </view>
                <view class="invite-body" v-if="inviteCode">
                    <text class="invite-code" @tap="copyInviteCode">{{ inviteCode }}</text>
                    <text class="invite-hint">点击复制 · 7天内有效 · 最多 10 人使用</text>
                </view>
                <view class="invite-body invite-body--empty" v-else>
                    <text class="invite-code invite-code--ph">· · · · · ·</text>
                    <text class="invite-hint">生成一张邀请券，邀请家人加入</text>
                </view>
                <view class="invite-actions">
                    <view class="invite-btn ui-press" @tap="handleGenerateInvite" :class="{ disabled: generating }">
                        <text>{{ generating ? '生成中...' : inviteCode ? '重新生成' : '生成邀请码' }}</text>
                    </view>
                    <view class="invite-btn invite-btn--secondary ui-press" @tap="copyInviteCode" v-if="inviteCode">
                        <text>复制</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 邀请码历史 -->
        <view class="section ui-fade-up ui-d2" v-if="inviteCodes.length > 0">
            <view class="section-header" @tap="showCodeHistory = !showCodeHistory">
                <view class="section-title-line"></view>
                <text class="section-title">历史邀请码</text>
                <text class="section-count">{{ inviteCodes.length }}</text>
                <text class="section-chevron" :class="{ open: showCodeHistory }">›</text>
                <view class="section-title-line"></view>
            </view>
            <view class="code-history" v-if="showCodeHistory">
                <view class="code-item" v-for="(code, idx) in inviteCodes" :key="idx" @tap="copyCode(code.code)">
                    <view class="code-left">
                        <text class="code-text">{{ code.code }}</text>
                        <text class="code-meta"
                            >已使用 {{ code.used_count || 0 }}{{ code.max_uses ? ' / ' + code.max_uses : '' }} 次</text
                        >
                    </view>
                    <view class="code-right">
                        <text class="code-status" :class="{ expired: codeState(code) !== 'valid' }">{{
                            CODE_STATE_LABELS[codeState(code)]
                        }}</text>
                        <text class="code-revoke" v-if="codeState(code) === 'valid'" @tap.stop="handleRevokeCode(code)"
                            >撤销</text
                        >
                    </view>
                </view>
            </view>
        </view>

        <!-- 成员列表 -->
        <view class="section ui-fade-up ui-d3">
            <view class="section-header">
                <view class="section-title-line"></view>
                <text class="section-title">成员列表</text>
                <view class="section-title-line"></view>
            </view>
            <view class="member-list" v-if="userList.length > 0">
                <view class="member-card" v-for="user in userList" :key="user._id">
                    <view class="member-left">
                        <view class="member-avatar">
                            <image
                                v-if="user.avatar_url && !user.avatar_url.startsWith('cloud://')"
                                :src="user.avatar_url"
                                class="member-avatar-img"
                                mode="aspectFill"
                                lazy-load
                            />
                            <view v-else class="member-avatar-ph">
                                <text>{{ (user.nickname || '?')[0] }}</text>
                            </view>
                        </view>
                        <view class="member-info">
                            <view class="member-name-row">
                                <text class="member-name">{{ user.nickname }}</text>
                                <view class="member-role-tag" v-if="user.role === 'admin'">
                                    <text class="member-role-text">管理员</text>
                                </view>
                            </view>
                            <text class="member-time">{{ formatTime(user.createTime) }}</text>
                        </view>
                    </view>
                    <view class="member-actions" v-if="user.role !== 'admin'">
                        <view class="member-action-btn ui-press" @tap="handleSetAdmin(user)">
                            <text class="action-text action-text--blue">设为管理</text>
                        </view>
                        <view class="member-action-btn member-action-btn--danger ui-press" @tap="handleRemoveUser(user)">
                            <text class="action-text action-text--red">移除</text>
                        </view>
                    </view>
                    <view class="member-self-badge" v-else-if="user._id === currentUser?._id">
                        <text class="self-badge-text">我</text>
                    </view>
                </view>
            </view>
            <view class="empty-state" v-else-if="!loadingUsers">
                <view class="empty-bubble"><text class="empty-icon">👥</text></view>
                <text class="empty-text">暂无成员</text>
                <text class="empty-tip">生成邀请码，把家人请进来吧</text>
            </view>
            <view class="loading-state" v-if="loadingUsers">
                <text class="loading-text">加载中...</text>
            </view>
        </view>

        <view class="bottom-space"></view>
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, onMounted } from 'vue'
import { callFunction, useSharedBg } from '../../utils/cloud'

const { bgImage } = useSharedBg()

const currentUser = ref(null)
const userList = ref([])
const total = ref(0)
const inviteCode = ref('')
const inviteCodes = ref([])
const generating = ref(false)
const loadingUsers = ref(false)
const refreshing = ref(false)
const showCodeHistory = ref(false)

onMounted(() => {
    loadCurrentUser()
    fetchUserList()
    fetchInviteCodes()
})

const onRefresh = async () => {
    refreshing.value = true
    await Promise.all([fetchUserList(), fetchInviteCodes()])
    refreshing.value = false
}

const loadCurrentUser = () => {
    const cached = uni.getStorageSync('auth_user')
    if (cached) currentUser.value = cached
}

const fetchUserList = async () => {
    loadingUsers.value = true
    try {
        const res = await callFunction('auth', { action: 'listUsers', skip: 0, limit: 100 })
        if (res.success) {
            userList.value = res.users
            total.value = res.total || res.users.length
            // 批量转换头像 URL
            const avatarFileIDs = userList.value.map(u => u.avatar_url).filter(u => u && u.startsWith('cloud://'))
            if (avatarFileIDs.length > 0) {
                try {
                    const urlRes = await callFunction('db', { action: 'getTempURLs', fileList: avatarFileIDs })
                    if (urlRes?.fileList) {
                        const urlMap = {}
                        urlRes.fileList.forEach(f => {
                            if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL
                        })
                        userList.value.forEach(u => {
                            if (u.avatar_url && urlMap[u.avatar_url]) {
                                u.avatar_url = urlMap[u.avatar_url]
                            }
                        })
                    }
                } catch (e) {
                    // 批量转换失败时头像显示为默认占位
                    console.warn('批量转换头像失败:', e)
                }
            }
        }
    } catch (e) {
        console.error('fetchUserList:', e)
    } finally {
        loadingUsers.value = false
    }
}

const fetchInviteCodes = async () => {
    try {
        const res = await callFunction('auth', { action: 'listInviteCodes' })
        if (res.success) {
            inviteCodes.value = res.codes || []
        }
    } catch (e) {
        console.warn('fetchInviteCodes:', e)
    }
}

const handleGenerateInvite = async () => {
    if (generating.value) return
    generating.value = true
    try {
        const res = await callFunction('auth', { action: 'generateInvite' })
        if (res.success) {
            inviteCode.value = res.code
            uni.vibrateShort({ type: 'medium' })
            fetchInviteCodes()
        } else {
            uni.showToast({ title: res.msg || '生成失败', icon: 'none' })
        }
    } catch (e) {
        uni.showToast({ title: '网络错误', icon: 'none' })
    } finally {
        generating.value = false
    }
}

const copyInviteCode = () => {
    if (!inviteCode.value) return
    uni.setClipboardData({
        data: inviteCode.value,
        success: () => uni.showToast({ title: '已复制', icon: 'success' }),
    })
}

const copyCode = code => {
    uni.setClipboardData({
        data: code,
        success: () => uni.showToast({ title: '已复制', icon: 'success' }),
    })
}

const CODE_STATE_LABELS = { valid: '有效', revoked: '已撤销', expired: '已过期', exhausted: '已用完' }
const codeState = code => {
    if (code.revoked) return 'revoked'
    if (new Date(code.expireTime) < new Date()) return 'expired'
    if (typeof code.max_uses === 'number' && (code.used_count || 0) >= code.max_uses) return 'exhausted'
    return 'valid'
}

const handleRevokeCode = code => {
    uni.showModal({
        title: '撤销邀请码',
        content: `撤销后「${code.code}」将无法再用于注册，已加入的成员不受影响。`,
        success: async res => {
            if (!res.confirm) return
            try {
                const r = await callFunction('auth', { action: 'revokeInvite', codeId: code._id })
                if (!r?.success) throw new Error(r?.msg)
                if (inviteCode.value === code.code) inviteCode.value = ''
                uni.showToast({ title: '已撤销', icon: 'success' })
                fetchInviteCodes()
            } catch (e) {
                uni.showToast({ title: e?.message || '撤销失败', icon: 'none' })
            }
        },
    })
}

const handleRemoveUser = user => {
    uni.showModal({
        title: '移除成员',
        content: `确定移除「${user.nickname}」？该成员创建的所有内容也会被删除。`,
        success: async res => {
            if (res.confirm) {
                try {
                    const result = await callFunction('auth', { action: 'removeUser', userId: user._id })
                    if (result.success) {
                        uni.showToast({ title: '已移除', icon: 'success' })
                        fetchUserList()
                    } else {
                        uni.showToast({ title: result.msg || '操作失败', icon: 'none' })
                    }
                } catch (e) {
                    uni.showToast({ title: '网络错误', icon: 'none' })
                }
            }
        },
    })
}

const handleSetAdmin = user => {
    uni.showModal({
        title: '设置管理员',
        content: `确定将「${user.nickname}」设为管理员？`,
        success: async res => {
            if (res.confirm) {
                try {
                    const result = await callFunction('auth', {
                        action: 'updateUserRole',
                        userId: user._id,
                        role: 'admin',
                    })
                    if (result.success) {
                        uni.showToast({ title: '已设置', icon: 'success' })
                        fetchUserList()
                    } else {
                        uni.showToast({ title: result.msg || '操作失败', icon: 'none' })
                    }
                } catch (e) {
                    uni.showToast({ title: '网络错误', icon: 'none' })
                }
            }
        },
    })
}

const formatTime = time => {
    if (!time) return ''
    const d = new Date(time)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.page-scroll {
    height: 100vh;
    background: transparent;
}
.page-scroll--transparent {
    background: transparent;
}

/* 标题区 */
.mast {
    padding: 40rpx 44rpx 8rpx;
    display: flex;
    flex-direction: column;
}
.mast-title {
    margin-top: 12rpx;
}
.mast-sub {
    margin-top: 10rpx;
    letter-spacing: 0.04em;
}

/* 区块 */
.section {
    padding: 28rpx 32rpx 8rpx;
}
.section-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16rpx;
    padding: 16rpx 0 24rpx;
}
.section-title-line {
    flex: 1;
    height: 1rpx;
    background: var(--line);
}
.section-title {
    font-family: var(--font-serif);
    font-size: 30rpx;
    color: var(--ink);
    letter-spacing: 0.1em;
    font-weight: 700;
}
.section-count {
    font-size: 20rpx;
    color: #fff;
    background: var(--ink);
    padding: 2rpx 14rpx;
    border-radius: 999rpx;
    font-weight: 600;
}
.section-chevron {
    font-size: 28rpx;
    color: var(--muted);
    transform: rotate(90deg);
    transition: transform 0.25s ease;
}
.section-chevron.open {
    transform: rotate(-90deg);
}

/* 邀请码卡片：票券样式 */
.invite-card {
    position: relative;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.92) 0%, rgba(244, 238, 252, 0.88) 100%);
    border-radius: var(--r-xl);
    padding: 36rpx 36rpx 36rpx;
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow);
}
.invite-header {
    display: flex;
    align-items: center;
    gap: 20rpx;
}
.invite-icon {
    width: 80rpx;
    height: 80rpx;
    border-radius: 28rpx;
    font-size: 38rpx;
    flex-shrink: 0;
}
.invite-head-text {
    display: flex;
    flex-direction: column;
}
.invite-eyebrow {
    font-size: 18rpx;
    letter-spacing: 0.3em;
    color: var(--plum);
    font-weight: 600;
}
.invite-title {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 4rpx;
}
/* 票根撕线 */
.ticket-perf {
    position: relative;
    display: flex;
    align-items: center;
    margin: 32rpx -36rpx 8rpx;
    height: 40rpx;
}
.ticket-dash {
    flex: 1;
    height: 0;
    border-top: 3rpx dashed rgba(107, 78, 113, 0.22);
    margin: 0 32rpx;
}
.ticket-notch {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    background: var(--bg);
    flex-shrink: 0;
    box-shadow: inset 0 2rpx 6rpx rgba(80, 56, 36, 0.08);
}
.ticket-notch--l {
    margin-left: -20rpx;
}
.ticket-notch--r {
    margin-right: -20rpx;
}
.invite-body {
    text-align: center;
    padding: 28rpx 0 12rpx;
}
.invite-code {
    font-family: var(--font-serif);
    font-size: 88rpx;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: 0.18em;
    line-height: 1.15;
    display: block;
}
.invite-code--ph {
    color: var(--faint);
    letter-spacing: 0.1em;
}
.invite-hint {
    font-size: 22rpx;
    color: var(--muted);
    display: block;
    margin-top: 14rpx;
    letter-spacing: 0.06em;
}
.invite-actions {
    display: flex;
    gap: 16rpx;
    margin-top: 32rpx;
}
.invite-btn {
    flex: 1;
    height: 92rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.1em;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.invite-btn.disabled {
    opacity: 0.4;
}
.invite-btn--secondary {
    flex: 0 0 200rpx;
    background: rgba(255, 255, 255, 0.8);
    color: var(--ink);
    border: 1rpx solid var(--line);
    box-shadow: none;
}

/* 邀请码历史 */
.code-history {
    background: var(--card);
    border-radius: var(--r-l);
    overflow: hidden;
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
}
.code-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 26rpx 32rpx;
}
.code-item + .code-item {
    border-top: 1rpx solid var(--line);
}
.code-left {
    display: flex;
    flex-direction: column;
    gap: 4rpx;
}
.code-text {
    font-family: var(--font-serif);
    font-size: 34rpx;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: 0.14em;
}
.code-meta {
    font-size: 22rpx;
    color: var(--muted);
}
.code-right {
    display: flex;
    align-items: center;
}
.code-status {
    font-size: 22rpx;
    font-weight: 600;
    color: #4f7a5b;
    padding: 6rpx 18rpx;
    background: var(--sage);
    border-radius: 999rpx;
}
.code-status.expired {
    color: var(--muted);
    background: var(--bg-2);
}
.code-revoke {
    font-size: 22rpx;
    color: var(--coral);
    margin-left: 12rpx;
    padding: 6rpx 12rpx;
}

/* 成员列表 */
.member-list {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
}
.member-card {
    background: var(--card);
    border-radius: var(--r-l);
    padding: 28rpx 28rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
}
.member-left {
    display: flex;
    align-items: center;
    gap: 24rpx;
    flex: 1;
    min-width: 0;
}
.member-avatar {
    flex-shrink: 0;
    padding: 4rpx;
    border-radius: 50%;
    background: var(--grad-sunset);
}
.member-avatar-img {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    border: 4rpx solid #fff;
    box-sizing: border-box;
    display: block;
}
.member-avatar-ph {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    border: 4rpx solid #fff;
    box-sizing: border-box;
    background: var(--lilac);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif);
    font-size: 36rpx;
    color: var(--plum);
    font-weight: 700;
}
.member-info {
    flex: 1;
    min-width: 0;
}
.member-name-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
}
.member-name {
    font-size: 30rpx;
    font-weight: 600;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.member-role-tag {
    padding: 2rpx 14rpx;
    background: var(--ink);
    border-radius: 999rpx;
    flex-shrink: 0;
}
.member-role-text {
    font-size: 18rpx;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.1em;
}
.member-time {
    font-size: 22rpx;
    color: var(--muted);
    display: block;
    margin-top: 6rpx;
    letter-spacing: 0.04em;
}
.member-actions {
    display: flex;
    gap: 10rpx;
    flex-shrink: 0;
}
.member-action-btn {
    padding: 10rpx 20rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
}
.member-action-btn--danger {
    background: transparent;
    border-color: transparent;
}
.action-text {
    font-size: 22rpx;
    font-weight: 600;
}
.action-text--blue {
    color: var(--ink);
}
.action-text--red {
    color: var(--coral);
}
.member-self-badge {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: var(--lilac);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.self-badge-text {
    font-family: var(--font-serif);
    font-size: 24rpx;
    color: var(--plum);
    font-weight: 700;
}

/* 空状态/加载 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 64rpx 0;
}
.empty-bubble {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    background: var(--lilac);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 24rpx 48rpx -24rpx rgba(107, 78, 113, 0.5);
}
.empty-icon {
    font-size: 72rpx;
}
.empty-text {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 28rpx;
}
.empty-tip {
    font-size: 24rpx;
    color: var(--muted);
    margin-top: 8rpx;
}
.loading-state {
    text-align: center;
    padding: 60rpx 0;
}
.loading-text {
    font-size: 24rpx;
    color: var(--muted);
    letter-spacing: 0.2em;
}

.bottom-space {
    height: calc(60rpx + env(safe-area-inset-bottom));
}
</style>
