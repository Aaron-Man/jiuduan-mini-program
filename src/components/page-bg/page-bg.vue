<template>
    <!-- 页面背景：全局共享背景（照片 + 暗色渐变 / 预设纯色 / 默认柔光氛围），所有页面共用 -->
    <view
        v-if="src && !isPreset"
        class="page-bg-img page-bg-photo"
        :style="{ backgroundImage: 'url(' + src + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"
    ></view>
    <view v-if="isPreset" class="page-bg-img" :style="{ background: presetColor }"></view>
    <view v-if="src && !isPreset" class="page-bg-overlay" :class="'page-bg-overlay--' + overlay"></view>
    <!-- 默认氛围背景：没有自定义图片时，显示缓慢漂浮的柔光色块 -->
    <view v-if="!src || isPreset" class="ambient" :class="'ambient--' + tone">
        <view class="blob blob--a"></view>
        <view class="blob blob--b"></view>
        <view class="blob blob--c"></view>
        <view class="grain"></view>
    </view>
</template>

<script>
// 小程序端不生成多余的组件宿主节点，避免影响页面布局
export default { options: { virtualHost: true } }
</script>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { useSharedBg } from '../../utils/cloud'
import { BG_COLOR_MAP } from '../../utils/constants'

const props = defineProps({
    // 指定背景值（color:xxx / 图片 URL）；不传时使用全局共享背景
    image: { type: String, default: null },
    // 照片上的暗色渐变强度：warm（默认）/ light 较淡 / strong 较深
    overlay: { type: String, default: 'warm' },
    // 氛围色调：sunset（默认）/ peach / rose / lilac / mint / sky / butter
    tone: { type: String, default: 'sunset' },
})

const { bgImage } = useSharedBg()
const src = computed(() => (props.image !== null ? props.image : bgImage.value) || '')
const isPreset = computed(() => src.value.startsWith('color:'))
const presetColor = computed(() => BG_COLOR_MAP[src.value.replace('color:', '')] || '#f2f2f7')
const isPhoto = computed(() => !!src.value && !isPreset.value)

