<template>
    <!-- 页面背景跟随当前设置 -->
    <page-bg :image="bgImage" overlay="strong" tone="sunset" />

    <scroll-view scroll-y class="page-scroll">
        <!-- 自定义导航栏 -->
        <view class="nav-bar" :style="{ paddingTop: navTop + 'px' }">
            <view class="nav-back ui-press" @tap="goBack">
                <text class="nav-back-icon">‹</text>
            </view>
            <text class="nav-title">背景设置</text>
            <view class="nav-placeholder"></view>
        </view>

        <!-- 杂志式标题区 -->
        <view class="mast ui-fade-up">
            <text class="ui-eyebrow">BACKDROP</text>
            <text class="ui-title mast-title">换一种心情</text>
            <text class="ui-sub mast-sub">为每个页面挑一块喜欢的底色</text>
        </view>

        <!-- 当前背景预览 -->
        <view class="preview-card ui-fade-up ui-d1">
            <view
                class="preview-card-bg"
                v-if="bgImage && !isPresetBg"
                :style="{ backgroundImage: 'url(' + bgImage + ')' }"
            ></view>
            <view class="preview-card-bg" v-else-if="isPresetBg" :style="{ background: bgPresetStyle }"></view>
            <view class="preview-card-content">
                <text class="preview-eyebrow">NOW SHOWING</text>
                <text class="preview-card-label">{{ previewLabel }}</text>
                <view class="preview-card-action ui-press" v-if="bgImage" @tap="handleRemoveBg">
                    <text class="preview-card-action-text">恢复默认</text>
                </view>
            </view>
        </view>

        <!-- 选择颜色 -->
        <view class="panel ui-fade-up ui-d2">
            <view class="panel-head">
                <text class="ui-eyebrow">PALETTE</text>
                <text class="panel-title">选择颜色</text>
            </view>
            <scroll-view scroll-x class="color-scroll" show-scrollbar="false">
                <view class="color-row">
                    <view
                        class="color-chip"
                        v-for="p in BG_PRESETS"
                        :key="p.value"
                        :class="{ active: selectedPreset === p.value }"
                        @tap="selectPreset(p)"
                    >
                        <view class="chip-ring">
                            <view class="chip-dot" :style="{ background: p.style }"></view>
                        </view>
                        <text class="chip-name" :class="{ 'chip-name-active': selectedPreset === p.value }">{{
                            p.name
                        }}</text>
                    </view>
                </view>
            </scroll-view>
        </view>

        <!-- 自定义图片 -->
        <view class="panel ui-fade-up ui-d3">
            <view class="panel-head">
                <text class="ui-eyebrow">GALLERY</text>
                <text class="panel-title">自定义图片</text>
            </view>
            <view class="img-grid">
                <view class="img-add ui-press" @tap="chooseBgImage">
                    <view class="img-add-bubble"><text class="img-add-icon">+</text></view>
                    <text class="img-add-text">上传图片</text>
                </view>
                <view
                    class="img-item ui-press"
                    v-for="(img, idx) in bgImages"
                    :key="img"
                    :class="{ current: currentBgFileId === img }"
                    @tap="selectSavedImage(img)"
                >
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
    background: transparent;
}

