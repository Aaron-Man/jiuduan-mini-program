<template>
    <view class="modal-mask" @tap="emit('close')">
        <view class="modal-body" @tap.stop>
            <text class="modal-title">{{ isEditing ? '编辑记录' : '记录经期' }}</text>
            <view class="group-card form-card">
                <view class="cell-h">
                    <view class="form-icon cal"><view class="fi-box"></view><view class="fi-dots"></view></view>
                    <text class="cell-label-text">开始日期</text>
                    <picker mode="date" :value="form.startDate" @change="form.startDate = $event.detail.value">
                        <view class="cell-pick">{{ form.startDate || '选择' }}</view>
                    </picker>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <view class="form-icon flag"><view class="fi-pole"></view><view class="fi-flag"></view></view>
                    <text class="cell-label-text">结束日期</text>
                    <picker
                        mode="date"
                        :value="form.endDate"
                        :start="form.startDate || '2024-01-01'"
                        @change="form.endDate = $event.detail.value"
                    >
                        <view class="cell-pick">{{ form.endDate || '可选' }}</view>
                    </picker>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">备注</text>
                    <textarea class="cell-textarea" v-model="form.note" placeholder="流量、症状等..." />
                </view>
            </view>
            <view class="m-btn primary" style="margin-top: 24rpx" @tap="submitForm"
                ><text>{{ submitting ? '保存中...' : '保存' }}</text></view
            >
            <view class="m-cancel" @tap="emit('close')"><text>取消</text></view>
        </view>
    </view>
</template>

<script setup>
/**
 * 经期记录表单弹窗（经期页、历史页共用）
 * props.record 为空时新增（startDate 预填为 props.startDate），否则编辑该记录；保存成功后触发 saved
 */
import { ref, computed } from 'vue'
import { dbUpdate, dbAdd, clearPCache, requestSubscribeFor, sendNotificationToAll } from '../../../utils/cloud'
import { validatePeriodRange } from '../../../utils/usePeriodData'

const props = defineProps({
    record: { type: Object, default: null },
    startDate: { type: String, default: '' },
})
const emit = defineEmits(['close', 'saved'])

const isEditing = computed(() => !!props.record)
const form = ref(
    props.record
        ? { startDate: props.record.startDate, endDate: props.record.endDate || '', note: props.record.note || '' }
        : { startDate: props.startDate, endDate: '', note: '' }
)
const submitting = ref(false)

const submitForm = async () => {
    if (!form.value.startDate || submitting.value) return
    const rangeErr = validatePeriodRange(form.value.startDate, form.value.endDate)
    if (rangeErr) {
        uni.showToast({ title: rangeErr, icon: 'none' })
        return
    }
    const isNew = !isEditing.value
    // 订阅必须在用户点击手势中同步调用，放在最前面
    if (isNew) requestSubscribeFor('period')
    submitting.value = true
    clearPCache('periods')
    try {
        const data = {
            startDate: form.value.startDate,
            endDate: form.value.endDate || null,
            note: form.value.note.trim() || null,
        }
        if (isNew) await dbAdd('periods', { ...data, createTime: new Date() })
        else await dbUpdate('periods', props.record._id, { ...data, updateTime: new Date() })
        uni.vibrateShort({ type: 'medium' })
        uni.showToast({ title: '已保存', icon: 'success' })
        if (isNew) {
            const u = uni.getStorageSync('auth_user')
            sendNotificationToAll(
                'period_remind',
                u?._id,
                { title: '经期记录更新', contentType: '经期管理', summary: '对方记录了新的经期数据' },
                '/pages/period/period'
            )
        }
        emit('saved')
    } catch (e) {
        uni.showToast({ title: '保存失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
.group-card {
    background: #fff;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 4rpx 20rpx rgba(212, 135, 154, 0.08);
    border: 1rpx solid rgba(212, 135, 154, 0.1);
}
.cell-h {
    display: flex;
    align-items: center;
    padding: 24rpx 28rpx;
    gap: 16rpx;
}
.cell-label-text {
    font-size: 28rpx;
    color: #1c1c1e;
    flex-shrink: 0;
    flex: 1;
}
.cell-pick {
    font-size: 26rpx;
    color: #8e8e93;
    padding: 6rpx 0;
}
.cell-divider {
    height: 1rpx;
    background: rgba(212, 135, 154, 0.1);
    margin: 0 28rpx;
}
.cell-v {
    padding: 24rpx 28rpx;
}
.cell-v-label {
    font-size: 24rpx;
    color: #8e8e93;
    display: block;
    margin-bottom: 12rpx;
    letter-spacing: 1rpx;
}
.cell-textarea {
    width: 100%;
    min-height: 100rpx;
    font-size: 28rpx;
    color: #1c1c1e;
    background: transparent;
    border: none;
    padding: 0;
    box-sizing: border-box;
    line-height: 1.6;
}
.form-icon {
    width: 44rpx;
    height: 44rpx;
    border-radius: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
}
.form-icon.cal {
    background: rgba(212, 135, 154, 0.1);
}
.fi-box {
    width: 22rpx;
    height: 20rpx;
    border: 2.5rpx solid #d4879a;
    border-radius: 4rpx;
    position: relative;
}
.fi-box::before {
    content: '';
    position: absolute;
    top: -6rpx;
    left: 3rpx;
    width: 4rpx;
    height: 6rpx;
    background: #d4879a;
    border-radius: 2rpx;
}
.fi-box::after {
    content: '';
    position: absolute;
    top: -6rpx;
    right: 3rpx;
    width: 4rpx;
    height: 6rpx;
    background: #d4879a;
    border-radius: 2rpx;
}
.fi-dots {
    position: absolute;
    top: 22rpx;
    left: 12rpx;
    width: 4rpx;
    height: 4rpx;
    background: #d4879a;
    border-radius: 2rpx;
    box-shadow:
        6rpx 0 0 #d4879a,
        0 6rpx 0 #d4879a,
        6rpx 6rpx 0 #d4879a;
}
.form-icon.flag {
    background: rgba(232, 143, 163, 0.1);
}
.fi-pole {
    width: 3rpx;
    height: 24rpx;
    background: #e88fa3;
    border-radius: 2rpx;
    margin-left: -6rpx;
}
.fi-flag {
    position: absolute;
    top: 12rpx;
    left: 20rpx;
    width: 14rpx;
    height: 10rpx;
    background: #e88fa3;
    border-radius: 0 3rpx 3rpx 0;
}
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.modal-body {
    width: 100%;
    background: #fff;
    border-radius: 32rpx 32rpx 0 0;
    padding: 40rpx 32rpx 60rpx;
}
.modal-title {
    font-size: 36rpx;
    font-weight: 700;
    color: #d4879a;
    display: block;
    text-align: center;
    margin-bottom: 32rpx;
}
.m-btn {
    padding: 24rpx;
    border-radius: 20rpx;
    text-align: center;
    margin-top: 16rpx;
    font-size: 30rpx;
    font-weight: 500;
    letter-spacing: 1rpx;
}
.m-btn.primary {
    background: linear-gradient(135deg, #e88fa3 0%, #d4879a 100%);
    color: #fff;
}
.m-btn:active {
    opacity: 0.8;
}
.m-cancel {
    padding: 20rpx;
    text-align: center;
    margin-top: 16rpx;
}
.m-cancel text {
    font-size: 28rpx;
    color: #8e8e93;
}
.form-card {
    margin: 0;
}
</style>
