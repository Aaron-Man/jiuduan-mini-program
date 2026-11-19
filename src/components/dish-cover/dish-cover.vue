<template>
    <!-- 菜品封面：有图片显示图片；没有图片时用菜系的颜色和 emoji 做占位，之后上传照片会自动替换 -->
    <view class="dish-cover" :class="'dish-cover--' + size" :style="placeholderStyle">
        <image v-if="src" :src="src" class="dish-cover-img" mode="aspectFill" lazy-load />
        <template v-else>
            <view class="dish-cover-ring"></view>
            <text class="dish-cover-emoji">{{ cuisine.emoji }}</text>
            <text v-if="size !== 's'" class="dish-cover-label">{{ cuisine.label }}</text>
        </template>
    </view>
</template>

<script>
export default { options: { virtualHost: true } }
</script>

<script setup>
import { computed } from 'vue'
import { cuisineOf } from '../../utils/menu'

const props = defineProps({
    // 菜品（需要 cuisine、image_url / displayUrl）
    dish: { type: Object, required: true },
    // s 列表小图 / m 卡片 / l 详情页大图
    size: { type: String, default: 'm' },
})

const cuisine = computed(() => cuisineOf(props.dish.cuisine))
const src = computed(() => {
    const d = props.dish
    if (d.displayUrl) return d.displayUrl
    return d.image_url && !String(d.image_url).startsWith('cloud://') ? d.image_url : ''
})
const placeholderStyle = computed(() =>
    src.value ? {} : { background: `linear-gradient(145deg, ${cuisine.value.color} 0%, #fbf4ec 100%)` }
)
</script>

<style scoped>
.dish-cover {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--bg-2);
}
.dish-cover--s {
    width: 132rpx;
    height: 132rpx;
    border-radius: 28rpx;
}
.dish-cover--m {
    width: 100%;
    height: 240rpx;
    border-radius: 28rpx;
}
.dish-cover--l {
    width: 100%;
    height: 520rpx;
}
.dish-cover-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
/* 一圈淡淡的白色光晕，让占位图像一只盘子 */
.dish-cover-ring {
    position: absolute;
    width: 72%;
    padding-top: 72%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.35) 55%, rgba(255, 255, 255, 0) 72%);
}
.dish-cover--s .dish-cover-ring {
    width: 96%;
    padding-top: 96%;
}
.dish-cover-emoji {
    position: relative;
    font-size: 72rpx;
    line-height: 1.1;
}
.dish-cover--s .dish-cover-emoji {
    font-size: 56rpx;
}
.dish-cover--l .dish-cover-emoji {
    font-size: 150rpx;
}
.dish-cover-label {
    position: relative;
    margin-top: 10rpx;
    font-size: 20rpx;
    letter-spacing: 0.24em;
    color: rgba(30, 26, 23, 0.55);
}
.dish-cover--l .dish-cover-label {
    font-size: 24rpx;
    margin-top: 18rpx;
}
</style>
