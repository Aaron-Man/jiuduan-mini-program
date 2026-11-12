<template>
    <view class="modal-mask" @tap="emit('close')">
        <view class="modal-box" @tap.stop>
            <view class="group-card" style="margin: 0">
                <view class="cell-v" style="text-align: center">
                    <text class="modal-dish">{{ dish.name }}</text>
                    <text class="modal-meta">{{ '★'.repeat(dish.difficulty) }}</text>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">备注</text>
                    <textarea class="cell-textarea" v-model="note" placeholder="比如不要辣..." />
                </view>
            </view>
            <view class="modal-btns">
                <view class="modal-btn cancel" @tap="emit('close')">取消</view>
                <view class="modal-btn confirm" @tap="handleOrder" :class="{ disabled: ordering }">
                    <text>{{ ordering ? '提交中...' : '确认点菜' }}</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup>
/**
 * 点菜弹窗：填写备注并提交订单，成功后触发 ordered
 */
import { ref } from 'vue'
import { callFunction, requestSubscribeFor } from '../../../utils/cloud'

const props = defineProps({
    dish: { type: Object, required: true },
})
const emit = defineEmits(['close', 'ordered'])

const note = ref('')
const ordering = ref(false)

const handleOrder = async () => {
    if (ordering.value) return
    // 订阅必须在用户点击手势中同步调用，放在最前面
    requestSubscribeFor('order')
    ordering.value = true
    try {
        const res = await callFunction('order', {
            action: 'addOrder',
            dishId: props.dish._id,
            dishName: props.dish.name,
            note: note.value.trim() || null,
        })
        if (res?.code) throw new Error(res.msg)
        uni.vibrateShort({ type: 'medium' })
        uni.showToast({ title: '点菜成功！', icon: 'success' })
        emit('ordered')
    } catch (e) {
        uni.showToast({ title: '点菜失败', icon: 'none' })
    } finally {
        ordering.value = false
    }
}
</script>

<style scoped>
.group-card {
    background: rgba(255, 255, 255, 0.6);
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.03);
    border: 1rpx solid rgba(142, 142, 147, 0.06);
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
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48rpx;
}
.modal-box {
    width: 100%;
}
.modal-dish {
    font-size: 36rpx;
    font-weight: 700;
    color: #1c1c1e;
    display: block;
    letter-spacing: 1rpx;
}
.modal-meta {
    font-size: 28rpx;
    color: #d4a574;
    display: block;
    margin-top: 8rpx;
}
.modal-btns {
    display: flex;
    gap: 16rpx;
    margin-top: 24rpx;
}
.modal-btn {
    flex: 1;
    padding: 24rpx;
    border-radius: 24rpx;
    text-align: center;
    font-size: 30rpx;
    letter-spacing: 2rpx;
}
.modal-btn.cancel {
    background: #fff;
    color: #3a3a3c;
    border: 1rpx solid rgba(142, 142, 147, 0.15);
}
.modal-btn.confirm {
    background: linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%);
    color: #f2f2f7;
}
.modal-btn.confirm.disabled {
    opacity: 0.4;
}
</style>
