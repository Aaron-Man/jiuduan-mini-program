<template>
    <page-bg tone="butter" />
    <scroll-view scroll-y class="page" :class="{ 'photo-mode': isPhotoBg }">
        <view class="head ui-fade-up">
            <text class="ui-eyebrow">{{ isEditing ? 'EDIT RECIPE' : 'NEW RECIPE' }}</text>
            <text class="ui-title">{{ isEditing ? '编辑菜谱' : '添加菜谱' }}</text>
            <text class="ui-sub" v-if="form.source === 'builtin'">这是精选菜谱，改动会保存给全家看</text>
        </view>

        <view v-if="loading" class="group-card skeleton photo-glass">
            <view class="sk-line sk-line--title"></view>
            <view class="sk-line"></view>
            <view class="sk-line sk-line--short"></view>
        </view>

        <template v-else>
            <!-- 基本信息 -->
            <view class="group-card photo-glass ui-fade-up ui-d1">
                <view class="cell-h">
                    <view class="cell-icon ui-bubble ui-bubble--peach"><text>🏷️</text></view>
                    <input class="cell-input cell-input--title name-input" v-model="form.name" placeholder="菜名（必填）" maxlength="30" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <view class="cell-icon ui-bubble ui-bubble--lilac"><text>✍️</text></view>
                    <input class="cell-input" v-model="form.alias" placeholder="别名 / 英文名（选填）" maxlength="40" />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">描述</text>
                    <textarea
                        class="cell-textarea"
                        v-model="form.description"
                        placeholder="这道菜的故事、味道..."
                        :maxlength="500"
                        auto-height
                    />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <view class="cell-icon ui-bubble ui-bubble--butter"><text>📷</text></view>
                    <view class="img-pick ui-press" v-if="!imageDisplay" @tap="chooseImage">
                        <text class="img-pick-plus">＋</text>
                        <text class="img-pick-text">选择图片</text>
                    </view>
                    <view v-else class="img-preview">
                        <image :src="imageDisplay" class="preview-img" mode="aspectFill" @tap="chooseImage" />
                        <text class="img-remove" @tap="removeImage">×</text>
                    </view>
                </view>
            </view>

            <!-- 分类 -->
            <view class="group-card photo-glass ui-fade-up ui-d2">
                <view class="cell-v">
                    <text class="cell-v-label">菜系</text>
                    <scroll-view scroll-x class="chip-scroll" :show-scrollbar="false">
                        <view
                            v-for="r in REGIONS"
                            :key="r.key"
                            class="ui-chip chip region-chip"
                            :class="{ active: region === r.key }"
                            @tap="region = r.key"
                            >{{ r.emoji }} {{ r.label }}</view
                        >
                    </scroll-view>
                    <view class="tag-row cuisine-row">
                        <view
                            v-for="c in regionCuisines"
                            :key="c.key"
                            class="tag cuisine-chip"
                            :class="{ active: form.cuisine === c.key }"
                            @tap="form.cuisine = c.key"
                            >{{ c.emoji }} {{ c.label }}</view
                        >
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">餐别</text>
                    <view class="tag-row">
                        <view
                            v-for="c in COURSES"
                            :key="c.key"
                            class="tag course-chip"
                            :class="{ active: form.course === c.key }"
                            @tap="form.course = form.course === c.key ? '' : c.key"
                            >{{ c.emoji }} {{ c.label }}</view
                        >
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">标签（可多选）</text>
                    <view class="tag-row">
                        <view
                            v-for="t in TAGS"
                            :key="t.key"
                            class="tag tag-chip"
                            :class="{ active: form.tags.includes(t.key) }"
                            @tap="toggleIn(form.tags, t.key)"
                            >{{ t.emoji }} {{ t.label }}</view
                        >
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">我的分类（选填）</text>
                    <view class="tag-row">
                        <view
                            v-for="c in categories"
                            :key="c._id"
                            class="tag category-chip"
                            :class="{ active: form.category_ids.includes(c._id) }"
                            @tap="toggleIn(form.category_ids, c._id)"
                            >{{ form.category_ids.includes(c._id) ? '✓ ' : '' }}{{ c.name }}</view
                        >
                        <text v-if="categories.length === 0" class="hint">还没有自定义分类，可以在菜谱页添加</text>
                    </view>
                </view>
            </view>

            <!-- 时间 / 份量 / 难度 / 辣度 -->
            <view class="group-card photo-glass ui-fade-up ui-d3">
                <view class="cell-h">
                    <view class="cell-icon ui-bubble ui-bubble--sky"><text>⏱</text></view>
                    <text class="cell-label">用时</text>
                    <input class="cell-input num-input time-input" type="number" v-model="form.time_min" placeholder="—" />
                    <text class="cell-unit">分钟</text>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h">
                    <view class="cell-icon ui-bubble ui-bubble--rose"><text>👥</text></view>
                    <text class="cell-label">份量</text>
                    <input class="cell-input num-input servings-input" type="number" v-model="form.servings" placeholder="—" />
                    <text class="cell-unit">人份</text>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">难度</text>
                    <view class="tag-row">
                        <view
                            v-for="d in 5"
                            :key="d"
                            class="tag difficulty-chip"
                            :class="{ active: form.difficulty === d }"
                            @tap="form.difficulty = d"
                            >{{ DIFFICULTY_LABELS[d] }}</view
                        >
                    </view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">辣度</text>
                    <view class="tag-row">
                        <view
                            v-for="(label, s) in SPICE_LABELS"
                            :key="s"
                            class="tag spice-chip"
                            :class="{ active: form.spice === s }"
                            @tap="form.spice = s"
                            >{{ s ? '🌶️'.repeat(s) + ' ' : '' }}{{ label }}</view
                        >
                    </view>
                </view>
            </view>

            <!-- 食材 / 做法 / 小贴士 -->
            <view class="group-card photo-glass ui-fade-up ui-d4">
                <view class="cell-v">
                    <text class="cell-v-label">食材</text>
                    <textarea
                        class="cell-textarea ingredients-input"
                        v-model="form.ingredients"
                        placeholder="鸡蛋 3 个，番茄 2 个，葱 1 根"
                        :maxlength="1000"
                        auto-height
                    />
                    <text class="hint field-hint">用逗号分隔，详情页会变成可以勾选的清单</text>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">做法</text>
                    <view class="step-edit" v-for="(s, idx) in steps" :key="s.k">
                        <view class="step-edit-head">
                            <text class="step-edit-num ui-serif">{{ String(idx + 1).padStart(2, '0') }}</text>
                            <view class="step-ops">
                                <text class="step-op step-up ui-press" v-if="idx > 0" @tap="moveUp(idx)">↑ 上移</text>
                                <text class="step-op step-remove ui-press" @tap="removeStep(idx)">删除</text>
                            </view>
                        </view>
                        <textarea
                            class="cell-textarea step-input"
                            v-model="s.text"
                            :placeholder="'第 ' + (idx + 1) + ' 步做什么？'"
                            :maxlength="1000"
                            auto-height
                        />
                    </view>
                    <view class="add-step ui-press" @tap="addStep">＋ 添加一步</view>
                </view>
                <view class="cell-divider"></view>
                <view class="cell-v">
                    <text class="cell-v-label">小贴士</text>
                    <textarea
                        class="cell-textarea tips-input"
                        v-model="form.tips"
                        placeholder="火候、替换食材、容易翻车的地方..."
                        :maxlength="1000"
                        auto-height
                    />
                </view>
                <view class="cell-divider"></view>
                <view class="cell-h" @tap="form.available = !form.available">
                    <view class="check-box available-toggle" :class="{ checked: form.available }"></view>
                    <text class="cell-input">可点（加入点菜篮）</text>
                </view>
            </view>

            <view class="submit-btn ui-press" :class="{ disabled: submitting || !form.name.trim() }" @tap="handleSubmit">
                <text>{{ submitting ? '保存中...' : isEditing ? '保存修改' : '添加菜谱' }}</text>
            </view>
            <view class="bottom-space"></view>
        </template>
    </scroll-view>
