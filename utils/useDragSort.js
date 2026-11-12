/**
 * 列表/网格拖拽排序 composable
 * 使用页面：status / journal / travel / memo / menu(菜品+分类) / gallery
 */
import { ref } from 'vue'
import { dbBatchUpdate } from './cloud'

const resolveList = source => (Array.isArray(source) ? source : source.value)

/**
 * 只把排序字段发生变化的项写回数据库，并同步更新本地值
 */
async function persistOrder(collection, list, field = 'sort_order') {
    const changed = []
    list.forEach((item, i) => {
        if (item && item._id && item[field] !== i) {
            item[field] = i
            changed.push(item)
        }
    })
    if (!collection || changed.length === 0) return
    try {
        await dbBatchUpdate(
            collection,
            changed.map(item => ({ id: item._id, data: { [field]: item[field] } }))
        )
    } catch (e) {
        console.error('[拖拽排序] 保存失败:', e)
    }
}

/**
 * 按手动排序展示列表（心情 / 日志 / 旅行 / 备忘）
 * - 拖拽过的记录带有 manual_order（0 在最上面）
 * - 没有 manual_order 的记录（新建的、或从未拖拽过的）排在最前，按创建时间倒序
 * 因此从未拖拽过的列表为「最新在前」，拖拽后的顺序会被保留
 */
export function sortByManualOrder(list, field = 'manual_order') {
    const has = v => typeof v === 'number'
    return list.sort((a, b) => {
        const ha = has(a[field]),
            hb = has(b[field])
        if (ha && hb && a[field] !== b[field]) return a[field] - b[field]
        if (ha !== hb) return ha ? 1 : -1
        return new Date(b.createTime ?? 0).getTime() - new Date(a.createTime ?? 0).getTime()
    })
}

/** 交换可见列表中的 a、b 两项；有 backingRef（完整列表）时在完整列表中交换 */
function swapItems(list, a, b, backingRef) {
    if (backingRef) {
        const full = backingRef.value
        const ia = full.indexOf(list[a])
        const ib = full.indexOf(list[b])
        if (ia < 0 || ib < 0) return false
        const tmp = full[ia]
        full[ia] = full[ib]
        full[ib] = tmp
    } else {
        const tmp = list[a]
        list[a] = list[b]
        list[b] = tmp
    }
    return true
}

/**
 * 列表拖拽排序
 * listRef 是筛选后的视图（computed）时，传入 backingRef（完整列表）：交换作用到完整列表，排序也按完整列表写回
 */
export function useListDrag(listRef, { collection, onDrop, backingRef, orderField = 'sort_order' } = {}) {
    const getList = () => resolveList(listRef)
    const dragging = ref(false)
    const dragIndex = ref(-1)
    const dragOffset = ref(0)
    let _startY = 0
    let _timer
    let _itemH = 0
    function onDragStart(e, idx) {
        _startY = e.touches[0].clientY
        _timer = setTimeout(() => {
            dragging.value = true
            dragIndex.value = idx
            dragOffset.value = 0
            _itemH = e.currentTarget.offsetHeight || 80
            uni.vibrateShort({ type: 'medium' })
        }, 350)
    }
    function onDragMove(e) {
        if (!dragging.value) {
            clearTimeout(_timer)
            return
        }
        const list = getList()
        const dy = e.touches[0].clientY - _startY
        dragOffset.value = dy
        const swap = Math.round(dy / _itemH)
        if (swap !== 0) {
            const ni = dragIndex.value + swap
            if (ni >= 0 && ni < list.length && swapItems(list, dragIndex.value, ni, backingRef)) {
                dragIndex.value = ni
                _startY += swap * _itemH
                dragOffset.value = dy - swap * _itemH
                uni.vibrateShort({ type: 'light' })
            }
        }
    }
    async function onDragEnd() {
        clearTimeout(_timer)
        if (!dragging.value) return
        const finalList = backingRef ? [...backingRef.value] : [...getList()]
        dragging.value = false
        dragIndex.value = -1
        dragOffset.value = 0
        await persistOrder(collection, finalList, orderField)
        if (onDrop) onDrop(finalList)
    }
    return {
        dragging,
        dragIndex,
        dragOffset,
        onDragStart,
        onDragMove,
        onDragEnd,
    }
}

/**
 * 网格拖拽排序 composable（2 列网格，用于相册）
 * extendList：分页场景下把未加载的记录接在后面一起写回顺序，避免已加载部分重新编号后与未加载部分的 sort_order 重复
 */
export function useGridDrag(listRef, { collection, onDrop, backingRef, extendList } = {}) {
    const getList = () => resolveList(listRef)
    const dragging = ref(false)
    const dragFromIdx = ref(-1)
    const dragOverIdx = ref(-1)
    const dragDx = ref(0)
    const dragDy = ref(0)
    const dragMoved = ref(false)
    const COLS = 2
    let _startX = 0
    let _startY = 0
    let _timer
    let _itemW = 0
    let _itemH = 0
    function onDragStart(e, idx) {
        _startX = e.touches[0].clientX
        _startY = e.touches[0].clientY
        _timer = setTimeout(() => {
            dragging.value = true
            dragFromIdx.value = idx
            dragOverIdx.value = idx
            dragDx.value = 0
            dragDy.value = 0
            dragMoved.value = false
            _itemW = e.currentTarget.offsetWidth || 160
            _itemH = e.currentTarget.offsetHeight || 160
            uni.vibrateShort({ type: 'medium' })
        }, 350)
    }
    function onDragMove(e) {
        if (!dragging.value) {
            clearTimeout(_timer)
            return
        }
        const list = getList()
        const touch = e.touches[0]
        const dx = touch.clientX - _startX
        const dy = touch.clientY - _startY
        dragDx.value = dx
        dragDy.value = dy
        // 计算目标网格位置
        const colShift = Math.round(dx / _itemW)
        const rowShift = Math.round(dy / _itemH)
        if (colShift === 0 && rowShift === 0) return
        const curIdx = dragFromIdx.value
        const curCol = curIdx % COLS
        const curRow = Math.floor(curIdx / COLS)
        const targetCol = curCol + colShift
        const targetRow = curRow + rowShift
        if (targetCol < 0 || targetCol >= COLS || targetRow < 0) return
        const targetIdx = targetRow * COLS + targetCol
        if (
            targetIdx >= 0 &&
            targetIdx < list.length &&
            targetIdx !== curIdx &&
            swapItems(list, curIdx, targetIdx, backingRef)
        ) {
            dragFromIdx.value = targetIdx
            dragOverIdx.value = targetIdx
            _startX += colShift * _itemW
            _startY += rowShift * _itemH
            dragDx.value = touch.clientX - _startX
            dragDy.value = touch.clientY - _startY
            dragMoved.value = true
            uni.vibrateShort({ type: 'light' })
        }
    }
    async function onDragEnd() {
        clearTimeout(_timer)
        if (!dragging.value) return
        const ordered = backingRef ? [...backingRef.value] : [...getList()]
        const finalList = extendList ? extendList(ordered) : ordered
        dragging.value = false
        dragFromIdx.value = -1
        dragOverIdx.value = -1
        dragDx.value = 0
        dragDy.value = 0
        await persistOrder(collection, finalList)
        if (onDrop) onDrop(finalList)
    }
    return {
        dragging,
        dragFromIdx,
        dragOverIdx,
        dragDx,
        dragDy,
        dragMoved,
        onDragStart,
        onDragMove,
        onDragEnd,
    }
}
