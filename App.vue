<script setup>
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { callFunction, CLOUD_ENV, initGlobalBg } from './utils/cloud'

onLaunch(() => {
    console.log('猪猪 App Launch')

    // 初始化云开发环境
    if (wx.cloud) {
        wx.cloud.init({
            env: CLOUD_ENV,
            traceUser: true,
        })
        console.log('云开发初始化成功')
    }

    // 一次性加载全局共享背景，所有页面共用，避免每次进入页面重复加载
    initGlobalBg()

    // 检查用户权限，决定进入首页还是登录页
    checkUserAuth()
})

const checkUserAuth = async () => {
    try {
        const cached = uni.getStorageSync('auth_user')
        if (cached && cached._id) {
            // 缓存优先：老用户直接进入首页，后台静默验证
            backgroundVerify(cached)
            return
        }

        // 无缓存，尝试云端检查是否已授权（如首次授权后重新打开）
        const res = await callFunction('auth', { action: 'checkAuth' })
        if (res.authorized) {
            uni.setStorageSync('auth_user', {
                _id: res.user._id,
                openid: res.user.openid,
                nickname: res.user.nickname,
                avatar_url: res.user.avatar_url,
                role: res.user.role,
            })
            return
        }

        // 未授权，跳转登录页
        uni.reLaunch({ url: '/pages/login/login' })
    } catch (e) {
        console.error('权限检查失败:', e)
        // 网络异常时，如果有缓存也允许进入
        const cached = uni.getStorageSync('auth_user')
        if (cached && cached._id) return
        uni.reLaunch({ url: '/pages/login/login' })
    }
}

// 后台静默验证，不阻塞用户操作
const backgroundVerify = async cachedUser => {
    try {
        const res = await callFunction('auth', { action: 'getCurrentUser' })
        if (!res.success) {
            // 缓存失效，清除并跳转登录
            uni.removeStorageSync('auth_user')
            uni.reLaunch({ url: '/pages/login/login' })
        } else if (res.user) {
            // 同步最新用户信息到缓存
            uni.setStorageSync('auth_user', {
                _id: res.user._id,
                openid: res.user.openid,
                nickname: res.user.nickname || cachedUser.nickname,
                avatar_url: res.user.avatar_url || cachedUser.avatar_url,
                role: res.user.role || cachedUser.role,
            })
        }
    } catch (e) {
        // 网络异常不影响，继续使用缓存
        console.warn('后台验证失败，使用缓存:', e)
    }
}

onShow(() => {
    console.log('猪猪 App Show')
})

onHide(() => {
    console.log('App Hide')
})
</script>

<style>
/* ===== 温暖私密设计系统 ===== */
page {
    background-color: #f5f3f0;
    height: 100%;
    font-size: 28rpx;
    font-family:
        -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Serif SC', 'Source Han Serif SC', 'Helvetica Neue',
        sans-serif;
    color: #2d2d2d;
    -webkit-font-smoothing: antialiased;
    line-height: 1.6;
}

/* 通用容器 */
.container {
    padding: 32rpx;
}

/* 卡片 - 温暖风格 */
.card {
    background: #fff;
    border-radius: 28rpx;
    padding: 32rpx;
    box-shadow: 0 4rpx 24rpx rgba(45, 45, 45, 0.04);
    margin-bottom: 24rpx;
    border: 1rpx solid rgba(201, 169, 149, 0.08);
}

/* 主按钮 - 深色优雅 */
.btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 22rpx 48rpx;
    background: linear-gradient(135deg, #2d2d2d 0%, #3d3d3d 100%);
    color: #f5f3f0;
    border-radius: 28rpx;
    font-size: 30rpx;
    font-weight: 500;
    border: none;
    letter-spacing: 2rpx;
}

.btn-primary::after {
    border: none;
}

/* 强调按钮 - 玫瑰金 */
.btn-accent {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 22rpx 48rpx;
    background: linear-gradient(135deg, #c9a995 0%, #d4b5a0 100%);
    color: #fff;
    border-radius: 28rpx;
    font-size: 30rpx;
    font-weight: 500;
    border: none;
    letter-spacing: 2rpx;
}

.btn-accent::after {
    border: none;
}

/* 文字颜色 */
.text-muted {
    color: #8b8b8b;
}

.text-primary {
    color: #2d2d2d;
}

.text-accent {
    color: #c9a995;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 120rpx 0;
}

.empty-text {
    font-size: 28rpx;
    color: #8b8b8b;
    margin-top: 24rpx;
    letter-spacing: 1rpx;
}

/* 页面标题统一样式 */
.page-header {
    margin-bottom: 32rpx;
    padding: 8rpx 0;
}

.page-title {
    font-size: 44rpx;
    font-weight: 700;
    color: #2d2d2d;
    display: block;
    letter-spacing: 2rpx;
}

.page-desc {
    font-size: 24rpx;
    color: #8b8b8b;
    display: block;
    margin-top: 8rpx;
    letter-spacing: 1rpx;
}

/* 输入框统一样式 */
.input {
    width: 100%;
    padding: 22rpx 24rpx;
    background: #faf8f6;
    border-radius: 20rpx;
    font-size: 28rpx;
    box-sizing: border-box;
    color: #2d2d2d;
    border: 1rpx solid rgba(201, 169, 149, 0.12);
}

/* 提交按钮统一样式 */
.submit-btn {
    margin-top: 32rpx;
    padding: 24rpx;
    background: linear-gradient(135deg, #2d2d2d 0%, #3d3d3d 100%);
    color: #f5f3f0;
    border-radius: 24rpx;
    text-align: center;
    font-size: 30rpx;
    letter-spacing: 2rpx;
}

.submit-btn.disabled {
    opacity: 0.4;
}

/* 表单标签 */
.form-label {
    font-size: 26rpx;
    font-weight: 600;
    color: #2d2d2d;
    margin-bottom: 12rpx;
    letter-spacing: 1rpx;
}

/* 加载/空状态 */
.loading,
.empty {
    text-align: center;
    padding: 120rpx 0;
}

.empty-icon {
    font-size: 72rpx;
    display: block;
}

.empty-text {
    font-size: 28rpx;
    color: #8b8b8b;
    display: block;
    margin-top: 16rpx;
    letter-spacing: 1rpx;
}
</style>
