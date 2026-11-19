/**
 * 订阅管理 composable
 * 统一 settings 和 period 页面的订阅逻辑
 */
import { ref } from 'vue'
import { callFunction, requestSubscribe } from './cloud'
import { NOTIFY_TEMPLATES } from './constants'

export function useSubscription() {
    const subscribedTypes = ref([])

    /** 从服务端加载当前用户的订阅类型列表 */
    const loadSubscription = async () => {
        try {
            const res = await callFunction('auth', { action: 'getCurrentUser' })
            if (res.success) {
                subscribedTypes.value = res.user.notify_types || []
            }
        } catch (e) {
            console.error('加载订阅状态失败:', e)
        }
    }

    /**
     * 切换订阅状态（订阅 / 取消订阅）
     * @param {string} type - 订阅类型 key（对应 NOTIFY_TEMPLATES 中的键）
     * @param {Object} [options] - 可选配置
     * @param {string} [options.cancelTitle='取消订阅'] - 取消确认弹窗标题
     * @param {string} [options.cancelContent='确定取消该通知订阅？取消后将不会收到相关提醒'] - 取消确认弹窗内容
     */
    const handleSubscribe = async (type, options = {}) => {
        const tmplId = NOTIFY_TEMPLATES[type]
        if (!tmplId) {
            uni.showToast({ title: '模板未配置', icon: 'none' })
            return
        }

        // 已订阅 → 确认取消
        if (subscribedTypes.value.includes(type)) {
            uni.showModal({
                title: options.cancelTitle || '取消订阅',
                content: options.cancelContent || '确定取消该通知订阅？取消后将不会收到相关提醒',
                success: async res => {
                    if (res.confirm) {
                        try {
                            // 服务端原子移除，无需先读取再整体覆盖
                            const res = await callFunction('auth', { action: 'updateSubscription', remove: type })
                            if (!res?.success) throw new Error(res?.msg || '取消订阅失败')
                            subscribedTypes.value = subscribedTypes.value.filter(t => t !== type)
                            uni.showToast({ title: '已取消', icon: 'success' })
                        } catch (e) {
                            uni.showToast({ title: '操作失败', icon: 'none' })
                        }
                    }
                },
            })
            return
        }

        // 未订阅 → 请求并订阅
        const result = await requestSubscribe([tmplId])
        if (result.granted) {
            try {
                // 服务端原子添加，无需先读取再整体覆盖
                const res = await callFunction('auth', { action: 'updateSubscription', add: type })
                if (!res?.success) throw new Error(res?.msg || '订阅失败')
                if (!subscribedTypes.value.includes(type)) {
                    subscribedTypes.value.push(type)
                }
                uni.showToast({ title: '已订阅', icon: 'success' })
            } catch (e) {
                uni.showToast({ title: '保存失败', icon: 'none' })
            }
        }
    }

    return { subscribedTypes, loadSubscription, handleSubscribe }
}
