import { NextRequest, NextResponse } from 'next/server'
import {
    buildTelegramProfilePatch,
    normalizeOptionalString,
    telegramDisplayName,
} from '@/lib/auth/syncTelegramProfile'
import { generateUniqueReferralCode, hasReferralCode, isFirstUserpicSave } from '@/lib/auth/referralCode'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { TelegramAuthRequest, User } from '@/types/user'

/**
 * API endpoint для аутентификации через Telegram Mini App.
 * referral_code выдаётся только при первом сохранении userpic (первый вход в приложение с фото).
 */
export async function POST(request: NextRequest) {
    try {
        const body: TelegramAuthRequest = await request.json()
        const { telegram_id, username, first_name, last_name, photo_url, referral_code: incomingReferralRaw } = body

        if (!telegram_id || !first_name) {
            return NextResponse.json(
                { error: 'telegram_id и first_name обязательны' },
                { status: 400 }
            )
        }

        const supabase = createServiceRoleClient()
        const incomingPhoto = normalizeOptionalString(photo_url)

        const { data: existingUser, error: findError } = await supabase
            .from('clubtac_users')
            .select('*')
            .eq('telegram_id', telegram_id)
            .maybeSingle()

        if (findError) {
            console.error('API /auth/telegram: find user:', findError)
            return NextResponse.json(
                { error: 'Ошибка при поиске пользователя', details: findError.message },
                { status: 500 }
            )
        }

        if (existingUser) {
            let user = existingUser as User
            if (user.id == null) {
                return NextResponse.json({ error: 'Некорректная запись пользователя в БД' }, { status: 500 })
            }

            const profilePatch = buildTelegramProfilePatch(user, {
                username,
                first_name,
                last_name,
                photo_url,
            })

            const patch: Record<string, string | null> = { ...(profilePatch ?? {}) }

            if (isFirstUserpicSave(user, photo_url) && !hasReferralCode(user.referral_code)) {
                try {
                    patch.referral_code = await generateUniqueReferralCode(supabase)
                } catch (e) {
                    console.error('API /auth/telegram: referral_code при первом userpic:', e)
                    return NextResponse.json(
                        {
                            error: 'Не удалось выдать реферальный код',
                            details: e instanceof Error ? e.message : 'Unknown error',
                        },
                        { status: 500 }
                    )
                }
            }

            if (Object.keys(patch).length > 0) {
                const { data: profileUpdated, error: profileErr } = await supabase
                    .from('clubtac_users')
                    .update(patch)
                    .eq('id', user.id)
                    .select()
                    .single()

                if (profileErr) {
                    console.error('API /auth/telegram: profile update:', profileErr)
                } else if (profileUpdated) {
                    user = profileUpdated as User
                }
            }

            return NextResponse.json({ user }, { status: 200 })
        }

        const incomingRef =
            typeof incomingReferralRaw === 'string' ? incomingReferralRaw.trim().toLowerCase() : ''

        let referredByUserId: number | null = null
        if (incomingRef) {
            const { data: inviter } = await supabase
                .from('clubtac_users')
                .select('id, telegram_id')
                .eq('referral_code', incomingRef)
                .maybeSingle()
            if (inviter && inviter.telegram_id !== telegram_id) {
                referredByUserId = inviter.id
            }
        }

        const displayNickname = telegramDisplayName(first_name, last_name)
        let ownReferralCode: string | null = null
        if (incomingPhoto) {
            ownReferralCode = await generateUniqueReferralCode(supabase)
        }

        const { data: newUser, error: createError } = await supabase
            .from('clubtac_users')
            .insert({
                telegram_id,
                username: normalizeOptionalString(username),
                first_name: first_name.trim(),
                last_name: normalizeOptionalString(last_name),
                nickname: displayNickname || null,
                userpic: incomingPhoto,
                referral_code: ownReferralCode,
                referred_by_user_id: referredByUserId,
            })
            .select()
            .single()

        if (createError) {
            console.error('API /auth/telegram: create user:', createError)
            return NextResponse.json(
                { error: 'Ошибка при создании пользователя', details: createError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({ user: newUser as User }, { status: 201 })
    } catch (error) {
        console.error('API /auth/telegram:', error)
        return NextResponse.json(
            { error: 'Внутренняя ошибка сервера', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
