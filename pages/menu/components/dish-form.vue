<template>
    <view class="group">
        <text class="group-label">{{ isEditing ? '编辑菜品' : '添加新菜品' }}</text>
        <view class="group-card">
            <view class="cell-h">
                <text class="cell-icon">🏷️</text>
                <input class="cell-input" v-model="form.name" placeholder="菜名" />
            </view>
            <view class="cell-divider"></view>
            <view class="cell-v">
                <text class="cell-v-label">分类</text>
                <view class="tag-row">
                    <view
                        v-for="c in categories"
                        :key="c._id"
                        class="tag"
                        :class="{ active: form.category_ids.includes(c._id) }"
                        @tap="toggleCategory(c._id)"
                    >
                        {{ form.category_ids.includes(c._id) ? '✓ ' : '' }}{{ c.name }}
                    </view>
                    <text v-if="categories.length === 0" class="hint">请先添加分类</text>
                </view>
            </view>
            <view class="cell-divider"></view>
            <view class="cell-v">
                <text class="cell-v-label">描述</text>
                <textarea class="cell-textarea" v-model="form.description" placeholder="描述这道菜..." />
            </view>
            <view class="cell-divider"></view>
            <view class="cell-h">
                <text class="cell-icon">🥬</text>
                <input class="cell-input" v-model="form.ingredients" placeholder="食材（逗号分隔）" />
            </view>
            <view class="cell-divider"></view>
            <view class="cell-v">
                <text class="cell-v-label">难度</text>
                <view class="tag-row">
                    <view
                        v-for="d in 5"
                        :key="d"
                        class="tag"
                        :class="{ active: form.difficulty === d }"
                        @tap="form.difficulty = d"
                    >
                        {{ DIFFICULTY_LABELS[d] }}
                    </view>
                </view>
            </view>
            <view class="cell-divider"></view>
            <view class="cell-h">
                <text class="cell-icon">📷</text>
                <view class="img-pick" v-if="!formImageDisplay" @tap="chooseDishImage">
                    <text class="img-pick-text">选择图片</text>
                </view>
                <view v-else class="img-preview">
                    <image :src="formImageDisplay" class="preview-img" mode="aspectFill" />
                    <text class="img-remove" @tap="removeImage">×</text>
                </view>
            </view>
            <view class="cell-divider"></view>
            <view class="cell-h" @tap="form.available = !form.available">
                <view class="check-box" :class="{ checked: form.available }"></view>
                <text class="cell-input">可点（显示在菜谱中）</text>
            </view>
        </view>
        <view
            class="submit-btn"
            @tap="handleSubmit"
            :class="{ disabled: submitting || !form.name.trim() || form.category_ids.length === 0 }"
        >
            <text>{{ submitting ? '保存中...' : isEditing ? '保存修改' : '添加菜品' }}</text>
        </view>
    </view>
</template>

<script setup>
/**
 * 菜品添加 / 编辑表单
 * props.dish 为空时新增，否则编辑该菜品；保存成功后触发 saved
 */
import { ref, computed } from 'vue'
import { dbUpdate, dbAdd, uploadFile } from '../../../utils/cloud'
import { DIFFICULTY_LABELS } from '../../../utils/constants'

const props = defineProps({
    categories: { type: Array, default: () => [] },
    // 正在编辑的菜品；新增时为 null
    dish: { type: Object, default: null },
    // 新增菜品的排序值（放在列表末尾）
    nextSortOrder: { type: Number, default: 0 },
})
const emit = defineEmits(['saved'])

const isEditing = computed(() => !!props.dish)
const initial = props.dish
const form = ref({
    name: initial?.name || '',
    description: initial?.description || '',
    category_ids: [...(initial?.category_ids || [])],
    ingredients: initial?.ingredients || '',
    difficulty: initial?.difficulty || 1,
    image_url: initial?.image_url || '',
    available: initial ? initial.available !== false : true,
})
const formImageDisplay = ref(initial?.displayUrl || '')
// 选中但尚未上传的本地图片：提交时才上传，避免用户取消表单后在云存储留下孤儿文件
const pendingImagePath = ref('')
const submitting = ref(false)

const toggleCategory = catId => {
    const ids = form.value.category_ids
    const idx = ids.indexOf(catId)
    if (idx >= 0) ids.splice(idx, 1)
    else ids.push(catId)
}

