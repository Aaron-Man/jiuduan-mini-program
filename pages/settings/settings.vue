<template>
    <page-bg overlay="light" tone="sunset" />
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
            <text class="ui-eyebrow">SETTINGS</text>
            <text class="ui-title mast-title">设置</text>
            <text class="ui-sub mast-sub">打理属于你们的小空间</text>
        </view>

        <!-- 顶部个人档案 Hero -->
        <view class="profile-hero ui-fade-up ui-d1">
            <view class="hero-bg-decor"></view>
            <view class="hero-bg-decor small"></view>
            <view class="profile-row">
                <view class="avatar-wrap ui-press" @tap="chooseAvatar">
                    <view class="avatar-ring"></view>
                    <image v-if="avatarUrl" :src="avatarUrl" class="avatar-img" mode="aspectFill" />
                    <view v-else class="avatar-placeholder">
                        <text class="avatar-emoji">👤</text>
                    </view>
                    <view class="camera-dot">
                        <text class="camera-icon">📷</text>
                    </view>
                </view>
                <view class="profile-text">
                    <view class="name-row">
                        <text class="profile-name">{{ displayName || '未设置昵称' }}</text>
                        <view class="role-tag" v-if="isAdmin">
                            <text class="role-tag-text">管理员</text>
                        </view>
                    </view>
                    <text class="profile-sub" v-if="daysTogether > 0 && coupleName"
                        >💕 {{ coupleName }} · 在一起 {{ daysTogether }} 天</text
                    >
                    <text class="profile-sub" v-else-if="daysTogether > 0">💕 在一起 {{ daysTogether }} 天</text>
                    <text class="profile-sub" v-else-if="coupleName">{{ coupleName }}</text>
                    <text class="profile-sub" v-else>点击编辑你的空间</text>
                </view>
            </view>
        </view>

        <!-- 分组：个人信息 -->
        <view class="group ui-fade-up ui-d2">
            <text class="group-label">PROFILE · 个人信息</text>
            <view class="group-card">
                <view class="cell ui-press" @tap="goTo('/pages/period/period')">
                    <text class="cell-icon ui-bubble--rose">🌸</text>
                    <text class="cell-label">经期管理</text>
                    <view class="cell-value">
                        <text class="cell-arrow">›</text>
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell">
                    <text class="cell-icon ui-bubble--butter">🏷️</text>
                    <text class="cell-label">昵称</text>
                    <input class="cell-input" v-model="displayName" placeholder="你的昵称" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell">
                    <text class="cell-icon ui-bubble--peach">💑</text>
                    <text class="cell-label">空间名称</text>
                    <input class="cell-input" v-model="coupleName" placeholder="我们的小窝" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell" @tap="showDatePicker = true">
                    <text class="cell-icon ui-bubble--sky">📅</text>
                    <text class="cell-label">纪念日</text>
                    <picker mode="date" :value="anniversaryDate" @change="anniversaryDate = $event.detail.value">
                        <view class="cell-value">
                            <text>{{ anniversaryDate || '选择日期' }}</text>
                            <text class="cell-arrow">›</text>
                        </view>
                    </picker>
                </view>
            </view>
        </view>

        <!-- 分组：成员管理（仅管理员） -->
        <view class="group ui-fade-up ui-d3" v-if="isAdmin">
            <text class="group-label">FAMILY · 家庭</text>
            <view class="group-card">
                <view class="cell ui-press" @tap="goTo('/pages/members/members')">
                    <text class="cell-icon ui-bubble--lilac">👥</text>
                    <text class="cell-label">成员管理</text>
                    <view class="cell-value">
                        <text class="cell-hint-text">{{ totalMembers }} 人</text>
                        <text class="cell-arrow">›</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 分组：通知管理 -->
        <view class="group ui-fade-up ui-d4">
            <text class="group-label">NOTIFICATIONS · 通知</text>
            <view class="group-card">
                <view class="cell no-input ui-press" @tap="showNotifications = !showNotifications">
                    <text class="cell-icon ui-bubble--butter">🔔</text>
                    <text class="cell-label">通知管理</text>
                    <view class="cell-value">
                        <text class="cell-hint-text">已订阅 {{ subscribedTypes.length }} 项</text>
                        <text class="group-chevron" :class="{ open: showNotifications }">›</text>
                    </view>
                </view>
                <template v-if="showNotifications">
                    <view class="cell-divider"></view>
                    <view
                        class="cell no-input notify-cell"
                        v-for="nt in NOTIFY_TYPES"
                        :key="nt.key"
                        @tap="handleSubscribe(nt.key)"
                        :class="{ subscribed: subscribedTypes.includes(nt.key) }"
                    >
                        <text class="cell-icon cell-icon--soft">{{ nt.icon }}</text>
                        <view class="cell-label-wrap">
                            <text class="cell-label">{{ nt.name }}</text>
                            <text class="cell-desc">{{ nt.desc }}</text>
                        </view>
                        <view class="cell-value">
                            <text class="sub-status" v-if="subscribedTypes.includes(nt.key)">已订阅</text>
                            <text class="sub-action" v-else>点击订阅</text>
                        </view>
                    </view>
                </template>
            </view>
            <text class="notify-hint" v-if="showNotifications">订阅后可在微信收到相关通知提醒，再次点击可取消</text>
        </view>

        <!-- 分组：外观 -->
        <view class="group ui-fade-up ui-d5">
            <text class="group-label">APPEARANCE · 外观与其他</text>
            <view class="group-card">
                <view class="cell no-input ui-press" @tap="goTo('/pages/settings/background')">
                    <text class="cell-icon ui-bubble--sage">🎨</text>
                    <text class="cell-label">背景设置</text>
                    <view class="cell-value">
                        <text class="cell-hint-text" v-if="isPresetBg">{{ bgPresetName }}</text>
                        <text class="cell-hint-text" v-else-if="isCustomImage">自定义图片</text>
                        <text class="cell-hint-text" v-else>默认</text>
                        <text class="cell-arrow">›</text>
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell no-input ui-press" @tap="handleClearCache">
                    <text class="cell-icon ui-bubble--peach">🗑️</text>
                    <text class="cell-label">清除缓存</text>
                    <view class="cell-value">
                        <text class="cell-arrow">›</text>
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell no-input">
                    <text class="cell-icon ui-bubble--sky">📱</text>
                    <text class="cell-label">版本</text>
                    <view class="cell-value">
                        <text class="version-text">1.0.0</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 底部署名 -->
        <view class="colophon ui-fade-up ui-d6">
            <text class="colophon-mark">猪猪</text>
            <text class="ui-eyebrow">OUR LITTLE HOME</text>
        </view>

        <!-- 底部留白 -->
        <view class="bottom-space"></view>
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed, onMounted, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import {
    getProfile,
    saveProfile,
    dbUpdate,
    uploadFile,
    callFunction,
    resolveFileUrl,
    useSharedBg,
    applyBgChange,
    clearPCache,
} from '../../utils/cloud'
import { NOTIFY_TYPES, BG_PRESETS } from '../../utils/constants'
import { useSubscription } from '../../utils/useSubscription'

