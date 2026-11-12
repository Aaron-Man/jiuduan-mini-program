<template>
    <view class="login-page">
        <!-- 状态：检查中 -->
        <view v-if="checking" class="login-center">
            <text class="logo-text">猪猪</text>
            <text class="loading-text">正在验证...</text>
        </view>

        <!-- 状态：未授权，需要邀请码 -->
        <view v-else-if="!authorized" class="login-center">
            <view class="logo-area">
                <text class="logo-text">猪猪</text>
                <text class="logo-subtitle">输入邀请码加入空间</text>
            </view>

            <view class="input-area">
                <input
                    class="code-input"
                    v-model="inviteCode"
                    placeholder="请输入6位邀请码"
                    maxlength="6"
                    :focus="true"
                    @confirm="handleRegister"
                />
                <input
                    class="code-input nickname-input"
                    v-model="userNickname"
                    placeholder="输入你的昵称（可选）"
                    maxlength="20"
                    @confirm="handleRegister"
                />
                <view
                    class="join-btn"
                    @tap="handleRegister"
                    :class="{ disabled: registering || inviteCode.trim().length !== 6 }"
                >
                    <text>{{ registering ? '加入中...' : '进入' }}</text>
                </view>
                <text class="error-hint" v-if="errorMsg">{{ errorMsg }}</text>
            </view>

            <!-- 首次用户：创建管理员 -->
            <view class="first-user-area" v-if="isFirstUser && !networkError">
                <text class="first-label">你是第一个到来的人</text>
                <input class="code-input" v-model="adminNickname" placeholder="输入你的昵称" maxlength="20" />
                <view
                    class="admin-btn"
                    @tap="handleInitAdmin"
                    :class="{ disabled: initializing || !adminNickname.trim() }"
                >
                    <text>{{ initializing ? '创建中...' : '成为管理员' }}</text>
                </view>
            </view>

            <!-- 网络异常提示 -->
            <view class="first-user-area" v-if="networkError">
                <text class="first-label">网络异常，请检查网络后重试</text>
                <view class="admin-btn" @tap="retryCheck">
                    <text>重试</text>
                </view>
            </view>
        </view>

        <!-- 状态：已授权，跳转中 -->
        <view v-else class="login-center">
            <text class="logo-text">欢迎回来</text>
            <text class="logo-subtitle">{{ userName }}</text>
            <text class="loading-text">正在进入...</text>
        </view>
    </view>
</template>

<script setup>
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
    background: #f2f2f7;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64rpx;
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
    margin-bottom: 80rpx;
}
.logo-text {
    font-size: 56rpx;
    font-weight: 700;
    color: #1c1c1e;
    letter-spacing: 8rpx;
}
.logo-subtitle {
    font-size: 26rpx;
    color: #8e8e93;
    margin-top: 12rpx;
    letter-spacing: 2rpx;
}

/* Input area */
.input-area {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.code-input {
    width: 100%;
    height: 96rpx;
    font-size: 34rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    border-bottom: 2rpx solid #c7c7cc;
    text-align: center;
    letter-spacing: 8rpx;
    margin-bottom: 48rpx;
}
.code-input:focus {
    border-bottom-color: #1c1c1e;
}
.nickname-input {
    margin-bottom: 32rpx;
    font-size: 28rpx;
    letter-spacing: 2rpx;
}

/* Button */
.join-btn {
    width: 100%;
    height: 88rpx;
    background: #1c1c1e;
    color: #f2f2f7;
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    font-weight: 500;
    letter-spacing: 4rpx;
}
.join-btn.disabled {
    opacity: 0.3;
}

.error-hint {
    font-size: 24rpx;
    color: #ff3b30;
    margin-top: 24rpx;
    text-align: center;
}

/* First user */
.first-user-area {
    margin-top: 80rpx;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.first-label {
    font-size: 24rpx;
    color: #8e8e93;
    margin-bottom: 24rpx;
    letter-spacing: 2rpx;
}
.admin-btn {
    width: 100%;
    height: 88rpx;
    background: #8e8e93;
    color: #fff;
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 500;
    letter-spacing: 4rpx;
    margin-top: 24rpx;
}
.admin-btn.disabled {
    opacity: 0.4;
}

.loading-text {
    font-size: 26rpx;
    color: #8e8e93;
    margin-top: 24rpx;
    letter-spacing: 1rpx;
}
</style>
