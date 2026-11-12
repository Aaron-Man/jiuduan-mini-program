import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const rules = require('../cloud/functions/db/rules.js')

describe('db 云函数：集合与字段规则', () => {
    it('authorized_users / invite_codes 不能经 db 云函数访问', () => {
        expect(rules.checkCollection('authorized_users')?.code).toBe(403)
        expect(rules.checkCollection('invite_codes')?.code).toBe(403)
        expect(rules.checkCollection('orders')?.code).toBe(403)
        expect(rules.checkCollection('')?.code).toBe(-1)
        expect(rules.checkCollection('statuses')).toBeNull()
    })

    it('客户端不能写入系统字段', () => {
        const clean = rules.sanitizeData({ _id: 'x', _openid: 'o', owner_openid: 'p', title: 't' })
        expect(clean).toEqual({ title: 't' })
    })

    it('评论/点赞只有作者本人或管理员可以修改', () => {
        const doc = { user_id: 'u1' }
        expect(rules.canModifyAuthored(doc, { _id: 'u1', role: 'member' })).toBe(true)
        expect(rules.canModifyAuthored(doc, { _id: 'u2', role: 'member' })).toBe(false)
        expect(rules.canModifyAuthored(doc, { _id: 'u2', role: 'admin' })).toBe(true)
        expect(rules.canModifyAuthored(null, { _id: 'u1', role: 'member' })).toBe(false)
    })

    it('chunk 分批', () => {
        expect(rules.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
        expect(rules.chunk([], 3)).toEqual([])
    })
})

describe('db 云函数：级联清理', () => {
    it('删除照片时清理文件和以 photo.id 关联的点赞评论', () => {
        const doc = { _id: 'db1', id: 'p_1', fileID: 'cloud://env/gallery/a.jpg' }
        expect(rules.filesOfDoc('gallery_photos', doc)).toEqual(['cloud://env/gallery/a.jpg'])
        expect(rules.interactionTargetOf('gallery_photos', doc)).toEqual({ target_type: 'photo', target_id: 'p_1' })
    })

    it('删除心情时以 _id 关联点赞评论；非云文件不删除', () => {
        const doc = { _id: 's1', imageUrl: 'https://example.com/a.jpg' }
        expect(rules.filesOfDoc('statuses', doc)).toEqual([])
        expect(rules.interactionTargetOf('statuses', doc)).toEqual({ target_type: 'status', target_id: 's1' })
    })

    it('备忘没有级联规则', () => {
        expect(rules.filesOfDoc('memos', { _id: 'm' })).toEqual([])
        expect(rules.interactionTargetOf('memos', { _id: 'm' })).toBeNull()
    })

    it('更换图片时删除旧文件', () => {
        const before = { image_url: 'cloud://old.jpg' }
        expect(rules.staleFilesAfterUpdate('dishes', before, { image_url: 'cloud://new.jpg' })).toEqual([
            'cloud://old.jpg',
        ])
        expect(rules.staleFilesAfterUpdate('dishes', before, { name: '红烧肉' })).toEqual([])
        expect(rules.touchesFiles('dishes', { name: 'x' })).toBe(false)
        expect(rules.touchesFiles('dishes', { image_url: '' })).toBe(true)
    })

    it('背景图库：移出图库的文件删除，仍是当前背景的不删', () => {
        const before = { bg_image: 'cloud://a', bg_images: ['cloud://a', 'cloud://b', 'cloud://c'] }
        // 从图库移除 a（当前背景）和 b
        const stale = rules.staleFilesAfterUpdate('profiles', before, { bg_images: ['cloud://c'] })
        expect(stale).toEqual(['cloud://b'])
    })

    it('背景从图库图片切换为纯色：图片仍在图库中，不删除', () => {
        const before = { bg_image: 'cloud://a', bg_images: ['cloud://a'] }
        expect(rules.staleFilesAfterUpdate('profiles', before, { bg_image: 'color:matcha' })).toEqual([])
    })
})
