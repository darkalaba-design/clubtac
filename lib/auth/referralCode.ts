import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOptionalString } from '@/lib/auth/syncTelegramProfile'

export function hasReferralCode(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

/** Случайный уникальный код (10 hex-символов). */
export async function generateUniqueReferralCode(supabase: SupabaseClient): Promise<string> {
    for (let i = 0; i < 30; i++) {
        const candidate = randomBytes(5).toString('hex')
        const { data } = await supabase
            .from('clubtac_users')
            .select('id')
            .eq('referral_code', candidate)
            .maybeSingle()
        if (!data) return candidate
    }
    throw new Error('Could not generate unique referral_code')
}

/** Первое сохранение аватара: в БД пусто, из Telegram пришёл photo_url. */
export function isFirstUserpicSave(
    user: { userpic?: string | null },
    photo_url?: string | null
): boolean {
    const hadPic = !!(user.userpic?.trim())
    const incoming = normalizeOptionalString(photo_url)
    return !hadPic && !!incoming
}

/**
 * Выдать referral_code при первом сохранении userpic (вход в Mini App).
 * Иначе не трогать.
 */
export async function assignReferralOnFirstUserpicSave(
    supabase: SupabaseClient,
    user: { id: number; referral_code?: string | null; userpic?: string | null },
    photo_url?: string | null
): Promise<string | null> {
    if (hasReferralCode(user.referral_code)) {
        return user.referral_code.trim()
    }
    if (!isFirstUserpicSave(user, photo_url)) {
        return null
    }
    return ensureUserReferralCode(supabase, user)
}

/**
 * Гарантирует referral_code у пользователя (создание или догенерация).
 * Возвращает актуальный код.
 */
export async function ensureUserReferralCode(
    supabase: SupabaseClient,
    user: { id: number; referral_code?: string | null }
): Promise<string> {
    if (hasReferralCode(user.referral_code)) {
        return user.referral_code.trim()
    }

    const code = await generateUniqueReferralCode(supabase)
    const { data, error } = await supabase
        .from('clubtac_users')
        .update({ referral_code: code })
        .eq('id', user.id)
        .select('referral_code')
        .single()

    if (error) {
        console.error('ensureUserReferralCode update:', error)
        throw error
    }

    const saved = data?.referral_code
    if (!hasReferralCode(saved)) {
        throw new Error('referral_code missing after update')
    }

    return saved.trim()
}