// 照片背景时，系统导航栏换成和照片顶部暗色渐变衔接的深色，标题白字；否则恢复 pages.json 里的奶油色
const syncNavBar = () => {
    uni.setNavigationBarColor({
        frontColor: isPhoto.value ? '#ffffff' : '#000000',
        backgroundColor: isPhoto.value ? '#2a221c' : '#F7F3EE',
        fail: () => {},
    })
}
onMounted(syncNavBar)
watch(isPhoto, syncNavBar)
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
.page-bg-photo {
    /* 照片保持清晰，只略微降低饱和度，避免和卡片里的彩色元素抢眼 */
    filter: saturate(0.92);
}
.page-bg-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    /* 在照片之上、内容之下：只压暗照片，不影响文字和卡片 */
    z-index: -1;
    pointer-events: none;
}
/* 顶部和底部更深：白色标题、底部按钮都有足够对比度；中间留出照片本身的颜色 */
.page-bg-overlay--warm {
    background: linear-gradient(180deg, rgba(30, 22, 16, 0.55) 0%, rgba(30, 22, 16, 0.22) 32%, rgba(30, 22, 16, 0.18) 62%, rgba(30, 22, 16, 0.5) 100%);
}
.page-bg-overlay--light {
    background: linear-gradient(180deg, rgba(30, 22, 16, 0.42) 0%, rgba(30, 22, 16, 0.12) 32%, rgba(30, 22, 16, 0.1) 62%, rgba(30, 22, 16, 0.38) 100%);
}
.page-bg-overlay--strong {
    background: linear-gradient(180deg, rgba(30, 22, 16, 0.66) 0%, rgba(30, 22, 16, 0.38) 32%, rgba(30, 22, 16, 0.34) 62%, rgba(30, 22, 16, 0.62) 100%);
}
.ambient {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
}
.blob {
    position: absolute;
    border-radius: 50%;
    opacity: 0.75;
}
.blob--a {
    width: 640rpx;
    height: 640rpx;
    top: -200rpx;
    left: -160rpx;
    animation: drift-a 22s ease-in-out infinite alternate;
}
.blob--b {
    width: 560rpx;
    height: 560rpx;
    top: 360rpx;
    right: -220rpx;
    animation: drift-b 26s ease-in-out infinite alternate;
}
.blob--c {
    width: 520rpx;
    height: 520rpx;
    bottom: -180rpx;
    left: 40rpx;
    opacity: 0.55;
    animation: drift-c 30s ease-in-out infinite alternate;
}
/* 细腻的颗粒感，让色块更像胶片 */
.grain {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(rgba(30, 26, 23, 0.022) 0.6px, transparent 0.8px);
    background-size: 4px 4px;
}
@keyframes drift-a {
    to { transform: translate(120rpx, 80rpx) scale(1.12); }
}
@keyframes drift-b {
    to { transform: translate(-100rpx, 120rpx) scale(0.9); }
}
@keyframes drift-c {
    to { transform: translate(140rpx, -100rpx) scale(1.08); }
}
/* 色调：每种由三个柔光色组成 */
.ambient--sunset .blob--a { background: radial-gradient(circle, rgba(249, 205, 182, 0.9) 0%, rgba(249, 205, 182, 0) 70%); }
.ambient--sunset .blob--b { background: radial-gradient(circle, rgba(214, 197, 242, 0.85) 0%, rgba(214, 197, 242, 0) 70%); }
.ambient--sunset .blob--c { background: radial-gradient(circle, rgba(242, 184, 192, 0.8) 0%, rgba(242, 184, 192, 0) 70%); }
.ambient--peach .blob--a { background: radial-gradient(circle, rgba(250, 209, 178, 0.9) 0%, rgba(250, 209, 178, 0) 70%); }
.ambient--peach .blob--b { background: radial-gradient(circle, rgba(245, 227, 179, 0.85) 0%, rgba(245, 227, 179, 0) 70%); }
.ambient--peach .blob--c { background: radial-gradient(circle, rgba(240, 190, 180, 0.7) 0%, rgba(240, 190, 180, 0) 70%); }
.ambient--rose .blob--a { background: radial-gradient(circle, rgba(242, 182, 196, 0.85) 0%, rgba(242, 182, 196, 0) 70%); }
.ambient--rose .blob--b { background: radial-gradient(circle, rgba(250, 214, 200, 0.85) 0%, rgba(250, 214, 200, 0) 70%); }
.ambient--rose .blob--c { background: radial-gradient(circle, rgba(222, 200, 240, 0.7) 0%, rgba(222, 200, 240, 0) 70%); }
.ambient--lilac .blob--a { background: radial-gradient(circle, rgba(212, 200, 240, 0.9) 0%, rgba(212, 200, 240, 0) 70%); }
.ambient--lilac .blob--b { background: radial-gradient(circle, rgba(199, 219, 242, 0.85) 0%, rgba(199, 219, 242, 0) 70%); }
.ambient--lilac .blob--c { background: radial-gradient(circle, rgba(242, 200, 214, 0.7) 0%, rgba(242, 200, 214, 0) 70%); }
.ambient--mint .blob--a { background: radial-gradient(circle, rgba(201, 223, 207, 0.95) 0%, rgba(201, 223, 207, 0) 70%); }
.ambient--mint .blob--b { background: radial-gradient(circle, rgba(199, 219, 242, 0.85) 0%, rgba(199, 219, 242, 0) 70%); }
.ambient--mint .blob--c { background: radial-gradient(circle, rgba(245, 227, 179, 0.6) 0%, rgba(245, 227, 179, 0) 70%); }
.ambient--sky .blob--a { background: radial-gradient(circle, rgba(199, 219, 242, 0.95) 0%, rgba(199, 219, 242, 0) 70%); }
.ambient--sky .blob--b { background: radial-gradient(circle, rgba(212, 200, 240, 0.8) 0%, rgba(212, 200, 240, 0) 70%); }
.ambient--sky .blob--c { background: radial-gradient(circle, rgba(201, 223, 207, 0.7) 0%, rgba(201, 223, 207, 0) 70%); }
.ambient--butter .blob--a { background: radial-gradient(circle, rgba(245, 227, 179, 0.95) 0%, rgba(245, 227, 179, 0) 70%); }
.ambient--butter .blob--b { background: radial-gradient(circle, rgba(249, 205, 182, 0.8) 0%, rgba(249, 205, 182, 0) 70%); }
.ambient--butter .blob--c { background: radial-gradient(circle, rgba(201, 223, 207, 0.7) 0%, rgba(201, 223, 207, 0) 70%); }
</style>