</template>

<script setup>
/**
 * 新增 / 编辑菜谱（?id= 时编辑）
 * 图片选好后只在本地预览，保存时才上传，避免中途放弃在云存储留下孤儿文件
 */
import PageBg from '../../components/page-bg/page-bg.vue'
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { dbAdd, dbUpdate, uploadFile, fetchAllRecords, useSharedBg } from '../../utils/cloud'
import { DIFFICULTY_LABELS } from '../../utils/constants'
import { REGIONS, COURSES, TAGS, SPICE_LABELS, cuisineOf, fetchDish, fetchFacets, clearDishCaches } from '../../utils/menu'

const { isPhotoBg } = useSharedBg()

const dishId = ref('')
const isEditing = computed(() => !!dishId.value)
const loading = ref(false)
const submitting = ref(false)
const categories = ref([])

const emptyForm = () => ({
    name: '',
    alias: '',
    description: '',
    image_url: '',
    cuisine: 'cn-home',
    course: '',
    tags: [],
    time_min: '',
    servings: '',
    difficulty: 1,
    spice: 0,
    ingredients: '',
    tips: '',
    category_ids: [],
    available: true,
    source: '',
})
const form = ref(emptyForm())
const region = ref(REGIONS[0].key)
const regionCuisines = computed(() => (REGIONS.find(r => r.key === region.value) || REGIONS[0]).cuisines)

