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
/* ================================================================
 * 设计系统 · 奶油杂志风（Cream Editorial）
 * 全局 CSS 变量可在任意页面 / 组件中通过 var(--xxx) 使用
 * ================================================================ */
page {
    /* 墨色与文字 */
    --ink: #1e1a17;
    --ink-2: #4a433d;
    --muted: #9a918a;
    --faint: #c9c1b9;
    --line: rgba(30, 26, 23, 0.08);

    /* 底色与卡片 */
    --bg: #f7f3ee;
    --bg-2: #efe8e0;
    --card: rgba(255, 255, 255, 0.72);
    --card-solid: #ffffff;
    --card-border: rgba(255, 255, 255, 0.85);

    /* 马卡龙点缀色 */
    --peach: #f4c7b4;
    --rose: #ebb2b8;
    --lilac: #d4c8f0;
    --sage: #c9dfcf;
    --sky: #c7dbf2;
    --butter: #f5e3b3;
    --coral: #e07a5f;
    --plum: #6b4e71;

    /* 渐变 */
    --grad-sunset: linear-gradient(135deg, #f9d7c3 0%, #f2b8c0 48%, #d6c5f2 100%);
    --grad-dawn: linear-gradient(135deg, #fde9d9 0%, #f8d3d8 100%);
    --grad-mint: linear-gradient(135deg, #e3f1e6 0%, #cfe3f3 100%);
    --grad-ink: linear-gradient(135deg, #2a2420 0%, #4a3f38 100%);

    /* 圆角与阴影 */
    --r-xl: 48rpx;
    --r-l: 36rpx;
    --r-m: 24rpx;
    --r-s: 16rpx;
    --shadow: 0 24rpx 60rpx -24rpx rgba(80, 56, 36, 0.22), 0 2rpx 8rpx rgba(80, 56, 36, 0.04);
    --shadow-soft: 0 12rpx 36rpx -16rpx rgba(80, 56, 36, 0.18);

    /* 字体 */
    --font-serif: 'Didot', 'Bodoni 72', 'Playfair Display', 'Times New Roman', 'Songti SC', 'STSongti-SC-Regular', serif;
    --font-sans: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif;

    background-color: var(--bg);
    height: 100%;
    font-size: 28rpx;
    font-family: var(--font-sans);
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
    line-height: 1.6;
}

/* #ifdef H5 */
/* H5 预览：页面容器透明，让 page-bg 的氛围色块显示出来（小程序端 page 即根节点，无需处理） */
body {
    background-color: #f7f3ee;
}
uni-page-body,
uni-page-wrapper {
    background-color: transparent !important;
}
/* #endif */

/* ===== 排版 ===== */
.ui-serif {
    font-family: var(--font-serif);
    letter-spacing: -0.01em;
}
.ui-eyebrow {
    font-size: 20rpx;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
}
.ui-title {
    font-family: var(--font-serif);
    font-size: 56rpx;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.15;
}
.ui-sub {
    font-size: 24rpx;
    color: var(--muted);
}

/* ===== 卡片 / 标签 / 按钮 ===== */
.ui-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-l);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.ui-chip {
    display: inline-flex;
    align-items: center;
    gap: 8rpx;
    padding: 10rpx 24rpx;
    border-radius: 999rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
}
.ui-chip.active {
    background: var(--ink);
    color: #fff;
    border-color: var(--ink);
}
.ui-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    height: 96rpx;
    padding: 0 48rpx;
    border-radius: 999rpx;
    background: var(--ink);
    color: #fff;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.ui-btn--ghost {
    background: rgba(255, 255, 255, 0.7);
    color: var(--ink);
    border: 1rpx solid var(--line);
    box-shadow: none;
}
.ui-btn.disabled,
.ui-btn--disabled {
    opacity: 0.4;
}
/* 管理员隐藏的内容：只有管理员能看到，带这个小标签 */
.ui-hidden-tag {
    display: inline-flex;
    align-items: center;
    font-size: 20rpx;
    line-height: 1.6;
    padding: 0 14rpx;
    border-radius: 999rpx;
    background: rgba(30, 26, 23, 0.08);
    color: var(--muted);
    letter-spacing: 0.06em;
    flex-shrink: 0;
}
/* 「显示在首页」的小标签 */
.ui-home-tag {
    display: inline-flex;
    align-items: center;
    font-size: 20rpx;
    line-height: 1.6;
    padding: 0 14rpx;
    border-radius: 999rpx;
    background: rgba(224, 122, 95, 0.12);
    color: var(--coral);
    letter-spacing: 0.06em;
    flex-shrink: 0;
}
/* 卡片上的「···」更多按钮 */
.ui-more {
    width: 60rpx;
    height: 48rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 30rpx;
    font-weight: 700;
    letter-spacing: 2rpx;
    line-height: 1;
    flex-shrink: 0;
}
.ui-more:active {
    background: rgba(30, 26, 23, 0.06);
}
.ui-press {
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s;
}
.ui-press:active {
    transform: scale(0.96);
    opacity: 0.85;
}
/* 柔色图标气泡 */
.ui-bubble {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88rpx;
    height: 88rpx;
    border-radius: 30rpx;
    font-size: 40rpx;
}
.ui-bubble--peach { background: var(--peach); }
.ui-bubble--rose { background: var(--rose); }
.ui-bubble--lilac { background: var(--lilac); }
.ui-bubble--sage { background: var(--sage); }
.ui-bubble--sky { background: var(--sky); }
.ui-bubble--butter { background: var(--butter); }

/* 浮动的圆形 + 按钮 */
.ui-fab {
    position: fixed;
    right: 40rpx;
    bottom: calc(60rpx + env(safe-area-inset-bottom));
    width: 112rpx;
    height: 112rpx;
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 56rpx;
    font-weight: 300;
    box-shadow: 0 24rpx 48rpx -16rpx rgba(30, 26, 23, 0.55);
    z-index: 50;
}

/* ===== 动效 ===== */
@keyframes ui-fade-up {
    from { opacity: 0; transform: translateY(32rpx); }
    to { opacity: 1; transform: translateY(0); }
}
.ui-fade-up {
    /* backwards：播完后不再影响元素的 transform（拖拽排序依赖内联 transform） */
    animation: ui-fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
.ui-d1 { animation-delay: 0.06s; }
.ui-d2 { animation-delay: 0.12s; }
.ui-d3 { animation-delay: 0.18s; }
.ui-d4 { animation-delay: 0.24s; }
.ui-d5 { animation-delay: 0.3s; }
.ui-d6 { animation-delay: 0.36s; }

/* ===== 兼容各页面已有的全局类名（统一为新风格） ===== */
.card {
    background: var(--card);
    border-radius: var(--r-l);
    padding: 32rpx;
    box-shadow: var(--shadow);
    margin-bottom: 24rpx;
    border: 1rpx solid var(--card-border);
}
.input {
    width: 100%;
    padding: 24rpx 28rpx;
    background: rgba(255, 255, 255, 0.8);
    border-radius: var(--r-m);
    font-size: 28rpx;
    box-sizing: border-box;
    color: var(--ink);
    border: 1rpx solid var(--line);
}
.submit-btn {
    margin-top: 32rpx;
    height: 96rpx;
    line-height: 96rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    text-align: center;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.06em;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.submit-btn.disabled {
    opacity: 0.4;
}
.form-label {
    font-size: 24rpx;
    font-weight: 600;
    color: var(--ink-2);
    margin-bottom: 12rpx;
    letter-spacing: 0.04em;
}
.page-header {
    margin-bottom: 32rpx;
    padding: 8rpx 0;
}
.page-title {
    font-family: var(--font-serif);
    font-size: 52rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
}
.page-desc {
    font-size: 24rpx;
    color: var(--muted);
    display: block;
    margin-top: 8rpx;
}
.loading,
.empty,
.empty-state {
    text-align: center;
    padding: 120rpx 0;
}
.empty-icon {
    font-size: 88rpx;
    display: block;
}
.empty-text {
    font-size: 28rpx;
    color: var(--muted);
    display: block;
    margin-top: 16rpx;
    letter-spacing: 0.04em;
}

/* ================================================================
 * 照片背景模式：页面根节点带 photo-mode（useSharedBg().isPhotoBg）
 *  - 直接压在照片上的标题、说明文字：白字 + 柔和阴影
 *  - 卡片：磨砂玻璃（透出模糊后的照片颜色），卡片里的文字保持深色
 *  - 页面里自己的卡片容器加 photo-glass 类即可得到同样的玻璃效果
 * ================================================================ */
.photo-mode {
    --photo-text: #fffaf5;
    --photo-text-2: rgba(255, 250, 245, 0.82);
    --photo-shadow: 0 2rpx 18rpx rgba(20, 14, 10, 0.35);
    --glass: rgba(255, 250, 244, 0.84);
    --glass-strong: rgba(255, 250, 244, 0.92);
    --glass-border: rgba(255, 255, 255, 0.7);
    --glass-shadow: 0 28rpx 64rpx -28rpx rgba(20, 14, 10, 0.55);
}
/* 类名重复一次提高优先级：页面 scoped 样式和这里同级且后加载，否则会盖掉玻璃效果 */
.photo-mode .ui-card.ui-card,
.photo-mode .card.card,
.photo-mode .photo-glass.photo-glass {
    background: var(--glass);
    border: 1rpx solid var(--glass-border);
    box-shadow: var(--glass-shadow);
    backdrop-filter: blur(24px) saturate(1.5);
    -webkit-backdrop-filter: blur(24px) saturate(1.5);
}
.photo-mode .ui-title,
.photo-mode .page-title {
    color: var(--photo-text);
    text-shadow: var(--photo-shadow);
}
.photo-mode .ui-eyebrow {
    color: var(--photo-text-2);
    text-shadow: var(--photo-shadow);
}
.photo-mode .ui-sub,
.photo-mode .page-desc {
    color: var(--photo-text-2);
    text-shadow: var(--photo-shadow);
}
/* 卡片里的同类文字恢复深色 */
.photo-mode .ui-card .ui-eyebrow,
.photo-mode .photo-glass .ui-eyebrow,
.photo-mode .card .ui-eyebrow {
    color: var(--muted);
    text-shadow: none;
}
.photo-mode .ui-card .ui-sub,
.photo-mode .photo-glass .ui-sub,
.photo-mode .card .ui-sub,
.photo-mode .ui-card .ui-title,
.photo-mode .photo-glass .ui-title {
    color: var(--ink-2);
    text-shadow: none;
}
/* 照片上的标签和描边按钮：玻璃底，避免透明地飘在照片上 */
.photo-mode .ui-chip.ui-chip,
.photo-mode .ui-btn--ghost.ui-btn--ghost {
    background: var(--glass-strong);
    border-color: transparent;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}
.photo-mode .ui-chip.ui-chip.active {
    background: var(--ink);
    color: #fff;
}
/* 空状态用玻璃面板 + 深色文字：照片中间往往是人物等细节，白字压在上面读不清 */
.photo-mode .photo-empty.photo-empty {
    margin-left: 32rpx;
    margin-right: 32rpx;
    border-radius: var(--r-xl);
    background: var(--glass);
    border: 1rpx solid var(--glass-border);
    box-shadow: var(--glass-shadow);
    backdrop-filter: blur(24px) saturate(1.5);
    -webkit-backdrop-filter: blur(24px) saturate(1.5);
}
.photo-mode .photo-empty.photo-empty .empty-title {
    color: var(--ink);
    text-shadow: none;
}
.photo-mode .photo-empty.photo-empty .empty-text,
.photo-mode .photo-empty.photo-empty .empty-hint,
.photo-mode .photo-empty.photo-empty .empty-tip {
    color: var(--muted);
    text-shadow: none;
}
</style>
