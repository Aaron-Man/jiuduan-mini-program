import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const invite = require('../cloud/functions/auth/invite.js')

describe('auth 云函数：邀请码', () => {
    it('生成 6 位、只含无歧义字符的邀请码', () => {
        for (let i = 0; i < 200; i++) {
            const code = invite.randomInviteCode()
            expect(code).toHaveLength(6)
            expect([...code].every(c => invite.INVITE_ALPHABET.includes(c))).toBe(true)
            expect(code).not.toMatch(/[01OIL]/)
        }
    })

    it('拒绝采样：丢弃会造成取模偏差的字节', () => {
        // 248 及以上的字节会被丢弃（31 * 8 = 248）
        const bytes = [255, 248, 0, 1, 30, 31, 249, 62, 5, 6, 7, 8]
        const fake = () => Buffer.from(bytes)
        const code = invite.randomInviteCode(6, fake)
        const A = invite.INVITE_ALPHABET
        expect(code).toBe(A[0] + A[1] + A[30] + A[0] + A[0] + A[5])
    })

    it('规范化输入', () => {
        expect(invite.normalizeInviteCode(' abc234 ')).toBe('ABC234')
        expect(invite.normalizeInviteCode('abc')).toBe('')
        expect(invite.normalizeInviteCode(null)).toBe('')
    })

    it('使用次数限制在 1~50，默认 10', () => {
        expect(invite.clampMaxUses(undefined)).toBe(10)
        expect(invite.clampMaxUses('0')).toBe(10)
        expect(invite.clampMaxUses(-3)).toBe(1)
        expect(invite.clampMaxUses(999)).toBe(50)
        expect(invite.clampMaxUses('5')).toBe(5)
    })

    it('邀请码可用性检查', () => {
        const now = new Date('2026-11-12T00:00:00Z')
        const future = new Date('2026-11-15T00:00:00Z')
        const past = new Date('2026-11-01T00:00:00Z')
        expect(invite.inviteError(null, now)).toBe('邀请码无效')
        expect(invite.inviteError({ expireTime: future }, now)).toBeNull()
        expect(invite.inviteError({ expireTime: past }, now)).toBe('邀请码已过期')
        expect(invite.inviteError({ expireTime: future, revoked: true }, now)).toBe('邀请码已被撤销')
        expect(invite.inviteError({ expireTime: future, max_uses: 2, used_count: 2 }, now)).toBe(
            '邀请码使用次数已达上限'
        )
        expect(invite.inviteError({ expireTime: future, max_uses: 2, used_count: 1 }, now)).toBeNull()
        // 没有 max_uses 字段：不限次数
        expect(invite.inviteError({ expireTime: future, used_count: 99 }, now)).toBeNull()
    })
})
