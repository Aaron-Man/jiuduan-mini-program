<template>
    <page-bg image="" tone="sunset" />
    <view class="login-page">
        <!-- 状态：检查中 -->
        <view v-if="checking" class="login-center">
            <view class="logo-mark logo-mark--pulse"><text class="logo-mark-emoji">🐷</text></view>
            <text class="ui-eyebrow logo-eyebrow">OUR LITTLE HOME</text>
            <text class="logo-text">猪猪</text>
            <text class="loading-text">正在验证...</text>
        </view>

        <!-- 状态：未授权，需要邀请码 -->
        <view v-else-if="!authorized" class="login-center">
            <view class="logo-area ui-fade-up">
                <view class="logo-mark"><text class="logo-mark-emoji">🐷</text></view>
                <text class="ui-eyebrow logo-eyebrow">OUR LITTLE HOME</text>
                <text class="logo-text">猪猪</text>
                <view class="logo-rule"></view>
                <text class="logo-subtitle">输入邀请码加入空间</text>
            </view>

            <view class="input-area ui-fade-up ui-d2">
                <text class="field-label">INVITE CODE · 邀请码</text>
                <input
                    class="code-input"
                    v-model="inviteCode"
                    placeholder="请输入6位邀请码"
                    maxlength="6"
                    :focus="true"
                    @confirm="handleRegister"
                />
                <text class="field-label">NICKNAME · 昵称</text>
                <input
                    class="code-input nickname-input"
                    v-model="userNickname"
                    placeholder="输入你的昵称（可选）"
                    maxlength="20"
                    @confirm="handleRegister"
                />
                <view
                    class="join-btn ui-press"
                    @tap="handleRegister"
                    :class="{ disabled: registering || inviteCode.trim().length !== 6 }"
                >
                    <text>{{ registering ? '加入中...' : '进入' }}</text>
                </view>
                <text class="error-hint" v-if="errorMsg">{{ errorMsg }}</text>
            </view>

            <!-- 首次用户：创建管理员 -->
            <view class="first-user-area ui-fade-up ui-d3" v-if="isFirstUser && !networkError">
                <text class="first-label">你是第一个到来的人</text>
                <input class="code-input admin-input" v-model="adminNickname" placeholder="输入你的昵称" maxlength="20" />
                <view
                    class="admin-btn ui-press"
                    @tap="handleInitAdmin"
                    :class="{ disabled: initializing || !adminNickname.trim() }"
                >
                    <text>{{ initializing ? '创建中...' : '成为管理员' }}</text>
                </view>
            </view>

            <!-- 网络异常提示 -->
            <view class="first-user-area ui-fade-up ui-d3" v-if="networkError">
                <text class="first-label">网络异常，请检查网络后重试</text>
                <view class="admin-btn ui-press" @tap="retryCheck">
                    <text>重试</text>
                </view>
            </view>

            <text class="login-foot">made with love · for the two of us</text>
        </view>

        <!-- 状态：已授权，跳转中 -->
        <view v-else class="login-center">
            <view class="logo-mark ui-fade-up"><text class="logo-mark-emoji">🐷</text></view>
            <text class="ui-eyebrow logo-eyebrow ui-fade-up ui-d1">WELCOME HOME</text>
            <text class="logo-text logo-text--welcome ui-fade-up ui-d1">欢迎回来</text>
            <text class="logo-subtitle ui-fade-up ui-d2">{{ userName }}</text>
            <text class="loading-text ui-fade-up ui-d3">正在进入...</text>
        </view>
    </view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, onMounted } from 'vue'
import { callFunction } from '../../utils/cloud'

const checking = ref(true)
const authorized = ref(false)
const userName = ref('')
const inviteCode = ref('')
const userNickname = ref('')
const adminNickname = ref('')
const registering = ref(false)
const initializing = ref(false)
const isFirstUser = ref(false)
const networkError = ref(false)
const errorMsg = ref('')

onMounted(() => checkAuthStatus())

