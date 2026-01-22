'use client'

import { useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import type { TelegramAuthRequest, User } from '@/types/user'

/**
 * Компонент для аутентификации через Telegram Mini App
 * Получает данные пользователя из window.Telegram.WebApp.initDataUnsafe.user
 * и отправляет их на backend для создания/получения пользователя в Supabase
 */
export default function TelegramAuth() {
    const { setUser, setLoading } = useUser()

    useEffect(() => {
        const authenticate = async () => {
            try {
                // Проверяем наличие Telegram WebApp API
                if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
                    console.warn('Telegram WebApp API не доступен')
                    setLoading(false)
                    return
                }

                const webApp = window.Telegram.WebApp
                const telegramUser = webApp.initDataUnsafe?.user

                if (!telegramUser) {
                    console.warn('Данные пользователя Telegram не найдены')
                    setLoading(false)
                    return
                }

                // Подготавливаем данные для отправки на backend
                const authData: TelegramAuthRequest = {
                    telegram_id: telegramUser.id,
                    username: telegramUser.username,
                    first_name: telegramUser.first_name,
                    last_name: telegramUser.last_name,
                }

                // Отправляем данные на backend
                const response = await fetch('/api/auth/telegram', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(authData),
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    console.error('Ошибка аутентификации:', errorData)
                    setLoading(false)
                    return
                }

                const { user } = await response.json()
                setUser(user as User)

                // Инициализируем Telegram WebApp
                webApp.ready()
                webApp.expand()
            } catch (error) {
                console.error('Ошибка при аутентификации:', error)
            } finally {
                setLoading(false)
            }
        }

        authenticate()
    }, [setUser, setLoading])

    return null // Компонент не рендерит UI
}

