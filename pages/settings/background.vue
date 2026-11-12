<template>
    <!-- 页面背景跟随当前设置 -->
    <page-bg :image="bgImage" overlay="strong" />

    <scroll-view scroll-y class="page-scroll">
        <!-- 自定义导航栏 -->
        <view class="nav-bar" :style="{ paddingTop: navTop + 'px' }">
            <view class="nav-back" @tap="goBack">
                <text class="nav-back-icon">‹</text>
            </view>
            <text class="nav-title">背景设置</text>
            <view class="nav-placeholder"></view>
        </view>

        <!-- 当前背景预览 -->
        <view class="preview-card">
            <view
                class="preview-card-bg"
                v-if="bgImage && !isPresetBg"
                :style="{ backgroundImage: 'url(' + bgImage + ')' }"
            ></view>
            <view class="preview-card-bg" v-else-if="isPresetBg" :style="{ background: bgPresetStyle }"></view>
            <view class="preview-card-content">
                <text class="preview-card-label">{{ previewLabel }}</text>
                <view class="preview-card-action" v-if="bgImage" @tap="handleRemoveBg">
                    <text class="preview-card-action-text">恢复默认</text>
                </view>
            </view>
        </view>

        <!-- 选择颜色 -->
        <view class="panel">
            <text class="panel-title">选择颜色</text>
            <scroll-view scroll-x class="color-scroll" show-scrollbar="false">
                <view class="color-row">
                    <view
                        class="color-chip"
                        v-for="p in BG_PRESETS"
                        :key="p.value"
                        :class="{ active: selectedPreset === p.value }"
                        @tap="selectPreset(p)"
                    >
                        <view class="chip-dot" :style="{ background: p.style }"></view>
                        <text class="chip-name" :class="{ 'chip-name-active': selectedPreset === p.value }">{{
                            p.name
                        }}</text>
                    </view>
                </view>
            </scroll-view>
        </view>

        <!-- 自定义图片 -->
        <view class="panel">
            <text class="panel-title">自定义图片</text>
            <view class="img-grid">
                <view class="img-add" @tap="chooseBgImage">
                    <text class="img-add-icon">+</text>
                    <text class="img-add-text">上传图片</text>
                </view>
                <view class="img-item" v-for="(img, idx) in bgImages" :key="img" @tap="selectSavedImage(img)">
                    <image :src="resolvedBgMap[img] || ''" class="img-thumb" mode="aspectFill" lazy-load />
                    <view v-if="currentBgFileId === img" class="img-badge">
                        <text class="img-badge-icon">✓</text>
                    </view>
                    <view class="img-del" @tap.stop="removeSavedImage(img, idx)">
                        <text class="img-del-icon">×</text>
                    </view>
                </view>
            </view>
        </view>

        <text class="footer-hint">设置后将在首页、菜谱、点菜等页面展示</text>
        <view class="bottom-space"></view>
    </scroll-view>
</template>

<script setup>
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed, onMounted } from 'vue'
import {
    getProfile,
    dbUpdate,
    uploadFile,
    resolveFileUrl,
    getTempFileURL,
    applyBgChange,
    getGlobalBgRaw,
    getGlobalBgResolved,
} from '../../utils/cloud'
import { BG_COLOR_MAP, BG_PRESETS } from '../../utils/constants'

const bgImage = ref('')
const bgImages = ref([])
// 自定义导航栏顶部留白：与右上角胶囊按钮对齐，避开刘海屏状态栏（取不到时退回 30px）
const navTop = (() => {
    try {
        return uni.getMenuButtonBoundingClientRect().top || 30
    } catch (e) {
        return 30
    }
})()
const resolvedBgMap = ref({})
const currentBgFileId = ref('')

const selectedPreset = computed(() => {
    if (!bgImage.value || !bgImage.value.startsWith('color:')) return ''
    return bgImage.value.replace('color:', '')
})
const isCustomImage = computed(() => bgImage.value && !bgImage.value.startsWith('color:'))
const isPresetBg = computed(() => bgImage.value && bgImage.value.startsWith('color:'))
const bgPresetStyle = computed(() => {
    if (!isPresetBg.value) return ''
    return BG_COLOR_MAP[bgImage.value.replace('color:', '')] || '#f2f2f7'
})
const previewLabel = computed(() => {
    if (isCustomImage.value) return '自定义背景'
    if (selectedPreset.value) return presetName(selectedPreset.value)
    return '默认背景'
})

const presetName = val => {
    const p = BG_PRESETS.find(p => p.value === val)
    return p ? p.name : val
}

