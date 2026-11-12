<template>
    <view class="modal-mask" @tap="emit('close')">
        <view class="modal-body" @tap.stop>
            <view class="modal-grip"></view>
            <text class="ui-eyebrow modal-eyebrow">{{ isEditing ? 'EDIT ENTRY' : 'NEW ENTRY' }}</text>
            <text class="modal-title">{{ isEditing ? '编辑记录' : '记录经期' }}</text>
            <view class="group-card form-card">
                <view class="cell-h">
                    <view class="form-icon ui-bubble--rose"><text>🌸</text></view>
                    <text class="cell-label-text">开始日期</text>
                    <picker mode="date" :value="form.startDate" @change="form.startDate = $event.detail.value">
                        <view class="cell-pick" :class="{ filled: form.startDate }">{{ form.startDate || '选择' }}</view>
                    </picker>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <view class="form-icon ui-bubble--lilac"><text>🌙</text></view>
                    <text class="cell-label-text">结束日期</text>
                    <picker
                        mode="date"
                        :value="form.endDate"
                        :start="form.startDate || '2024-01-01'"
                        @change="form.endDate = $event.detail.value"
                    >
                        <view class="cell-pick" :class="{ filled: form.endDate }">{{ form.endDate || '可选' }}</view>
                    </picker>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">备注</text>
                    <textarea class="cell-textarea" v-model="form.note" placeholder="流量、症状等..." />
                </view>
            </view>
            <view class="m-btn primary ui-press" style="margin-top: 24rpx" @tap="submitForm"
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
    background: var(--bg);
    border-radius: var(--r-l);
    overflow: hidden;
}
.cell-h {
    display: flex;
    align-items: center;
    padding: 24rpx 28rpx;
    gap: 20rpx;
}
.cell-label-text {
    font-size: 28rpx;
    color: var(--ink);
    font-weight: 500;
    flex-shrink: 0;
    flex: 1;
}
.cell-pick {
    font-size: 24rpx;
    color: var(--muted);
    padding: 10rpx 24rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.9);
    border: 1rpx solid var(--line);
    letter-spacing: 0.04em;
}
.cell-pick.filled {
    color: #fff;
    background: var(--ink);
    border-color: var(--ink);
    font-weight: 600;
}
.cell-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 28rpx 0 112rpx;
}
.cell-v {
    padding: 24rpx 28rpx 28rpx;
}
.cell-v-label {
    font-size: 20rpx;
    color: var(--muted);
    display: block;
    margin-bottom: 14rpx;
    letter-spacing: 0.3em;
    font-weight: 600;
}
.cell-textarea {
    width: 100%;
    min-height: 120rpx;
    font-size: 28rpx;
    color: var(--ink);
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: var(--r-m);
    padding: 20rpx 24rpx;
    box-sizing: border-box;
    line-height: 1.6;
}
.form-icon {
    width: 64rpx;
    height: 64rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 30rpx;
}
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(30, 26, 23, 0.35);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.modal-body {
    width: 100%;
    background: var(--card-solid);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    padding: 20rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.modal-grip {
    width: 72rpx;
    height: 8rpx;
    border-radius: 999rpx;
    background: var(--bg-2);
    margin: 0 auto 28rpx;
}
.modal-eyebrow {
    text-align: center;
}
.modal-title {
    font-family: var(--font-serif);
    font-size: 48rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
    text-align: center;
    margin: 8rpx 0 32rpx;
}
.m-btn {
    height: 96rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 16rpx;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.1em;
}
.m-btn.primary {
    background: var(--ink);
    color: #fff;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.m-cancel {
    padding: 20rpx;
    text-align: center;
    margin-top: 8rpx;
}
.m-cancel text {
    font-size: 26rpx;
    color: var(--muted);
    letter-spacing: 0.1em;
}
.form-card {
    margin: 0;
}
</style>
