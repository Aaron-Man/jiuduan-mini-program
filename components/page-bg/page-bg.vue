<template>
    <!-- 页面背景：全局共享背景（图片模糊 + 遮罩 / 预设纯色），所有页面共用 -->
    <view
        v-if="src && !isPreset"
        class="page-bg-img page-bg-blur"
        :style="{ backgroundImage: 'url(' + src + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"
    ></view>
    <view v-if="isPreset" class="page-bg-img" :style="{ background: presetColor }"></view>
    <view v-if="src && !isPreset" class="page-bg-overlay" :class="'page-bg-overlay--' + overlay"></view>
</template>

<script>
// 小程序端不生成多余的组件宿主节点，避免影响页面布局
export default { options: { virtualHost: true } }
</script>

<script setup>
import { computed } from 'vue'
import { useSharedBg } from '../../utils/cloud'
import { BG_COLOR_MAP } from '../../utils/constants'

const props = defineProps({
    // 指定背景值（color:xxx / 图片 URL）；不传时使用全局共享背景
    image: { type: String, default: null },
    // 图片背景上的遮罩：warm 暖白（默认） / light 白色 / strong 较强白色
    overlay: { type: String, default: 'warm' },
})

const { bgImage } = useSharedBg()
const src = computed(() => (props.image !== null ? props.image : bgImage.value) || '')
const isPreset = computed(() => src.value.startsWith('color:'))
const presetColor = computed(() => BG_COLOR_MAP[src.value.replace('color:', '')] || '#f2f2f7')
</script>

<style scoped>
.page-bg-img {
    position: fixed;
    top: -20px;
    left: -20px;
    width: calc(100% + 40px);
    height: calc(100% + 40px);
    z-index: -2;
}
.page-bg-blur {
    filter: blur(10px);
}
.page-bg-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100;
    pointer-events: none;
}
.page-bg-overlay--warm {
    background: radial-gradient(ellipse at center, rgba(250, 246, 241, 0.15) 0%, rgba(250, 246, 241, 0.3) 100%);
}
.page-bg-overlay--light {
    background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.3) 100%);
}
.page-bg-overlay--strong {
    background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.55) 100%);
}
</style>
