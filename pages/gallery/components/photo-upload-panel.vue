<template>
    <view class="section">
        <view class="card">
            <view v-if="!previewUrl" class="upload-area" @tap="chooseImage">
                <text class="upload-icon">📷</text>
                <text class="upload-text">点击选择照片</text>
            </view>
            <view v-else>
                <view class="preview-wrap">
                    <image :src="previewUrl" class="preview-img" mode="aspectFill" @error="previewUrl = ''" />
                    <view class="preview-change" @tap="chooseImage">更换</view>
                </view>
                <view class="divider"></view>
                <view class="form-row">
                    <text class="form-icon">📝</text>
                    <input class="form-input" v-model="caption" placeholder="照片描述（可选）" maxlength="20" />
                </view>
                <view class="divider"></view>
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
        <view v-if="previewUrl" class="submit-btn" :class="{ disabled: uploading }" @tap="handleUpload">
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
    padding: 16rpx 32rpx 0;
}
.card {
    background: #fff;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.03);
    border: 1rpx solid rgba(142, 142, 147, 0.06);
}
.form-row {
    display: flex;
    align-items: center;
    padding: 24rpx 28rpx;
    gap: 16rpx;
}
.form-icon {
    font-size: 32rpx;
    flex-shrink: 0;
}
.form-input {
    flex: 1;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
}
.form-btn {
    padding: 10rpx 24rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 16rpx;
    font-size: 24rpx;
    flex-shrink: 0;
}
.form-col {
    padding: 24rpx 28rpx;
}
.form-label {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-bottom: 12rpx;
    letter-spacing: 1rpx;
}
.divider {
    height: 1rpx;
    background: rgba(142, 142, 147, 0.06);
    margin: 0 28rpx;
}
.upload-area {
    padding: 80rpx 0;
    border: 2rpx dashed rgba(142, 142, 147, 0.25);
    border-radius: 20rpx;
    margin: 28rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.upload-icon {
    font-size: 56rpx;
    margin-bottom: 12rpx;
}
.upload-text {
    font-size: 26rpx;
    color: #8e8e93;
}
.preview-wrap {
    position: relative;
    padding: 28rpx;
}
.preview-img {
    width: 100%;
    height: 360rpx;
    border-radius: 20rpx;
}
.preview-change {
    position: absolute;
    bottom: 44rpx;
    right: 44rpx;
    padding: 10rpx 24rpx;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 16rpx;
    font-size: 24rpx;
    color: #1c1c1e;
}
.tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
}
.tag {
    padding: 12rpx 24rpx;
    background: #f2f2f7;
    border-radius: 24rpx;
    font-size: 24rpx;
    color: #3a3a3c;
    border: 1rpx solid rgba(142, 142, 147, 0.1);
}
.tag.active {
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-color: transparent;
}
.hint {
    font-size: 24rpx;
    color: #8e8e93;
}
.submit-btn {
    margin-top: 24rpx;
    padding: 24rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 24rpx;
    text-align: center;
    font-size: 30rpx;
    font-weight: 500;
}
.submit-btn.disabled {
    opacity: 0.35;
}
</style>
