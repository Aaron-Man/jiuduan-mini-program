<template>
    <view class="modal-mask" @tap="emit('close')">
        <view class="modal-box" @tap.stop>
            <view class="sheet-handle"></view>
            <view class="group-card">
                <view class="cell-v modal-head">
                    <view class="modal-bubble ui-bubble ui-bubble--peach"><text>🍳</text></view>
                    <text class="ui-eyebrow">ORDER</text>
                    <text class="modal-dish">{{ dish.name }}</text>
                    <view class="modal-meta">
                        <view
                            class="level-dot"
                            v-for="n in 5"
                            :key="n"
                            :class="{ on: n <= dish.difficulty }"
                        ></view>
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">备注</text>
                    <textarea class="cell-textarea" v-model="note" placeholder="比如不要辣..." />
                </view>
            </view>
            <view class="modal-btns">
                <view class="modal-btn cancel ui-press" @tap="emit('close')">取消</view>
                <view class="modal-btn confirm ui-press" @tap="handleOrder" :class="{ disabled: ordering }">
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
@keyframes mask-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
@keyframes sheet-up {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
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
    animation: mask-in 0.25s ease both;
}
.modal-box {
    position: relative;
    width: 100%;
    background: var(--card-solid);
    border-radius: var(--r-xl) var(--r-xl) 0 0;
    padding: 40rpx 40rpx calc(32rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    box-shadow: 0 -24rpx 60rpx -24rpx rgba(30, 26, 23, 0.3);
    animation: sheet-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sheet-handle {
    position: absolute;
    top: 16rpx;
    left: 50%;
    width: 72rpx;
    height: 8rpx;
    margin-left: -36rpx;
    border-radius: 999rpx;
    background: var(--bg-2);
}
.group-card {
    background: transparent;
}
.cell-divider {
    height: 1rpx;
    background: var(--line);
    margin: 0 8rpx;
}
.cell-v {
    padding: 28rpx 8rpx;
}
.modal-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}
.modal-bubble {
    width: 112rpx;
    height: 112rpx;
    border-radius: 50%;
    font-size: 52rpx;
    margin-bottom: 20rpx;
    box-shadow: var(--shadow-soft);
}
.cell-v-label {
    font-size: 20rpx;
    font-weight: 600;
    color: var(--muted);
    display: block;
    margin-bottom: 16rpx;
    letter-spacing: 0.32em;
}
.cell-textarea {
    width: 100%;
    min-height: 160rpx;
    font-size: 28rpx;
    color: var(--ink);
    background: var(--bg);
    border: none;
    border-radius: var(--r-m);
    padding: 20rpx 24rpx;
    box-sizing: border-box;
    line-height: 1.6;
}
.modal-dish {
    font-family: var(--font-serif);
    font-size: 48rpx;
    font-weight: 700;
    color: var(--ink);
    display: block;
    margin-top: 8rpx;
    line-height: 1.25;
}
.modal-meta {
    display: flex;
    justify-content: center;
    gap: 10rpx;
    margin-top: 16rpx;
}
.level-dot {
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    background: var(--line);
}
.level-dot.on {
    background: var(--coral);
}
.modal-btns {
    display: flex;
    gap: 16rpx;
    margin-top: 12rpx;
}
.modal-btn {
    flex: 1;
    height: 96rpx;
    line-height: 96rpx;
    border-radius: 999rpx;
    text-align: center;
    font-size: 28rpx;
    font-weight: 600;
    letter-spacing: 0.1em;
}
.modal-btn.cancel {
    background: rgba(255, 255, 255, 0.7);
    color: var(--ink);
    border: 1rpx solid var(--line);
    box-sizing: border-box;
}
.modal-btn.confirm {
    flex: 1.6;
    background: var(--ink);
    color: #fff;
    box-shadow: 0 20rpx 40rpx -20rpx rgba(30, 26, 23, 0.6);
}
.modal-btn.confirm.disabled {
    opacity: 0.4;
}
</style>