// 每一步带一个本地 key，上移 / 删除时 textarea 不会串内容
let stepSeq = 0
const makeStep = text => ({ k: ++stepSeq, text: text || '' })
const steps = ref([makeStep()])

const imageDisplay = ref('')
const pendingImagePath = ref('')

const toggleIn = (list, key) => {
    const idx = list.indexOf(key)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(key)
}

const addStep = () => steps.value.push(makeStep())
const removeStep = idx => {
    steps.value.splice(idx, 1)
    if (!steps.value.length) steps.value.push(makeStep())
}
const moveUp = idx => {
    if (idx <= 0) return
    const list = steps.value
    ;[list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]
}

const fillForm = d => {
    form.value = {
        name: d.name || '',
        alias: d.alias || '',
        description: d.description || '',
        image_url: d.image_url || '',
        // 早期的菜没有菜系：保持为空，用户不选就不写入，避免被误标成家常
        cuisine: d.cuisine || '',
        course: d.course || '',
        tags: [...(d.tags || [])],
        time_min: d.time_min ? String(d.time_min) : '',
        servings: d.servings ? String(d.servings) : '',
        difficulty: d.difficulty || 1,
        spice: typeof d.spice === 'number' ? d.spice : 0,
        ingredients: d.ingredients || '',
        tips: d.tips || '',
        category_ids: [...(d.category_ids || (d.category_id ? [d.category_id] : []))],
        available: d.available !== false,
        source: d.source || '',
    }
    region.value = cuisineOf(d.cuisine).region || REGIONS[0].key
    steps.value = (d.steps || []).filter(Boolean).map(makeStep)
    if (!steps.value.length) steps.value.push(makeStep())
    imageDisplay.value = d.displayUrl || ''
}

onLoad(async options => {
    dishId.value = options.id || ''
    uni.setNavigationBarTitle({ title: dishId.value ? '编辑菜谱' : '添加菜谱' })
    fetchAllRecords('categories', { orderBy: 'sort_order', orderType: 'asc' })
        .then(list => (categories.value = list || []))
        .catch(() => {})
    if (!dishId.value) return
    loading.value = true
    try {
        // 编辑必须基于最新内容，否则可能覆盖家人刚改过的做法
        fillForm(await fetchDish(dishId.value, { fresh: true }))
    } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
        setTimeout(() => uni.navigateBack(), 1200)
    } finally {
        loading.value = false
    }
})

const chooseImage = () => {
    uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        success: res => {
            pendingImagePath.value = res.tempFilePaths[0]
            imageDisplay.value = res.tempFilePaths[0]
        },
    })
}

const removeImage = () => {
    form.value.image_url = ''
    imageDisplay.value = ''
    pendingImagePath.value = ''
}

const toNum = v => {
    const n = parseInt(v, 10)
    return n > 0 ? n : null
}
const textOrNull = v => String(v || '').trim() || null

