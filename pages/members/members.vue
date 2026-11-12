<template>
    <page-bg overlay="light" />
    <scroll-view
        scroll-y
        class="page-scroll"
        :class="{ 'page-scroll--transparent': bgImage }"
        refresher-enabled
        refresher-default-style="black"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
    >
        <!-- 顶部标题 -->
        <view class="page-header">
            <text class="page-title">成员管理</text>
            <text class="page-desc">共 {{ total }} 位成员</text>
        </view>

        <!-- 邀请码区域 -->
        <view class="section">
            <view class="invite-card">
                <view class="invite-header">
                    <text class="invite-icon">🎫</text>
                    <text class="invite-title">邀请码</text>
                </view>
                <view class="invite-body" v-if="inviteCode">
                    <text class="invite-code">{{ inviteCode }}</text>
                    <text class="invite-hint">点击复制 · 7天内有效 · 最多 10 人使用</text>
                </view>
                <view class="invite-actions">
                    <view class="invite-btn" @tap="handleGenerateInvite" :class="{ disabled: generating }">
                        <text>{{ generating ? '生成中...' : inviteCode ? '重新生成' : '生成邀请码' }}</text>
                    </view>
                    <view class="invite-btn invite-btn--secondary" @tap="copyInviteCode" v-if="inviteCode">
                        <text>复制</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 邀请码历史 -->
        <view class="section" v-if="inviteCodes.length > 0">
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
        <view class="section">
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
                        <view class="member-action-btn" @tap="handleSetAdmin(user)">
                            <text class="action-text action-text--blue">设为管理</text>
                        </view>
                        <view class="member-action-btn" @tap="handleRemoveUser(user)">
                            <text class="action-text action-text--red">移除</text>
                        </view>
                    </view>
                    <view class="member-self-badge" v-else-if="user._id === currentUser?._id">
                        <text class="self-badge-text">我</text>
                    </view>
                </view>
            </view>
            <view class="empty-state" v-else-if="!loadingUsers">
                <text class="empty-icon">👥</text>
                <text class="empty-text">暂无成员</text>
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
    background: #f2f2f7;
}
.page-scroll--transparent {
    background: transparent;
}

/* 页面标题 */
.page-header {
    padding: 120rpx 44rpx 32rpx;
}
.page-title {
    font-size: 44rpx;
    font-weight: 700;
    color: #1c1c1e;
    display: block;
    letter-spacing: 2rpx;
}
.page-desc {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-top: 8rpx;
    letter-spacing: 1rpx;
}

/* 区块 */
.section {
    padding: 0 32rpx 24rpx;
}
.section-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16rpx;
    padding: 24rpx 0 16rpx;
}
.section-title-line {
    flex: 1;
    height: 1rpx;
    background: rgba(60, 60, 67, 0.08);
}
.section-title {
    font-size: 24rpx;
    color: #8e8e93;
    letter-spacing: 2rpx;
    font-weight: 500;
}
.section-count {
    font-size: 22rpx;
    color: #aeaeb2;
    background: rgba(142, 142, 147, 0.1);
    padding: 2rpx 12rpx;
    border-radius: 10rpx;
}
.section-chevron {
    font-size: 24rpx;
    color: #8e8e93;
    transform: rotate(90deg);
    transition: transform 0.25s ease;
}
.section-chevron.open {
    transform: rotate(-90deg);
}

/* 邀请码卡片 */
.invite-card {
    background: rgba(255, 255, 255, 0.5);
    border-radius: 24rpx;
    padding: 32rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.03);
}
.invite-header {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 20rpx;
}
.invite-icon {
    font-size: 32rpx;
}
.invite-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #1c1c1e;
    letter-spacing: 1rpx;
}
.invite-body {
    text-align: center;
    padding: 24rpx 0;
}
.invite-code {
    font-size: 56rpx;
    font-weight: 700;
    color: #1c1c1e;
    letter-spacing: 12rpx;
    display: block;
}
.invite-hint {
    font-size: 22rpx;
    color: #8e8e93;
    display: block;
    margin-top: 8rpx;
}
.invite-actions {
    display: flex;
    gap: 16rpx;
    margin-top: 20rpx;
}
.invite-btn {
    flex: 1;
    height: 72rpx;
    background: #1c1c1e;
    color: #f2f2f7;
    border-radius: 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26rpx;
    font-weight: 500;
    letter-spacing: 2rpx;
}
.invite-btn.disabled {
    opacity: 0.4;
}
.invite-btn--secondary {
    background: rgba(28, 28, 30, 0.08);
    color: #1c1c1e;
}

