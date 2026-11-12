/**
 * 前端共享类型
 */

/** 云数据库中的一条记录（字段不固定，至少有 _id） */
export interface CloudRecord {
    _id: string
    createTime?: string | number | Date
    [key: string]: any
}

/** 经期记录 */
export interface PeriodRecord extends CloudRecord {
    startDate: string
    endDate?: string | null
    note?: string | null
}

/** 经期周期设置 */
export interface PeriodSettings {
    cycleLength: number
    periodLength: number
    remindDays: number
}

/** 小程序触摸事件中本模块用到的部分 */
export interface DragTouchEvent {
    touches: { clientX: number; clientY: number }[]
    currentTarget: { offsetHeight?: number; offsetWidth?: number }
}