// 新菜放在家里菜的末尾：家里的菜数量 = 全部 - 精选
const nextSortOrder = async () => {
    try {
        const f = await fetchFacets()
        return Math.max((f.total || 0) - (f.builtin || 0), 0)
    } catch (e) {
        return 0
    }
}

const handleSubmit = async () => {
    if (submitting.value) return
    if (!form.value.name.trim()) {
        uni.showToast({ title: '请填写菜名', icon: 'none' })
        return
    }
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
        const f = form.value
        const data = {
            name: f.name.trim(),
            alias: textOrNull(f.alias),
            description: textOrNull(f.description),
            image_url: f.image_url || null,
            cuisine: f.cuisine || null,
            course: f.course || null,
            tags: f.tags,
            time_min: toNum(f.time_min),
            servings: toNum(f.servings),
            difficulty: f.difficulty,
            spice: f.spice,
            ingredients: textOrNull(f.ingredients),
            steps: steps.value.map(s => s.text.trim()).filter(Boolean),
            tips: textOrNull(f.tips),
            category_ids: f.category_ids,
            category_id: f.category_ids[0] || null,
            available: f.available,
        }
        if (isEditing.value) {
            await dbUpdate('dishes', dishId.value, data)
        } else {
            await dbAdd('dishes', { ...data, sort_order: await nextSortOrder(), order_count: 0, createTime: new Date() })
        }
        clearDishCaches()
        uni.$emit('menu:changed')
        uni.showToast({ title: isEditing.value ? '已保存' : '已添加', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
    } catch (e) {
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
.page {
    height: 100vh;
    background: transparent;
}
.head {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    padding: 40rpx 40rpx 28rpx;
}
.group-card {
    margin: 0 32rpx 28rpx;
    background: var(--card);
    border: 1rpx solid var(--card-border);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    overflow: hidden;
}
.skeleton {
    padding: 40rpx;
}
.sk-line {
    height: 28rpx;
    border-radius: 14rpx;
    background: var(--bg-2);
    margin-bottom: 20rpx;
}
.sk-line--title {
    width: 60%;
    height: 44rpx;
}
.sk-line--short {
    width: 40%;
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
.cell-label {
    font-size: 28rpx;
    color: var(--ink-2);
}
.num-input {
    text-align: right;
    font-family: var(--font-serif);
    font-size: 32rpx;
    font-weight: 700;
}
.cell-unit {
    font-size: 24rpx;
    color: var(--muted);
    width: 64rpx;
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
    min-height: 120rpx;
    font-size: 28rpx;
    color: var(--ink);
    background: var(--bg);
    border-radius: var(--r-m);
    padding: 20rpx 24rpx;
    box-sizing: border-box;
    line-height: 1.6;
}
.hint {
    font-size: 23rpx;
    color: var(--muted);
}
.field-hint {
    display: block;
    margin-top: 12rpx;
}
.chip-scroll {
    white-space: nowrap;
    margin-bottom: 20rpx;
}
.chip {
    margin-right: 12rpx;
}
.tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14rpx;
}
.tag {
    padding: 12rpx 26rpx;
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

.step-edit {
    margin-bottom: 24rpx;
}
.step-edit-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10rpx;
}
.step-edit-num {
    font-size: 40rpx;
    font-weight: 700;
    color: var(--peach);
    line-height: 1;
}
.step-ops {
    display: flex;
    gap: 12rpx;
}
.step-op {
    font-size: 22rpx;
    color: var(--muted);
    padding: 6rpx 18rpx;
    border-radius: 999rpx;
    border: 1rpx solid var(--line);
}
.step-remove {
    color: var(--coral);
}
.add-step {
    height: 80rpx;
    line-height: 80rpx;
    text-align: center;
    border-radius: var(--r-m);
    border: 2rpx dashed var(--faint);
    font-size: 26rpx;
    color: var(--ink-2);
    letter-spacing: 0.08em;
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
.submit-btn {
    margin: 12rpx 32rpx 0;
    height: 96rpx;
    line-height: 96rpx;
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
.bottom-space {
    height: calc(60rpx + env(safe-area-inset-bottom));
}
</style>