/* ===== Nav Bar ===== */
.nav-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30px 32rpx 16rpx;
}
.nav-back {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    box-shadow: var(--shadow-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.nav-back-icon {
    font-size: 44rpx;
    color: var(--ink);
    font-weight: 300;
    margin-left: -4rpx;
    line-height: 1;
}
.nav-title {
    font-size: 26rpx;
    font-weight: 600;
    color: var(--ink-2);
    letter-spacing: 0.2em;
}
.nav-placeholder {
    width: 72rpx;
}

/* ===== 标题区 ===== */
.mast {
    padding: 24rpx 44rpx 8rpx;
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

/* ===== Preview Card ===== */
.preview-card {
    position: relative;
    height: 380rpx;
    margin: 36rpx 32rpx 32rpx;
    border-radius: var(--r-xl);
    overflow: hidden;
    background: var(--grad-sunset);
    border: 8rpx solid rgba(255, 255, 255, 0.9);
    box-shadow: var(--shadow);
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
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.28) 100%);
}
.preview-eyebrow {
    font-size: 18rpx;
    letter-spacing: 0.4em;
    color: var(--ink-2);
    font-weight: 600;
    padding: 6rpx 20rpx;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 999rpx;
}
.preview-card-label {
    font-family: var(--font-serif);
    font-size: 52rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 18rpx;
    text-shadow: 0 2rpx 12rpx rgba(255, 255, 255, 0.6);
}
.preview-card-action {
    margin-top: 24rpx;
    height: 64rpx;
    padding: 0 36rpx;
    display: flex;
    align-items: center;
    background: var(--ink);
    border-radius: 999rpx;
    box-shadow: 0 16rpx 32rpx -16rpx rgba(30, 26, 23, 0.6);
}
.preview-card-action-text {
    font-size: 24rpx;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.1em;
}

/* ===== Panel (shared card section) ===== */
.panel {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    margin: 0 32rpx 28rpx;
    border-radius: var(--r-xl);
    padding: 36rpx 32rpx;
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
}
.panel-head {
    display: flex;
    flex-direction: column;
    margin-bottom: 28rpx;
}
.panel-title {
    font-family: var(--font-serif);
    font-size: 38rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 6rpx;
    display: block;
}

/* ===== Color Chips (horizontal scroll) ===== */
.color-scroll {
    white-space: nowrap;
    margin: 0 -8rpx;
}
.color-row {
    display: inline-flex;
    gap: 12rpx;
    padding: 0 8rpx 8rpx;
}
.color-chip {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 12rpx;
    width: 112rpx;
    padding: 4rpx 0;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.color-chip:active {
    transform: scale(0.94);
}
.chip-ring {
    width: 92rpx;
    height: 92rpx;
    border-radius: 50%;
    border: 3rpx solid transparent;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s ease;
}
.color-chip.active .chip-ring {
    border-color: var(--ink);
}
.chip-dot {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    border: 2rpx solid rgba(30, 26, 23, 0.06);
    box-shadow: 0 10rpx 20rpx -10rpx rgba(80, 56, 36, 0.35);
    box-sizing: border-box;
}
.chip-name {
    font-size: 20rpx;
    color: var(--muted);
    letter-spacing: 0.04em;
}
.chip-name-active {
    color: var(--ink);
    font-weight: 600;
}

/* ===== Image Grid ===== */
.img-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20rpx;
}
.img-add {
    width: calc(50% - 10rpx);
    height: 220rpx;
    border-radius: var(--r-l);
    border: 2rpx dashed var(--faint);
    background: rgba(255, 255, 255, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14rpx;
    box-sizing: border-box;
}
.img-add-bubble {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    background: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 16rpx 32rpx -16rpx rgba(30, 26, 23, 0.6);
}
.img-add-icon {
    font-size: 44rpx;
    color: #fff;
    font-weight: 300;
    line-height: 1;
}
.img-add-text {
    font-size: 22rpx;
    color: var(--ink-2);
    letter-spacing: 0.1em;
}
.img-item {
    position: relative;
    width: calc(50% - 10rpx);
    height: 220rpx;
    border-radius: var(--r-l);
    overflow: hidden;
    border: 4rpx solid rgba(255, 255, 255, 0.9);
    box-shadow: var(--shadow-soft);
    box-sizing: border-box;
}
.img-item.current {
    border-color: var(--ink);
}
.img-thumb {
    width: 100%;
    height: 100%;
}
.img-badge {
    position: absolute;
    left: 14rpx;
    bottom: 14rpx;
    width: 48rpx;
    height: 48rpx;
    border-radius: 50%;
    background: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
}
.img-badge-icon {
    color: #fff;
    font-size: 24rpx;
    font-weight: 700;
}
.img-del {
    position: absolute;
    top: 12rpx;
    right: 12rpx;
    width: 44rpx;
    height: 44rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
}
.img-del-icon {
    color: var(--coral);
    font-size: 28rpx;
    font-weight: 600;
    line-height: 1;
}

/* ===== Footer ===== */
.footer-hint {
    font-size: 22rpx;
    color: var(--muted);
    display: block;
    text-align: center;
    padding: 16rpx 48rpx 0;
    letter-spacing: 0.04em;
}
.bottom-space {
    height: calc(80rpx + env(safe-area-inset-bottom));
}
</style>
