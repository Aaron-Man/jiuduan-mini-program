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
        <!-- 顶部个人档案 Hero -->
        <view class="profile-hero">
            <view class="hero-bg-decor"></view>
            <view class="hero-bg-decor small"></view>
            <view class="profile-row">
                <view class="avatar-wrap" @tap="chooseAvatar">
                    <image v-if="avatarUrl" :src="avatarUrl" class="avatar-img" mode="aspectFill" />
                    <view v-else class="avatar-placeholder">
                        <text class="avatar-emoji">👤</text>
                    </view>
                    <view class="avatar-ring"></view>
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
        <view class="group">
            <view class="group-card">
                <view class="cell" @tap="goTo('/pages/period/period')">
                    <text class="cell-icon">🌸</text>
                    <text class="cell-label">经期管理</text>
                    <view class="cell-value">
                        <text class="cell-arrow">›</text>
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell">
                    <text class="cell-icon">🏷️</text>
                    <text class="cell-label">昵称</text>
                    <input class="cell-input" v-model="displayName" placeholder="你的昵称" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell">
                    <text class="cell-icon">💑</text>
                    <text class="cell-label">空间名称</text>
                    <input class="cell-input" v-model="coupleName" placeholder="我们的小窝" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell" @tap="showDatePicker = true">
                    <text class="cell-icon">📅</text>
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
        <view class="group" v-if="isAdmin">
            <view class="group-card">
                <view class="cell" @tap="goTo('/pages/members/members')">
                    <text class="cell-icon">👥</text>
                    <text class="cell-label">成员管理</text>
                    <view class="cell-value">
                        <text class="cell-hint-text">{{ totalMembers }} 人</text>
                        <text class="cell-arrow">›</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 分组：通知管理 -->
        <view class="group">
            <view class="group-card">
                <view class="cell no-input" @tap="showNotifications = !showNotifications">
                    <text class="cell-icon">🔔</text>
                    <text class="cell-label">通知管理</text>
                    <view class="cell-value">
                        <text class="cell-hint-text">已订阅 {{ subscribedTypes.length }} 项</text>
                        <text class="group-chevron" :class="{ open: showNotifications }">›</text>
                    </view>
                </view>
                <template v-if="showNotifications">
                    <view class="cell-divider"></view>
                    <view
                        class="cell no-input"
                        v-for="nt in NOTIFY_TYPES"
                        :key="nt.key"
                        @tap="handleSubscribe(nt.key)"
                        :class="{ subscribed: subscribedTypes.includes(nt.key) }"
                    >
                        <text class="cell-icon">{{ nt.icon }}</text>
                        <view class="cell-label-wrap">
                            <text class="cell-label">{{ nt.name }}</text>
                            <text class="cell-desc">{{ nt.desc }}</text>
                        </view>
                        <view class="cell-value">
                            <text class="sub-status" v-if="subscribedTypes.includes(nt.key)">已订阅</text>
                            <text class="sub-action" v-else>点击订阅</text>
                            <text class="cell-arrow">›</text>
                        </view>
                    </view>
                </template>
            </view>
            <text class="notify-hint" v-if="showNotifications">订阅后可在微信收到相关通知提醒，再次点击可取消</text>
        </view>

        <!-- 分组：外观 -->
        <view class="group">
            <view class="group-card">
                <view class="cell no-input" @tap="goTo('/pages/settings/background')">
                    <text class="cell-icon">🎨</text>
                    <text class="cell-label">背景设置</text>
                    <view class="cell-value">
                        <text class="cell-hint-text" v-if="isPresetBg">{{ bgPresetName }}</text>
                        <text class="cell-hint-text" v-else-if="isCustomImage">自定义图片</text>
                        <text class="cell-hint-text" v-else>默认</text>
                        <text class="cell-arrow">›</text>
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell no-input" @tap="handleClearCache">
                    <text class="cell-icon">🗑️</text>
                    <text class="cell-label">清除缓存</text>
                    <view class="cell-value">
                        <text class="cell-arrow">›</text>
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell no-input">
                    <text class="cell-icon">📱</text>
                    <text class="cell-label">版本</text>
                    <view class="cell-value">
                        <text>1.0.0</text>
                    </view>
                </view>
            </view>
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
    background: #f2f2f7;
}
.page-scroll--transparent {
    background: transparent;
}

