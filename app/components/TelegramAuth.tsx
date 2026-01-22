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
                // Ждём загрузки Telegram SDK с несколькими попытками
                let attempts = 0
                const maxAttempts = 10
                const checkInterval = 100 // 100ms между попытками

                const waitForTelegram = (): Promise<void> => {
                    return new Promise((resolve, reject) => {
                        const check = () => {
                            attempts++
                            if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                                resolve()
                            } else if (attempts >= maxAttempts) {
                                console.warn('Telegram WebApp SDK не загрузился после', maxAttempts, 'попыток')
                                reject(new Error('Telegram SDK not loaded'))
                            } else {
                                setTimeout(check, checkInterval)
                            }
                        }
                        check()
                    })
                }

                // Ждём загрузки SDK
                await waitForTelegram()

                // Проверяем ещё раз после ожидания
                if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
                    console.error('Telegram WebApp API не доступен после ожидания')
                    setLoading(false)
                    return
                }

                const webApp = window.Telegram.WebApp

                // Расширяем WebApp на весь экран
                webApp.expand()
                webApp.ready()

                const telegramUser = webApp.initDataUnsafe?.user

                console.log('Telegram WebApp данные:', {
                    hasWebApp: !!webApp,
                    hasInitData: !!webApp.initDataUnsafe,
                    hasUser: !!telegramUser,
                    user: telegramUser,
                    initDataUnsafe: webApp.initDataUnsafe,
                })

                if (!telegramUser) {
                    console.warn('Данные пользователя Telegram не найдены в initDataUnsafe.user')
                    console.warn('initDataUnsafe содержимое:', webApp.initDataUnsafe)
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

                console.log('Отправка данных на backend:', authData)

                // Отправляем данные на backend
                const response = await fetch('/api/auth/telegram', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(authData),
                })

                console.log('Ответ от API:', {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                })

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Не удалось прочитать ответ' }))
                    console.error('Ошибка аутентификации:', errorData)
                    setLoading(false)
                    return
                }

                const responseData = await response.json()
                console.log('Данные пользователя получены:', responseData)

                if (responseData.user) {
                    setUser(responseData.user as User)
                    console.log('Пользователь установлен в контекст:', responseData.user)
                } else {
                    console.error('Пользователь не найден в ответе API:', responseData)
                }
            } catch (error) {
                console.error('Ошибка при аутентификации:', error)
                if (error instanceof Error) {
                    console.error('Детали ошибки:', error.message, error.stack)
                }
            } finally {
                setLoading(false)
            }
        }

        authenticate()
    }, [setUser, setLoading])

    return null // Компонент не рендерит UI
}

