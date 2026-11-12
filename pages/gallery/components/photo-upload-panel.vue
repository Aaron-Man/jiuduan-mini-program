<template>
    <view class="section ui-fade-up">
        <view class="card">
            <view class="card-head">
                <text class="ui-eyebrow">NEW MOMENT</text>
                <text class="card-title">上传照片</text>
            </view>
            <view v-if="!previewUrl" class="upload-area ui-press" @tap="chooseImage">
                <view class="upload-bubble">
                    <text class="upload-icon">📷</text>
                </view>
                <text class="upload-text">点击选择照片</text>
                <text class="upload-hint">相册 / 拍摄</text>
            </view>
            <view v-else>
                <view class="preview-wrap">
                    <image :src="previewUrl" class="preview-img" mode="aspectFill" @error="previewUrl = ''" />
                    <view class="preview-change ui-press" @tap="chooseImage">更换</view>
                </view>
                <view class="form-row">
                    <text class="form-icon">📝</text>
                    <input class="form-input" v-model="caption" placeholder="照片描述（可选）" maxlength="20" />
                </view>
                <view class="form-col">
                    <text class="form-label">选择分类</text>
                    <view class="tag-row">
                        <view
                            v-for="cat in categories"
                            :key="cat.id"
                            class="tag"
                            :class="{ active: selectedCategoryId === cat.id }"
                            @tap="selectedCategoryId = cat.id"
                        >
                            {{ cat.emoji }} {{ cat.name }}
                        </view>
                        <text v-if="categories.length === 0" class="hint">请先添加分类</text>
                    </view>
                </view>
            </view>
        </view>
        <view v-if="previewUrl" class="submit-btn ui-press" :class="{ disabled: uploading }" @tap="handleUpload">
            <text>{{ uploading ? '上传中...' : '上传照片' }}</text>
        </view>
    </view>
</template>

<script setup>
/**
 * 上传照片面板：选择图片、填写描述、选择分类并上传
 * 上传成功后触发 uploaded（上传过程中面板保持显示「上传中...」）
 */
import { ref } from 'vue'
import { dbAdd, uploadFile, requestSubscribeFor, sendNotificationToAll } from '../../../utils/cloud'
import { getCurrentUser } from '../../../utils/interactions'

const props = defineProps({
    categories: { type: Array, default: () => [] },
    // 新照片的排序值（排在最前面）
    sortOrder: { type: Number, default: 0 },
})
const emit = defineEmits(['uploaded'])

const previewUrl = ref('')
const tempFilePath = ref('')
const caption = ref('')
const selectedCategoryId = ref('')
const uploading = ref(false)

const chooseImage = () => {
    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: res => {
            if (res.tempFilePaths?.length) {
                tempFilePath.value = res.tempFilePaths[0]
                previewUrl.value = res.tempFilePaths[0]
                if (props.categories.length > 0 && !selectedCategoryId.value)
                    selectedCategoryId.value = props.categories[0].id
            }
        },
        fail: err => {
            if (!err.errMsg?.includes('cancel')) uni.showToast({ title: '选择图片失败', icon: 'none' })
        },
    })
}