const profile = ref(null)
const displayName = ref('')
const coupleName = ref('')
const anniversaryDate = ref('')
const avatarUrl = ref('')
const saving = ref(false)
const refreshing = ref(false)

// 背景从全局共享状态读取，App 启动时已加载，无需每次进入页面重新加载
const { bgImage, isPresetBg } = useSharedBg()

const isCustomImage = computed(() => bgImage.value && !bgImage.value.startsWith('color:'))
const bgPresetName = computed(() => {
    if (!isPresetBg.value) return ''
    const name = bgImage.value.replace('color:', '')
    const p = BG_PRESETS.find(p => p.value === name)
    return p ? p.name : name
})

// 用户管理（管理员功能）
const currentUser = ref(null)
const isAdmin = computed(() => currentUser.value?.role === 'admin')
const totalMembers = ref(0)

// 通知订阅状态
const { subscribedTypes, loadSubscription, handleSubscribe } = useSubscription()

// 折叠状态
const showNotifications = ref(false)

const daysTogether = computed(() => {
    if (!anniversaryDate.value) return 0
    return Math.floor((Date.now() - new Date(anniversaryDate.value).getTime()) / 86400000)
})

onMounted(() => {
    Promise.all([fetchProfile(), fetchCurrentUser()]).finally(markLoaded)
})