onMounted(() => {
    bgImage.value = getGlobalBgResolved()
    const raw = getGlobalBgRaw()
    if (raw && raw.startsWith('cloud://')) currentBgFileId.value = raw
    loadBgImages()
})

const loadBgImages = async () => {
    try {
        const p = await getProfile()
        if (p && Array.isArray(p.bg_images)) {
            bgImages.value = p.bg_images
            // 一次批量换取所有图片的临时 URL
            const map = {}
            const urls = await getTempFileURL(
                p.bg_images.filter(fid => typeof fid === 'string' && fid.startsWith('cloud://'))
            )
            urls.forEach(u => {
                if (u.tempFileURL) map[u.fileID] = u.tempFileURL
            })
            resolvedBgMap.value = map
        }
    } catch (e) {
        console.warn('加载图片库失败:', e)
    }
}

const selectPreset = async preset => {
    if (preset.value === 'none') {
        bgImage.value = ''
        currentBgFileId.value = ''
        await applyBgChange('')
        await saveToDB({ bg_image: '' })
        uni.showToast({ title: '已恢复默认', icon: 'success' })
        return
    }
    if (selectedPreset.value === preset.value) return
    const val = 'color:' + preset.value
    bgImage.value = val
    currentBgFileId.value = ''
    await applyBgChange(val)
    await saveToDB({ bg_image: val })
    uni.showToast({ title: '背景已更新', icon: 'success' })
}

const chooseBgImage = () => {
    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: async res => {
            const tempPath = res.tempFilePaths[0]
            const cloudPath = `backgrounds/${Date.now()}-${Math.random().toString(36).slice(2)}.${tempPath.split('.').pop()}`
            try {
                uni.showLoading({ title: '上传中...' })
                const uploadRes = await uploadFile(cloudPath, tempPath)
                uni.hideLoading()
                const fileID = uploadRes.fileID
                if (!bgImages.value.includes(fileID)) {
                    bgImages.value.push(fileID)
                    const url = await resolveFileUrl(fileID)
                    resolvedBgMap.value[fileID] = url
                }
                await applyBgChange(fileID)
                bgImage.value = getGlobalBgResolved()
                currentBgFileId.value = fileID
                await saveToDB({ bg_image: fileID, bg_images: bgImages.value })
                uni.showToast({ title: '背景已更新', icon: 'success' })
            } catch (e) {
                uni.hideLoading()
                uni.showToast({ title: '图片上传失败', icon: 'none' })
            }
        },
    })
}

const handleRemoveBg = () => {
    uni.showModal({
        title: '确认',
        content: '确定恢复默认背景？',
        success: async res => {
            if (res.confirm) {
                bgImage.value = ''
                currentBgFileId.value = ''
                await applyBgChange('')
                await saveToDB({ bg_image: '' })
                uni.showToast({ title: '已恢复默认', icon: 'success' })
            }
        },
    })
}

const selectSavedImage = async fileID => {
    if (currentBgFileId.value === fileID) return
    try {
        await applyBgChange(fileID)
        bgImage.value = getGlobalBgResolved()
        currentBgFileId.value = fileID
        await saveToDB({ bg_image: fileID })
        uni.showToast({ title: '背景已切换', icon: 'success' })
    } catch (e) {
        uni.showToast({ title: '切换失败', icon: 'none' })
    }
}

const removeSavedImage = (fileID, idx) => {
    uni.showModal({
        title: '确认',
        content: '确定删除这张图片？',
        success: async res => {
            if (res.confirm) {
                bgImages.value.splice(idx, 1)
                delete resolvedBgMap.value[fileID]
                if (getGlobalBgRaw() === fileID) {
                    bgImage.value = ''
                    currentBgFileId.value = ''
                    await applyBgChange('')
                    await saveToDB({ bg_images: bgImages.value, bg_image: '' })
                } else {
                    await saveToDB({ bg_images: bgImages.value })
                }
                uni.showToast({ title: '已删除', icon: 'success' })
            }
        },
    })
}

const saveToDB = async data => {
    try {
        const p = await getProfile()
        if (p) {
            await dbUpdate('profiles', p._id, data)
        }
    } catch (e) {
        console.warn('保存背景设置失败:', e)
    }
}

const goBack = () => {
    uni.navigateBack()
}
</script>

<style scoped>
.page-scroll {
    height: 100vh;
    background: #f5f0eb;
}

/* ===== Nav Bar ===== */
.nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30px 32rpx 24rpx;
}
.nav-back {
    width: 64rpx;
    height: 64rpx;
    border-radius: 32rpx;
    background: rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
}
.nav-back-icon {
    font-size: 40rpx;
    color: #3c2413;
    font-weight: 300;
    margin-left: -4rpx;
}
.nav-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #3c2413;
    letter-spacing: 1rpx;
}
.nav-placeholder {
    width: 64rpx;
}

