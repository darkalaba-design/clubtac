import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/api'
import type { TelegramAuthRequest } from '@/types/user'

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
        const { telegram_id, username, first_name, last_name } = body

        console.log('API /auth/telegram: Получены данные:', { telegram_id, username, first_name, last_name })

        // Валидация обязательных полей
        if (!telegram_id || !first_name) {
            console.error('API /auth/telegram: Отсутствуют обязательные поля')
            return NextResponse.json(
                { error: 'telegram_id и first_name обязательны' },
                { status: 400 }
            )
        }

        // Подключение к Supabase
        const supabase = createClient()
        console.log('API /auth/telegram: Supabase клиент создан')

        // Поиск существующего пользователя по telegram_id
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
            // PGRST116 - это "not found", это нормально
            // Другие ошибки - это проблемы
            console.error('API /auth/telegram: Ошибка при поиске пользователя:', findError)
            return NextResponse.json(
                { error: 'Ошибка при поиске пользователя', details: findError.message },
                { status: 500 }
            )
        }

        // Если пользователь найден - возвращаем его
        if (existingUser) {
            console.log('API /auth/telegram: Пользователь найден, возвращаем:', existingUser)
            return NextResponse.json({ user: existingUser }, { status: 200 })
        }

        // Если пользователь не найден - создаём нового
        console.log('API /auth/telegram: Пользователь не найден, создаём нового')
        const { data: newUser, error: createError } = await supabase
            .from('clubtac_users')
            .insert({
                telegram_id,
                username: username || null,
                first_name,
                last_name: last_name || null,
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