const onRefresh = async () => {
    refreshing.value = true
    await Promise.all([fetchProfile(), fetchCurrentUser()])
    markLoaded()
    refreshing.value = false
}

const fetchProfile = async () => {
    try {
        const p = await getProfile()
        if (p) {
            profile.value = p
            // coupleName 和 anniversaryDate 是共享数据，从 profiles 读取
            coupleName.value = p.couple_name || ''
            anniversaryDate.value = p.anniversary_date || ''
            // 同步背景图片设置（通过全局共享系统统一处理，自动通知其他页面）
            if (p.bg_image) {
                await applyBgChange(p.bg_image)
            }
            // 注意：display_name 和 avatar_url 是个人数据，从 authorized_users 读取
            // 不在此处设置，由 fetchCurrentUser 负责
        }
    } catch (e) {
        console.error(e)
    }
}

const chooseAvatar = () => {
    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: async res => {
            const tempPath = res.tempFilePaths[0]
            const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${tempPath.split('.').pop()}`
            try {
                const uploadRes = await uploadFile(cloudPath, tempPath)
                // 转换为临时链接用于显示
                avatarUrl.value = await resolveFileUrl(uploadRes.fileID)
                // 头像保存到 authorized_users（每人独立）
                if (currentUser.value) {
                    await callFunction('auth', { action: 'updateUser', avatar_url: uploadRes.fileID })
                    currentUser.value.avatar_url = uploadRes.fileID
                    uni.setStorageSync('auth_user', currentUser.value)
                }
                uni.showToast({ title: '头像已更新', icon: 'success' })
            } catch (e) {
                uni.showToast({ title: '头像上传失败', icon: 'none' })
            }
        },
    })
}

const goTo = url => {
    uni.navigateTo({ url })
}

// 自动保存：监听字段变化，防抖 1.5 秒
let saveTimer = null
// 首次加载完成前不自动保存：此时 profile 还是 null，保存会新建出重复的 profiles 文档
let loaded = false
// 上次保存（或加载）时的表单快照，用于跳过没有变化的保存
let lastSavedKey = ''
const formKey = () => JSON.stringify([displayName.value.trim(), coupleName.value.trim(), anniversaryDate.value || null])
const markLoaded = () => {
    lastSavedKey = formKey()
    loaded = true
}
const scheduleAutoSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => doSave(), 1500)
}

const doSave = async () => {
    if (!loaded) return
    // 正在保存时有新修改：稍后再保存一次，而不是丢弃
    if (saving.value) {
        scheduleAutoSave()
        return
    }
    const key = formKey()
    if (key === lastSavedKey) return
    saving.value = true
    try {
        const data = {
            couple_name: coupleName.value.trim(),
            anniversary_date: anniversaryDate.value || null,
            updateTime: new Date(),
        }
        if (profile.value) {
            await dbUpdate('profiles', profile.value._id, data)
        } else {
            profile.value = { _id: await saveProfile(data) }
        }
        // 清除首页档案缓存，确保返回首页时立即显示最新数据
        clearPCache('_homeProfile')
        if (displayName.value.trim() && currentUser.value) {
            try {
                await callFunction('auth', { action: 'updateUser', nickname: displayName.value.trim() })
                currentUser.value.nickname = displayName.value.trim()
                uni.setStorageSync('auth_user', currentUser.value)
            } catch (e) {
                console.warn('同步昵称失败:', e)
            }
        }
        lastSavedKey = key
    } catch (e) {
        console.warn('自动保存失败:', e)
    } finally {
        saving.value = false
    }
}

watch([displayName, coupleName, anniversaryDate], scheduleAutoSave)

onHide(() => {
    if (saveTimer) clearTimeout(saveTimer)
    doSave()
})

const handleClearCache = () => {
    uni.showModal({
        title: '确认',
        content: '确定清除本地缓存？',
        success: res => {
            if (res.confirm) {
                const authUser = uni.getStorageSync('auth_user')
                uni.clearStorageSync()
                if (authUser) {
                    uni.setStorageSync('auth_user', authUser)
                }
                uni.showToast({ title: '缓存已清除', icon: 'success' })
            }
        },
    })
}

// ===== 用户管理（管理员） =====
const fetchCurrentUser = async () => {
    try {
        const cached = uni.getStorageSync('auth_user')
        if (cached) currentUser.value = cached
        const res = await callFunction('auth', { action: 'getCurrentUser' })
        if (res.success) {
            currentUser.value = res.user
            uni.setStorageSync('auth_user', res.user)
            // 个人昵称和头像从 authorized_users 读取（每人独立）
            displayName.value = res.user.nickname || ''
            // 头像云文件 ID 需要转换为临时 URL 才能在 uni-app 中显示
            avatarUrl.value = res.user.avatar_url ? await resolveFileUrl(res.user.avatar_url) : ''
            // 加载订阅状态
            loadSubscription()
            // 如果是管理员，获取成员总数
            if (res.user.role === 'admin') fetchMemberCount()
        }
    } catch (e) {
        console.error('fetchCurrentUser:', e)
    }
}

const fetchMemberCount = async () => {
    try {
        const res = await callFunction('auth', { action: 'listUsers', skip: 0, limit: 1 })
        if (res.success) {
            totalMembers.value = res.total || res.users?.length || 0
        }
    } catch (e) {
        console.warn('fetchMemberCount:', e)
    }
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

/* ===== 标题区 ===== */
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

/* ===== Profile Hero ===== */
.profile-hero {
    position: relative;
    margin: 32rpx 32rpx 0;
    padding: 56rpx 40rpx 48rpx;
    overflow: hidden;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.hero-bg-decor {
    position: absolute;
    top: -160rpx;
    right: -120rpx;
    width: 420rpx;
    height: 420rpx;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(242, 184, 192, 0.55) 0%, rgba(242, 184, 192, 0) 70%);
}
.hero-bg-decor.small {
    top: auto;
    bottom: -120rpx;
    right: auto;
    left: -100rpx;
    width: 320rpx;
    height: 320rpx;
    background: radial-gradient(circle, rgba(214, 197, 242, 0.55) 0%, rgba(214, 197, 242, 0) 70%);
}
.profile-row {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}
.avatar-wrap {
    position: relative;
    flex-shrink: 0;
    width: 196rpx;
    height: 196rpx;
    border-radius: 50%;
    padding: 8rpx;
    box-sizing: border-box;
    background: var(--grad-sunset);
    box-shadow: 0 30rpx 60rpx -28rpx rgba(160, 100, 110, 0.6);
}
.avatar-img {
    width: 180rpx;
    height: 180rpx;
    border-radius: 50%;
    border: 6rpx solid #fff;
    box-sizing: border-box;
    display: block;
}
.avatar-placeholder {
    width: 180rpx;
    height: 180rpx;
    border-radius: 50%;
    border: 6rpx solid #fff;
    box-sizing: border-box;
    background: var(--bg-2);
    display: flex;
    align-items: center;
    justify-content: center;
}
.avatar-emoji {
    font-size: 76rpx;
}
.avatar-ring {
    position: absolute;
    top: -16rpx;
    left: -16rpx;
    right: -16rpx;
    bottom: -16rpx;
    border-radius: 50%;
    border: 2rpx dashed rgba(30, 26, 23, 0.12);
}
.camera-dot {
    position: absolute;
    bottom: 4rpx;
    right: 4rpx;
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: var(--ink);
    border: 4rpx solid #fff;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 16rpx -6rpx rgba(30, 26, 23, 0.5);
}
.camera-icon {
    font-size: 22rpx;
}
.profile-text {
    margin-top: 36rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.name-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14rpx;
}
.profile-name {
    font-family: var(--font-serif);
    font-size: 48rpx;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: 0.01em;
}
.role-tag {
    padding: 4rpx 18rpx;
    background: var(--ink);
    border-radius: 999rpx;
}
.role-tag-text {
    font-size: 20rpx;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.12em;
}
.profile-sub {
    font-size: 24rpx;
    color: var(--ink-2);
    display: block;
    margin-top: 14rpx;
    padding: 8rpx 24rpx;
    background: rgba(255, 255, 255, 0.7);
    border: 1rpx solid var(--line);
    border-radius: 999rpx;
    letter-spacing: 0.04em;
}

/* ===== Group ===== */
.group {
    padding: 44rpx 32rpx 0;
}
.group-label {
    font-size: 20rpx;
    color: var(--muted);
    display: block;
    margin-bottom: 16rpx;
    margin-left: 16rpx;
    letter-spacing: 0.24em;
    font-weight: 600;
}
.group-chevron {
    font-size: 30rpx;
    color: var(--faint);
    transform: rotate(90deg);
    transition: transform 0.25s ease;
    margin-left: 8rpx;
}
.group-chevron.open {
    transform: rotate(-90deg);
}
.cell-hint-text {
    font-size: 24rpx;
    color: var(--muted);
}
.group-card {
    background: var(--card);
    border-radius: var(--r-l);
    overflow: hidden;
    box-shadow: var(--shadow-soft);
    border: 1rpx solid var(--card-border);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}

/* ===== Cell ===== */
.cell {
    display: flex;
    align-items: center;
    padding: 24rpx 28rpx;
    gap: 22rpx;
    min-height: 72rpx;
}
.cell.no-input {
    pointer-events: auto;
}
.cell-icon {
    font-size: 30rpx;
    flex-shrink: 0;
    width: 64rpx;
    height: 64rpx;
    line-height: 64rpx;
    border-radius: 22rpx;
    text-align: center;
}
.cell-icon--soft {
    background: var(--bg-2);
}
.cell-label {
    font-size: 28rpx;
    color: var(--ink);
    font-weight: 500;
    flex-shrink: 0;
    letter-spacing: 0.02em;
}
.cell-input {
    flex: 1;
    text-align: right;
    font-size: 28rpx;
    color: var(--ink-2);
    background: transparent;
    border: none;
    padding: 0;
}
.cell-value {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8rpx;
    font-size: 26rpx;
    color: var(--ink-2);
}
.cell-arrow {
    font-size: 34rpx;
    color: var(--faint);
    margin-left: 4rpx;
    line-height: 1;
}
.cell-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 28rpx 0 114rpx;
}
.version-text {
    font-family: var(--font-serif);
    font-size: 28rpx;
    color: var(--muted);
    letter-spacing: 0.08em;
}

/* ===== Notify ===== */
.notify-cell.subscribed .cell-icon--soft {
    background: var(--sage);
}
.sub-status {
    font-size: 22rpx;
    font-weight: 600;
    color: #4f7a5b;
    background: var(--sage);
    padding: 8rpx 20rpx;
    border-radius: 999rpx;
    letter-spacing: 0.06em;
}
.sub-action {
    font-size: 22rpx;
    font-weight: 600;
    color: #fff;
    background: var(--ink);
    padding: 8rpx 20rpx;
    border-radius: 999rpx;
    letter-spacing: 0.06em;
}
.cell-label-wrap {
    flex: 1;
    min-width: 0;
}
.cell-desc {
    font-size: 22rpx;
    color: var(--muted);
    display: block;
    margin-top: 4rpx;
}
.notify-hint {
    font-size: 22rpx;
    color: var(--muted);
    display: block;
    margin-top: 14rpx;
    margin-left: 16rpx;
    letter-spacing: 0.02em;
}

/* ===== Colophon ===== */
.colophon {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 72rpx 0 0;
    opacity: 0.8;
}
.colophon-mark {
    font-family: var(--font-serif);
    font-size: 40rpx;
    font-weight: 700;
    color: var(--ink-2);
    margin-bottom: 6rpx;
}

/* ===== Bottom ===== */
.bottom-space {
    height: calc(80rpx + env(safe-area-inset-bottom));
}
</style>