const handleUpload = async () => {
    if (!tempFilePath.value || uploading.value) return
    if (!selectedCategoryId.value) {
        uni.showToast({ title: '请选择分类', icon: 'none' })
        return
    }
    // 订阅必须在用户点击手势中同步调用，放在最前面
    requestSubscribeFor('photo')
    uploading.value = true
    const cat = props.categories.find(c => c.id === selectedCategoryId.value)
    const filePath = tempFilePath.value
    const savedCaption = caption.value.trim()
    try {
        const photoId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
        const ext = filePath.split('.').pop() || 'jpg'
        const cloudPath = `gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const uploadRes = await uploadFile(cloudPath, filePath)
        if (!uploadRes?.fileID) throw new Error('上传失败')
        await dbAdd('gallery_photos', {
            id: photoId,
            fileID: uploadRes.fileID,
            caption: savedCaption,
            category: cat.name,
            categoryId: cat.id,
            sort_order: props.sortOrder,
            createTime: new Date(),
        })
        uni.showToast({ title: '上传成功', icon: 'success' })
        // 通知其他用户有新照片
        const u = getCurrentUser()
        sendNotificationToAll(
            'new_photo',
            u?.user_id,
            {
                title: '新照片上传',
                category: cat?.name || '相册',
                summary: savedCaption || '快来看看吧',
            },
            '/pages/gallery/gallery'
        )
        emit('uploaded')
    } catch (e) {
        console.error('[相册] 上传失败:', e)
        uni.showToast({ title: '上传失败', icon: 'none' })
    } finally {
        uploading.value = false
    }
}
</script>

<style scoped>
.section {
    padding: 12rpx 32rpx 8rpx;
}
.card {
    background: var(--card);
    border-radius: var(--r-xl);
    overflow: hidden;
    box-shadow: var(--shadow);
    border: 1rpx solid var(--card-border);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    padding-bottom: 12rpx;
}
.card-head {
    display: flex;
    flex-direction: column;
    padding: 32rpx 36rpx 4rpx;
}
.card-title {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    margin-top: 4rpx;
}
.form-row {
    display: flex;
    align-items: center;
    margin: 0 28rpx;
    padding: 20rpx 28rpx;
    gap: 16rpx;
    background: rgba(255, 255, 255, 0.8);
    border: 1rpx solid var(--line);
    border-radius: var(--r-m);
}
.form-icon {
    font-size: 30rpx;
    flex-shrink: 0;
}
.form-input {
    flex: 1;
    font-size: 28rpx;
    color: var(--ink);
    background: transparent;
    border: none;
    padding: 0;
}
.form-col {
    padding: 28rpx 36rpx 20rpx;
}
.form-label {
    font-size: 20rpx;
    color: var(--muted);
    display: block;
    margin-bottom: 18rpx;
    letter-spacing: 0.24em;
    font-weight: 600;
}
.upload-area {
    margin: 24rpx 28rpx 20rpx;
    padding: 72rpx 0 64rpx;
    border: 2rpx dashed var(--faint);
    border-radius: var(--r-l);
    background: rgba(255, 255, 255, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
}
.upload-bubble {
    width: 128rpx;
    height: 128rpx;
    border-radius: 50%;
    background: var(--grad-dawn);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-soft);
    margin-bottom: 24rpx;
}
.upload-icon {
    font-size: 56rpx;
    line-height: 1;
}
.upload-text {
    font-family: var(--font-serif);
    font-size: 30rpx;
    font-weight: 700;
    color: var(--ink);
}
.upload-hint {
    font-size: 22rpx;
    color: var(--muted);
    margin-top: 6rpx;
    letter-spacing: 0.12em;
}
.preview-wrap {
    position: relative;
    padding: 24rpx 28rpx;
}
.preview-img {
    width: 100%;
    height: 440rpx;
    border-radius: var(--r-l);
    display: block;
    box-shadow: var(--shadow-soft);
}
.preview-change {
    position: absolute;
    bottom: 48rpx;
    right: 52rpx;
    height: 56rpx;
    padding: 0 26rpx;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 999rpx;
    font-size: 22rpx;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: 0.06em;
}
.tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14rpx;
}
.tag {
    height: 60rpx;
    padding: 0 26rpx;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 999rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    border: 1rpx solid var(--line);
}
.tag.active {
    background: var(--ink);
    color: #fff;
    border-color: var(--ink);
}
.hint {
    font-size: 24rpx;
    color: var(--muted);
}
.submit-btn {
    margin-top: 28rpx;
    height: 96rpx;
    line-height: 96rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    text-align: center;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.08em;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.submit-btn.disabled {
    opacity: 0.4;
}
</style>