/* 邀请码历史 */
.code-history {
    background: rgba(255, 255, 255, 0.4);
    border-radius: 20rpx;
    overflow: hidden;
    margin-top: 12rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.4);
}
.code-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22rpx 28rpx;
}
.code-item + .code-item {
    border-top: 1rpx solid rgba(60, 60, 67, 0.06);
}
.code-left {
    display: flex;
    flex-direction: column;
    gap: 4rpx;
}
.code-text {
    font-size: 28rpx;
    font-weight: 600;
    color: #1c1c1e;
    letter-spacing: 4rpx;
}
.code-meta {
    font-size: 22rpx;
    color: #8e8e93;
}
.code-status {
    font-size: 22rpx;
    color: #34c759;
    padding: 4rpx 14rpx;
    background: rgba(52, 199, 89, 0.1);
    border-radius: 10rpx;
}
.code-status.expired {
    color: #8e8e93;
    background: rgba(142, 142, 147, 0.1);
}
.code-revoke {
    font-size: 22rpx;
    color: #ff3b30;
    margin-left: 16rpx;
    padding: 4rpx 12rpx;
}

/* 成员列表 */
.member-list {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
}
.member-card {
    background: rgba(255, 255, 255, 0.5);
    border-radius: 20rpx;
    padding: 24rpx 28rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1rpx solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.02);
}
.member-left {
    display: flex;
    align-items: center;
    gap: 20rpx;
    flex: 1;
    min-width: 0;
}
.member-avatar {
    flex-shrink: 0;
}
.member-avatar-img {
    width: 72rpx;
    height: 72rpx;
    border-radius: 36rpx;
}
.member-avatar-ph {
    width: 72rpx;
    height: 72rpx;
    border-radius: 36rpx;
    background: linear-gradient(135deg, #c7c7cc 0%, #aeaeb2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    color: #fff;
    font-weight: 600;
}
.member-info {
    flex: 1;
    min-width: 0;
}
.member-name-row {
    display: flex;
    align-items: center;
    gap: 10rpx;
}
.member-name {
    font-size: 30rpx;
    font-weight: 600;
    color: #1c1c1e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.member-role-tag {
    padding: 2rpx 12rpx;
    background: rgba(28, 28, 30, 0.06);
    border-radius: 10rpx;
    flex-shrink: 0;
}
.member-role-text {
    font-size: 20rpx;
    color: #636366;
    font-weight: 500;
}
.member-time {
    font-size: 22rpx;
    color: #8e8e93;
    display: block;
    margin-top: 4rpx;
}
.member-actions {
    display: flex;
    gap: 12rpx;
    flex-shrink: 0;
}
.member-action-btn {
    padding: 8rpx 16rpx;
    border-radius: 12rpx;
    background: rgba(28, 28, 30, 0.04);
}
.action-text {
    font-size: 22rpx;
    font-weight: 500;
}
.action-text--blue {
    color: #007aff;
}
.action-text--red {
    color: #ff3b30;
}
.member-self-badge {
    padding: 4rpx 14rpx;
    background: rgba(28, 28, 30, 0.06);
    border-radius: 12rpx;
    flex-shrink: 0;
}
.self-badge-text {
    font-size: 22rpx;
    color: #636366;
    font-weight: 500;
}

/* 空状态/加载 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80rpx 0;
}
.empty-icon {
    font-size: 56rpx;
}
.empty-text {
    font-size: 26rpx;
    color: #8e8e93;
    margin-top: 16rpx;
}
.loading-state {
    text-align: center;
    padding: 60rpx 0;
}
.loading-text {
    font-size: 26rpx;
    color: #8e8e93;
}

.bottom-space {
    height: 60rpx;
}
</style>