/* ===== Preview Card ===== */
.preview-card {
    position: relative;
    height: 300rpx;
    margin: 16rpx 32rpx 24rpx;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 8rpx 32rpx rgba(60, 36, 19, 0.1);
}
.preview-card-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-size: cover;
    background-position: center;
}
.preview-card-content {
    position: relative;
    z-index: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(2px);
}
.preview-card-label {
    font-size: 30rpx;
    font-weight: 600;
    color: #3c2413;
    letter-spacing: 2rpx;
    text-shadow: 0 1rpx 4rpx rgba(255, 255, 255, 0.5);
}
.preview-card-action {
    margin-top: 20rpx;
    padding: 10rpx 36rpx;
    background: rgba(60, 36, 19, 0.12);
    border-radius: 28rpx;
    backdrop-filter: blur(4px);
}
.preview-card-action:active {
    background: rgba(60, 36, 19, 0.2);
}
.preview-card-action-text {
    font-size: 24rpx;
    color: #3c2413;
    letter-spacing: 1rpx;
}

/* ===== Panel (shared card section) ===== */
.panel {
    background: rgba(255, 255, 255, 0.7);
    margin: 0 32rpx 24rpx;
    border-radius: 24rpx;
    padding: 28rpx;
    box-shadow: 0 2rpx 12rpx rgba(60, 36, 19, 0.04);
}
.panel-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #3c2413;
    letter-spacing: 1rpx;
    margin-bottom: 24rpx;
    display: block;
}

/* ===== Color Chips (horizontal scroll) ===== */
.color-scroll {
    white-space: nowrap;
    margin: 0 -8rpx;
}
.color-row {
    display: inline-flex;
    gap: 16rpx;
    padding: 0 8rpx;
}
.color-chip {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 10rpx;
    width: 108rpx;
    padding: 14rpx 0 12rpx;
    border-radius: 16rpx;
    background: transparent;
    border: 2rpx solid transparent;
    transition: all 0.2s ease;
}
.color-chip:active {
    transform: scale(0.95);
}
.color-chip.active {
    background: rgba(198, 139, 89, 0.08);
    border-color: #c68b59;
}
.chip-dot {
    width: 64rpx;
    height: 64rpx;
    border-radius: 32rpx;
    border: 2rpx solid rgba(60, 36, 19, 0.08);
    box-shadow: 0 2rpx 8rpx rgba(60, 36, 19, 0.06);
    box-sizing: border-box;
}
.chip-name {
    font-size: 20rpx;
    color: #8b6f47;
    letter-spacing: 0.5rpx;
}
.chip-name-active {
    color: #c68b59;
    font-weight: 500;
}

/* ===== Image Grid ===== */
.img-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
}
.img-add {
    width: calc(50% - 8rpx);
    height: 180rpx;
    border-radius: 16rpx;
    border: 2rpx dashed rgba(196, 168, 130, 0.5);
    background: rgba(255, 255, 255, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    transition: background 0.2s;
}
.img-add:active {
    background: rgba(255, 255, 255, 0.8);
}
.img-add-icon {
    font-size: 48rpx;
    color: #c4a882;
    line-height: 1;
}
.img-add-text {
    font-size: 24rpx;
    color: #8b6f47;
}
.img-item {
    position: relative;
    width: calc(50% - 8rpx);
    height: 180rpx;
    border-radius: 16rpx;
    overflow: hidden;
    border: 2rpx solid rgba(60, 36, 19, 0.06);
}
.img-thumb {
    width: 100%;
    height: 100%;
}
.img-badge {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44rpx;
    height: 44rpx;
    border-radius: 22rpx;
    background: rgba(198, 139, 89, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
}
.img-badge-icon {
    color: #fff;
    font-size: 24rpx;
    font-weight: 700;
}
.img-del {
    position: absolute;
    top: 8rpx;
    right: 8rpx;
    width: 36rpx;
    height: 36rpx;
    border-radius: 18rpx;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
}
.img-del-icon {
    color: #fff;
    font-size: 24rpx;
    font-weight: 700;
    line-height: 1;
}

/* ===== Footer ===== */
.footer-hint {
    font-size: 22rpx;
    color: #8b6f47;
    display: block;
    text-align: center;
    padding: 16rpx 32rpx 0;
    letter-spacing: 0.5rpx;
}
.bottom-space {
    height: 80rpx;
}
</style>
