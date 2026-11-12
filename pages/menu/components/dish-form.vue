<template>
    <view class="group ui-fade-up">
        <view class="section-head">
            <text class="ui-eyebrow">{{ isEditing ? 'EDIT DISH' : 'NEW DISH' }}</text>
            <text class="group-label">{{ isEditing ? '编辑菜品' : '添加新菜品' }}</text>
        </view>
        <view class="group-card">
            <view class="cell-h">
                <view class="cell-icon ui-bubble ui-bubble--peach"><text>🏷️</text></view>
                <input class="cell-input cell-input--title" v-model="form.name" placeholder="菜名" />
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
                <view class="cell-icon ui-bubble ui-bubble--sage"><text>🥬</text></view>
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
                <view class="cell-icon ui-bubble ui-bubble--butter"><text>📷</text></view>
                <view class="img-pick ui-press" v-if="!formImageDisplay" @tap="chooseDishImage">
                    <text class="img-pick-plus">＋</text>
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
            class="submit-btn ui-press"
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
    padding: 32rpx 32rpx 0;
}
.section-head {
    display: flex;
    flex-direction: column;
    padding: 0 8rpx;
    margin-bottom: 20rpx;
}
.group-label {
    font-family: var(--font-serif);
    font-size: 36rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
    margin-top: 6rpx;
}
.group-card {
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    overflow: hidden;
}
.cell-h {
    display: flex;
    align-items: center;
    padding: 24rpx 32rpx;
    gap: 20rpx;
}
.cell-icon {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    font-size: 32rpx;
    flex-shrink: 0;
}
.cell-input {
    flex: 1;
    font-size: 28rpx;
    color: var(--ink);
    background: transparent;
    border: none;
    padding: 0;
}
.cell-input--title {
    font-family: var(--font-serif);
    font-size: 34rpx;
    font-weight: 700;
}
.cell-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 32rpx;
}
.cell-v {
    padding: 28rpx 32rpx;
}
.cell-v-label {
    font-size: 20rpx;
    font-weight: 600;
    color: var(--muted);
    display: block;
    margin-bottom: 18rpx;
    letter-spacing: 0.32em;
}
.cell-textarea {
    width: 100%;
    min-height: 140rpx;
    font-size: 28rpx;
    color: var(--ink);
    background: var(--bg);
    border: none;
    border-radius: var(--r-m);
    padding: 20rpx 24rpx;
    box-sizing: border-box;
    line-height: 1.6;
}
.check-box {
    position: relative;
    width: 44rpx;
    height: 44rpx;
    border: 2rpx solid var(--faint);
    border-radius: 14rpx;
    flex-shrink: 0;
    box-sizing: border-box;
}
.check-box.checked {
    background: var(--ink);
    border-color: var(--ink);
}
.check-box.checked::after {
    content: '';
    position: absolute;
    left: 13rpx;
    top: 6rpx;
    width: 10rpx;
    height: 18rpx;
    border-right: 4rpx solid #fff;
    border-bottom: 4rpx solid #fff;
    transform: rotate(45deg);
}
.tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14rpx;
}
.tag {
    padding: 12rpx 28rpx;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 999rpx;
    font-size: 24rpx;
    color: var(--ink-2);
    border: 1rpx solid var(--line);
    letter-spacing: 0.04em;
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
.img-pick {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 200rpx;
    height: 150rpx;
    background: rgba(255, 255, 255, 0.6);
    border-radius: var(--r-m);
    border: 2rpx dashed var(--faint);
    box-sizing: border-box;
}
.img-pick-plus {
    font-size: 40rpx;
    font-weight: 300;
    color: var(--ink-2);
    line-height: 1.1;
}
.img-pick-text {
    font-size: 22rpx;
    color: var(--muted);
    letter-spacing: 0.06em;
}
.img-preview {
    position: relative;
    display: inline-block;
}
.preview-img {
    width: 200rpx;
    height: 150rpx;
    border-radius: var(--r-m);
    box-shadow: var(--shadow-soft);
}
.img-remove {
    position: absolute;
    top: -14rpx;
    right: -14rpx;
    width: 44rpx;
    height: 44rpx;
    background: var(--ink);
    color: #fff;
    border-radius: 50%;
    text-align: center;
    line-height: 42rpx;
    font-size: 28rpx;
    box-shadow: var(--shadow-soft);
}
.submit-btn {
    margin-top: 32rpx;
    height: 96rpx;
    line-height: 96rpx;
    padding: 0;
    background: var(--ink);
    color: #fff;
    border-radius: 999rpx;
    text-align: center;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.12em;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.submit-btn.disabled {
    opacity: 0.35;
}
</style>
