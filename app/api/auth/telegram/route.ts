import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/api'
import type { TelegramAuthRequest } from '@/types/user'

async function generateUniqueReferralCode(supabase: ReturnType<typeof createClient>): Promise<string> {
    for (let i = 0; i < 30; i++) {
        const candidate = randomBytes(5).toString('hex')
        const { data } = await supabase.from('clubtac_users').select('id').eq('referral_code', candidate).maybeSingle()
        if (!data) return candidate
    }
    throw new Error('Could not generate unique referral_code')
}

/**
 * API endpoint для аутентификации через Telegram Mini App
 *
 * TODO: Добавить проверку подписи initData для безопасности
 * Проверка должна валидировать, что данные действительно пришли от Telegram
 * Используя секретный ключ бота и алгоритм проверки подписи Telegram
 */
export async function POST(request: NextRequest) {
    try {
        const body: TelegramAuthRequest = await request.json()
        const { telegram_id, username, first_name, last_name, photo_url, referral_code: incomingReferralRaw } = body

        console.log('API /auth/telegram: Получены данные:', {
            telegram_id,
            username,
            first_name,
            last_name,
            photo_url,
            has_referral: !!incomingReferralRaw,
        })

        // Валидация обязательных полей
        if (!telegram_id || !first_name) {
            console.error('API /auth/telegram: Отсутствуют обязательные поля')
            return NextResponse.json(
                { error: 'telegram_id и first_name обязательны' },
                { status: 400 }
            )
        }

        const supabase = createClient()
        console.log('API /auth/telegram: Supabase клиент создан')

        console.log('API /auth/telegram: Поиск пользователя с telegram_id:', telegram_id)
        const { data: existingUser, error: findError } = await supabase
            .from('clubtac_users')
            .select('*')
            .eq('telegram_id', telegram_id)
            .single()

        console.log('API /auth/telegram: Результат поиска:', {
            found: !!existingUser,
            error: findError ? { code: findError.code, message: findError.message } : null,
        })

        if (findError && findError.code !== 'PGRST116') {
            console.error('API /auth/telegram: Ошибка при поиске пользователя:', findError)
            return NextResponse.json(
                { error: 'Ошибка при поиске пользователя', details: findError.message },
                { status: 500 }
            )
        }

        if (existingUser) {
            console.log('API /auth/telegram: Пользователь найден, возвращаем:', existingUser)

            // Миграция без backfill в БД: догенерируем referral_code при отсутствии
            if (!existingUser.referral_code) {
                try {
                    const code = await generateUniqueReferralCode(supabase)
                    const { data: updated, error: upErr } = await supabase
                        .from('clubtac_users')
                        .update({ referral_code: code })
                        .eq('id', existingUser.id)
                        .select()
                        .single()
                    if (!upErr && updated) {
                        Object.assign(existingUser, updated)
                    }
                } catch (e) {
                    console.error('API /auth/telegram: не удалось выставить referral_code существующему:', e)
                }
            }

            const shouldSendWebhook = photo_url && (
                !existingUser.userpic ||
                existingUser.userpic !== photo_url
            )

            if (shouldSendWebhook) {
                try {
                    await fetch('https://hook.eu2.make.com/wp9c6tglisd4sok6299oskxklys18n3i', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            telegram_id: telegram_id,
                            photo_url: photo_url,
                        }),
                    })
                } catch (webhookError) {
                    console.error('API /auth/telegram: Ошибка отправки на webhook:', webhookError)
                }
            }
            return NextResponse.json({ user: existingUser }, { status: 200 })
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

        const ownReferralCode = await generateUniqueReferralCode(supabase)

        console.log('API /auth/telegram: Пользователь не найден, создаём нового')
        const { data: newUser, error: createError } = await supabase
            .from('clubtac_users')
            .insert({
                telegram_id,
                username: username || null,
                first_name,
                last_name: last_name || null,
                referral_code: ownReferralCode,
                referred_by_user_id: referredByUserId,
            })
            .select()
            .single()

        if (createError) {
            console.error('API /auth/telegram: Ошибка при создании пользователя:', createError)
            return NextResponse.json(
                { error: 'Ошибка при создании пользователя', details: createError.message },
                { status: 500 }
            )
        }

        console.log('API /auth/telegram: Новый пользователь создан:', newUser)

        if (photo_url) {
            try {
                await fetch('https://hook.eu2.make.com/wp9c6tglisd4sok6299oskxklys18n3i', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        telegram_id: telegram_id,
                        photo_url: photo_url,
                    }),
                })
            } catch (webhookError) {
                console.error('API /auth/telegram: Ошибка отправки на webhook:', webhookError)
            }
        }

        return NextResponse.json({ user: newUser }, { status: 201 })
    } catch (error) {
        console.error('API /auth/telegram: Неожиданная ошибка:', error)
        if (error instanceof Error) {
            console.error('API /auth/telegram: Детали ошибки:', error.message, error.stack)
        }
        return NextResponse.json(
            { error: 'Внутренняя ошибка сервера', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