const checkAuthStatus = async () => {
    checking.value = true
    networkError.value = false
    try {
        const cached = uni.getStorageSync('auth_user')
        if (cached) {
            const res = await callFunction('auth', { action: 'getCurrentUser' })
            if (res.success) {
                authorized.value = true
                userName.value = res.user.nickname || '家庭成员'
                saveAuthInfo(res.user)
                redirectToHome()
                return
            }
            // 缓存失效，清除
            uni.removeStorageSync('auth_user')
        }

        const res = await callFunction('auth', { action: 'checkAuth' })
        if (res.authorized) {
            authorized.value = true
            userName.value = res.user.nickname || '家庭成员'
            saveAuthInfo(res.user)
            redirectToHome()
        } else {
            // 未授权，检查系统状态
            try {
                const sysRes = await callFunction('auth', { action: 'checkSystemStatus' })
                isFirstUser.value = !sysRes.hasUsers
            } catch (e) {
                console.warn('checkSystemStatus 失败:', e)
                // 网络异常时不显示管理员入口，显示重试提示
                networkError.value = true
            }
        }
    } catch (e) {
        console.error('Auth check error:', e)
        // 网络异常时不默认显示管理员入口
        networkError.value = true
    } finally {
        checking.value = false
    }
}

const retryCheck = () => {
    errorMsg.value = ''
    networkError.value = false
    checkAuthStatus()
}

// 用 getCurrentUser 的结果完成登录；失败返回 false，由调用方提示
const loginWithUser = userRes => {
    if (!userRes?.success || !userRes.user) return false
    saveAuthInfo(userRes.user)
    authorized.value = true
    userName.value = userRes.user.nickname
    redirectToHome()
    return true
}

// 不把原始错误对象展示给用户，只给出可理解的提示（详细信息在控制台）
const friendlyError = (e, prefix) => {
    const msg = String(e?.errMsg || e?.message || '')
    if (/timeout|超时/i.test(msg)) return `${prefix}：网络超时，请检查网络后重试`
    if (/FunctionName|not found|-501000|云函数/i.test(msg)) return `${prefix}：服务暂不可用，请确认云函数已部署`
    return `${prefix}，请稍后重试`
}

const handleInitAdmin = async () => {
    if (initializing.value) return
    initializing.value = true
    errorMsg.value = ''
    try {
        const res = await callFunction('auth', {
            action: 'initAdmin',
            nickname: adminNickname.value.trim() || '管理员',
        })
        if (res.success) {
            const userRes = await callFunction('auth', { action: 'getCurrentUser' })
            if (!loginWithUser(userRes)) errorMsg.value = '账号已创建，但读取用户信息失败，请重新打开小程序'
        } else {
            errorMsg.value = res.msg || '创建失败'
        }
    } catch (e) {
        console.error('initAdmin 失败:', e)
        errorMsg.value = friendlyError(e, '创建失败')
    } finally {
        initializing.value = false
    }
}

const handleRegister = async () => {
    if (inviteCode.value.trim().length !== 6 || registering.value) return
    registering.value = true
    errorMsg.value = ''
    try {
        const res = await callFunction('auth', {
            action: 'register',
            code: inviteCode.value.trim(),
            nickname: userNickname.value.trim(),
        })
        if (res.success) {
            uni.vibrateShort({ type: 'medium' })
            // 直接使用 register 返回的用户信息，无需再调 getCurrentUser
            if (res.user) {
                saveAuthInfo(res.user)
                authorized.value = true
                userName.value = res.user.nickname
                redirectToHome()
            } else {
                // 已注册过的情况，走正常查询
                const userRes = await callFunction('auth', { action: 'getCurrentUser' })
                if (!loginWithUser(userRes)) errorMsg.value = '读取用户信息失败，请稍后重试'
            }
        } else {
            errorMsg.value = res.msg || '邀请码无效'
            uni.vibrateShort({ type: 'heavy' })
        }
    } catch (e) {
        console.error('register 失败:', e)
        errorMsg.value = friendlyError(e, '注册失败')
    } finally {
        registering.value = false
    }
}

const saveAuthInfo = user => {
    uni.setStorageSync('auth_user', {
        _id: user._id,
        openid: user.openid,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        role: user.role,
    })
}

const redirectToHome = () => {
    uni.switchTab({ url: '/pages/home/home' })
}
</script>