/* ===== Profile Hero ===== */
.profile-hero {
    position: relative;
    padding: 80rpx 44rpx 48rpx;
    overflow: hidden;
}
.hero-bg-decor {
    position: absolute;
    top: -120rpx;
    right: -60rpx;
    width: 400rpx;
    height: 400rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
}
.hero-bg-decor.small {
    top: auto;
    bottom: -80rpx;
    right: auto;
    left: -60rpx;
    width: 240rpx;
    height: 240rpx;
    background: rgba(255, 255, 255, 0.04);
}
.profile-row {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 36rpx;
}
.avatar-wrap {
    position: relative;
    flex-shrink: 0;
}
.avatar-img {
    width: 128rpx;
    height: 128rpx;
    border-radius: 64rpx;
}
.avatar-placeholder {
    width: 128rpx;
    height: 128rpx;
    border-radius: 64rpx;
    background: linear-gradient(135deg, #c7c7cc 0%, #aeaeb2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
}
.avatar-emoji {
    font-size: 52rpx;
}
.avatar-ring {
    position: absolute;
    top: -4rpx;
    left: -4rpx;
    right: -4rpx;
    bottom: -4rpx;
    border-radius: 68rpx;
    border: 2rpx solid rgba(255, 255, 255, 0.35);
}
.camera-dot {
    position: absolute;
    bottom: 2rpx;
    right: 2rpx;
    width: 40rpx;
    height: 40rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}
.camera-icon {
    font-size: 20rpx;
}
.profile-text {
    flex: 1;
}
.name-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
}
.profile-name {
    font-size: 38rpx;
    font-weight: 700;
    color: #1c1c1e;
    letter-spacing: 1rpx;
    text-shadow: 0 1rpx 4rpx rgba(255, 255, 255, 0.3);
}
.role-tag {
    padding: 4rpx 14rpx;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 14rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.2);
}
.role-tag-text {
    font-size: 20rpx;
    color: #636366;
    font-weight: 500;
}
.profile-sub {
    font-size: 26rpx;
    color: #636366;
    display: block;
    margin-top: 10rpx;
    letter-spacing: 1rpx;
    text-shadow: 0 1rpx 3rpx rgba(255, 255, 255, 0.2);
}

/* ===== Group ===== */
.group {
    padding: 32rpx 32rpx 0;
}
.group-label {
    font-size: 22rpx;
    color: #8e8e93;
    display: block;
    margin-bottom: 10rpx;
    margin-left: 8rpx;
    letter-spacing: 2rpx;
    font-weight: 500;
    text-transform: uppercase;
}
.group-chevron {
    font-size: 26rpx;
    color: #8e8e93;
    transform: rotate(90deg);
    transition: transform 0.25s ease;
    margin-left: 8rpx;
}
.group-chevron.open {
    transform: rotate(-90deg);
}
.cell-hint-text {
    font-size: 24rpx;
    color: #636366;
}
.group-card {
    background: rgba(255, 255, 255, 0.45);
    border-radius: 20rpx;
    overflow: hidden;
    box-shadow: 0 1rpx 12rpx rgba(0, 0, 0, 0.03);
    border: 1rpx solid rgba(255, 255, 255, 0.5);
}

/* ===== Cell ===== */
.cell {
    display: flex;
    align-items: center;
    padding: 26rpx 28rpx;
    gap: 16rpx;
}
.cell.no-input {
    pointer-events: auto;
}
.cell-icon {
    font-size: 30rpx;
    flex-shrink: 0;
    width: 44rpx;
    text-align: center;
}
.cell-label {
    font-size: 28rpx;
    color: #1c1c1e;
    flex-shrink: 0;
    letter-spacing: 0.5rpx;
}
.cell-input {
    flex: 1;
    text-align: right;
    font-size: 28rpx;
    color: #3a3a3c;
    background: transparent;
    border: none;
    padding: 0;
}
.cell-value {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6rpx;
    font-size: 26rpx;
    color: #636366;
}
.cell-arrow {
    font-size: 30rpx;
    color: #c7c7cc;
    margin-left: 2rpx;
}
.cell-divider {
    height: 1rpx;
    background: rgba(60, 60, 67, 0.06);
    margin: 0 28rpx;
}

/* ===== Bottom ===== */
.bottom-space {
    height: 80rpx;
}

/* ===== Notify ===== */
.sub-status {
    font-size: 24rpx;
    color: #34c759;
}
.sub-action {
    font-size: 24rpx;
    color: #007aff;
}
.cell-label-wrap {
    flex: 1;
    min-width: 0;
}
.cell-desc {
    font-size: 22rpx;
    color: #8e8e93;
    display: block;
    margin-top: 4rpx;
}
.notify-hint {
    font-size: 22rpx;
    color: #8e8e93;
    display: block;
    margin-top: 10rpx;
    margin-left: 8rpx;
    letter-spacing: 0.5rpx;
}
</style>