const chooseDishImage = () => {
    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: res => {
            // 先用本地临时路径预览，提交时再上传
            pendingImagePath.value = res.tempFilePaths[0]
            formImageDisplay.value = res.tempFilePaths[0]
        },
    })
}

const removeImage = () => {
    form.value.image_url = ''
    formImageDisplay.value = ''
    pendingImagePath.value = ''
}

const handleSubmit = async () => {
    if (!form.value.name.trim() || form.value.category_ids.length === 0 || submitting.value) return
    submitting.value = true
    try {
        if (pendingImagePath.value) {
            const tempPath = pendingImagePath.value
            const cloudPath = `dishes/${Date.now()}-${Math.random().toString(36).slice(2)}.${tempPath.split('.').pop()}`
            try {
                const uploadRes = await uploadFile(cloudPath, tempPath)
                form.value.image_url = uploadRes.fileID
                pendingImagePath.value = ''
            } catch (e) {
                uni.showToast({ title: '图片上传失败', icon: 'none' })
                return
            }
        }
        const data = {
            name: form.value.name.trim(),
            description: form.value.description.trim() || null,
            category_ids: form.value.category_ids,
            category_id: form.value.category_ids[0],
            ingredients: form.value.ingredients.trim() || null,
            difficulty: form.value.difficulty,
            image_url: form.value.image_url || null,
            available: form.value.available,
        }
        if (isEditing.value) {
            await dbUpdate('dishes', props.dish._id, data)
        } else {
            await dbAdd('dishes', { ...data, sort_order: props.nextSortOrder })
        }
        uni.showToast({ title: isEditing.value ? '修改成功' : '添加成功', icon: 'success' })
        emit('saved')
    } catch (e) {
        uni.showToast({ title: '操作失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
.group {
    padding: 16rpx 32rpx 0;
}
.group-label {
    font-size: 24rpx;
    color: #636366;
    display: block;
    margin-bottom: 12rpx;
    margin-left: 8rpx;
    letter-spacing: 2rpx;
    font-weight: 500;
}
.group-card {
    background: rgba(255, 255, 255, 0.6);
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.03);
    border: 1rpx solid rgba(142, 142, 147, 0.06);
}
.cell-h {
    display: flex;
    align-items: center;
    padding: 24rpx 28rpx;
    gap: 16rpx;
}
.cell-icon {
    font-size: 32rpx;
    flex-shrink: 0;
}
.cell-input {
    flex: 1;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
}
.cell-divider {
    height: 1rpx;
    background: rgba(142, 142, 147, 0.06);
    margin: 0 28rpx;
}
.cell-v {
    padding: 24rpx 28rpx;
}
.cell-v-label {
    font-size: 24rpx;
    color: #636366;
    display: block;
    margin-bottom: 12rpx;
    letter-spacing: 1rpx;
}
.cell-textarea {
    width: 100%;
    min-height: 120rpx;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
    box-sizing: border-box;
    line-height: 1.6;
}
.cell-action {
    padding: 10rpx 24rpx;
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
    border-radius: 16rpx;
    font-size: 24rpx;
    flex-shrink: 0;
    letter-spacing: 1rpx;
}
.check-box {
    width: 40rpx;
    height: 40rpx;
    border: 2rpx solid #c7c7cc;
    border-radius: 10rpx;
    flex-shrink: 0;
}
.check-box.checked {
    background: linear-gradient(135deg, #8e8e93 0%, #aeaeb2 100%);
    border-color: transparent;
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
    color: #636366;
}
.img-pick {
    padding: 14rpx 24rpx;
    background: #f2f2f7;
    border-radius: 16rpx;
    border: 1rpx dashed rgba(142, 142, 147, 0.25);
}
.img-pick-text {
    font-size: 26rpx;
    color: #636366;
}
.img-preview {
    position: relative;
    display: inline-block;
}
.preview-img {
    width: 160rpx;
    height: 120rpx;
    border-radius: 16rpx;
}
.img-remove {
    position: absolute;
    top: -12rpx;
    right: -12rpx;
    width: 40rpx;
    height: 40rpx;
    background: #ff3b30;
    color: #fff;
    border-radius: 20rpx;
    text-align: center;
    line-height: 40rpx;
    font-size: 28rpx;
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
    letter-spacing: 2rpx;
}
.submit-btn.disabled {
    opacity: 0.35;
}
</style>