<style scoped>
.login-page {
    min-height: 100vh;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64rpx 48rpx;
    box-sizing: border-box;
}
.login-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

/* Logo */
.logo-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 64rpx;
}
.logo-mark {
    width: 148rpx;
    height: 148rpx;
    border-radius: 50%;
    padding: 8rpx;
    box-sizing: border-box;
    background: var(--grad-sunset);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 30rpx 60rpx -28rpx rgba(160, 100, 110, 0.65);
    margin-bottom: 40rpx;
}
.logo-mark-emoji {
    width: 132rpx;
    height: 132rpx;
    line-height: 132rpx;
    text-align: center;
    border-radius: 50%;
    background: #fffaf7;
    font-size: 68rpx;
}
.logo-mark--pulse {
    animation: logo-breathe 2.4s ease-in-out infinite;
}
@keyframes logo-breathe {
    0%,
    100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.06);
    }
}
.logo-eyebrow {
    letter-spacing: 0.42em;
}
.logo-text {
    font-family: var(--font-serif);
    font-size: 132rpx;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: 0.12em;
    line-height: 1.1;
    margin-top: 16rpx;
    margin-right: -0.12em;
}
.logo-text--welcome {
    font-size: 88rpx;
    letter-spacing: 0.08em;
    margin-right: -0.08em;
}
.logo-rule {
    width: 64rpx;
    height: 4rpx;
    border-radius: 999rpx;
    background: var(--ink);
    margin: 28rpx 0 24rpx;
}
.logo-subtitle {
    font-size: 26rpx;
    color: var(--ink-2);
    margin-top: 12rpx;
    letter-spacing: 0.12em;
}

/* Input area：毛玻璃卡片 */
.input-area {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 48rpx 40rpx 40rpx;
    box-sizing: border-box;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
}
.field-label {
    font-size: 18rpx;
    letter-spacing: 0.3em;
    color: var(--muted);
    font-weight: 600;
    margin: 0 0 14rpx 8rpx;
}
.code-input {
    width: 100%;
    height: 112rpx;
    font-family: var(--font-serif);
    font-size: 44rpx;
    font-weight: 700;
    color: var(--ink);
    background: rgba(255, 255, 255, 0.85);
    border: 1rpx solid var(--line);
    border-radius: var(--r-m);
    text-align: center;
    letter-spacing: 0.4em;
    margin-bottom: 36rpx;
    box-sizing: border-box;
}
.code-input:focus {
    border-color: var(--ink);
}
.nickname-input {
    height: 96rpx;
    margin-bottom: 40rpx;
    font-family: var(--font-sans);
    font-size: 28rpx;
    font-weight: 500;
    letter-spacing: 0.08em;
}

/* Button */
.join-btn {
    width: 100%;
    height: 100rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    font-weight: 600;
    letter-spacing: 0.4em;
    box-shadow: 0 24rpx 44rpx -20rpx rgba(30, 26, 23, 0.65);
}
.join-btn.disabled {
    opacity: 0.3;
}

.error-hint {
    font-size: 24rpx;
    color: var(--coral);
    margin-top: 24rpx;
    text-align: center;
    line-height: 1.5;
}

/* First user */
.first-user-area {
    margin-top: 32rpx;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 40rpx;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.5);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.first-label {
    font-family: var(--font-serif);
    font-size: 30rpx;
    font-weight: 700;
    color: var(--ink);
    text-align: center;
    margin-bottom: 28rpx;
    letter-spacing: 0.08em;
}
.admin-input {
    height: 96rpx;
    margin-bottom: 0;
    font-family: var(--font-sans);
    font-size: 28rpx;
    font-weight: 500;
    letter-spacing: 0.08em;
}
.admin-btn {
    width: 100%;
    height: 96rpx;
    background: rgba(255, 255, 255, 0.85);
    color: var(--ink);
    border: 1rpx solid var(--line);
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.2em;
    margin-top: 24rpx;
    box-sizing: border-box;
}
.admin-btn.disabled {
    opacity: 0.4;
}

.login-foot {
    margin-top: 56rpx;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.1em;
}

.loading-text {
    font-size: 22rpx;
    color: var(--muted);
    margin-top: 32rpx;
    letter-spacing: 0.3em;
}
</style>
