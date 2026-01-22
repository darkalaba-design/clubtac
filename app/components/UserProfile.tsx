'use client'

import React from 'react'
import { useUser } from '../contexts/UserContext'

/**
 * ВРЕМЕННЫЙ компонент для отладки Telegram данных
 */
function DebugTelegram() {
    // Используем useState и useEffect для клиентского рендеринга
    const [debugData, setDebugData] = React.useState<any>(null)

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const tg = (window as any).Telegram?.WebApp
            setDebugData({
                hasTelegram: !!(window as any).Telegram,
                hasWebApp: !!tg,
                hasInitDataUnsafe: !!tg?.initDataUnsafe,
                hasUser: !!tg?.initDataUnsafe?.user,
                initDataUnsafe: tg?.initDataUnsafe,
                fullTelegram: (window as any).Telegram,
            })
        }
    }, [])

    return (
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f0f0f0', borderRadius: '8px', border: '2px solid #007bff' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#007bff' }}>🔍 Debug: Telegram WebApp данные</h3>
            {debugData ? (
                <>
                    <div style={{ marginBottom: '12px', fontSize: '12px', color: '#666' }}>
                        <p><strong>Has Telegram:</strong> {debugData.hasTelegram ? '✅ Да' : '❌ Нет'}</p>
                        <p><strong>Has WebApp:</strong> {debugData.hasWebApp ? '✅ Да' : '❌ Нет'}</p>
                        <p><strong>Has initDataUnsafe:</strong> {debugData.hasInitDataUnsafe ? '✅ Да' : '❌ Нет'}</p>
                        <p><strong>Has user:</strong> {debugData.hasUser ? '✅ Да' : '❌ Нет'}</p>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                        <strong style={{ fontSize: '12px' }}>initDataUnsafe:</strong>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, overflow: 'auto', maxHeight: '300px', backgroundColor: '#fff', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                            {JSON.stringify(debugData.initDataUnsafe, null, 2) || 'null'}
                        </pre>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                        <strong style={{ fontSize: '12px' }}>Полный объект Telegram:</strong>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, overflow: 'auto', maxHeight: '200px', backgroundColor: '#fff', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                            {JSON.stringify(debugData.fullTelegram, null, 2) || 'null'}
                        </pre>
                    </div>
                </>
            ) : (
                <p style={{ fontSize: '12px', color: '#666' }}>Загрузка данных отладки...</p>
            )}
        </div>
    )
}

/**
 * Компонент для отображения профиля залогиненного пользователя
 */
export default function UserProfile() {
    const { user, loading } = useUser()

    if (loading) {
        return (
            <div style={{ padding: '12px' }}>
                <DebugTelegram />
                <div style={{ textAlign: 'center' }}>
                    <p>Загрузка...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div style={{ padding: '12px' }}>
                <DebugTelegram />
                <div
                    style={{
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #ffc107',
                        marginTop: '12px',
                    }}
                >
                    <p style={{ margin: 0, marginBottom: '8px', fontWeight: 'bold' }}>
                        ⚠️ Пользователь не найден
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                        Убедитесь, что вы открыли приложение через Telegram Mini App.
                        Проверьте консоль браузера для получения дополнительной информации.
                    </p>
                </div>
            </div>
        )
    }

    // Форматирование даты регистрации
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Не указано'
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })
        } catch {
            return dateString
        }
    }

    const displayName = user.username || user.first_name || 'Пользователь'
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || displayName

    return (
        <div style={{ padding: '12px' }}>
            <DebugTelegram />

            <div
                style={{
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    padding: '20px',
                    marginBottom: '16px',
                }}
            >
                <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>
                    👤 Профиль пользователя
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <strong style={{ display: 'block', marginBottom: '4px', color: '#666' }}>
                            Имя пользователя:
                        </strong>
                        <span style={{ fontSize: '16px' }}>{displayName}</span>
                    </div>

                    {user.first_name && (
                        <div>
                            <strong style={{ display: 'block', marginBottom: '4px', color: '#666' }}>
                                Полное имя:
                            </strong>
                            <span style={{ fontSize: '16px' }}>{fullName}</span>
                        </div>
                    )}

                    {user.username && (
                        <div>
                            <strong style={{ display: 'block', marginBottom: '4px', color: '#666' }}>
                                Username:
                            </strong>
                            <span style={{ fontSize: '16px' }}>@{user.username}</span>
                        </div>
                    )}

                    <div>
                        <strong style={{ display: 'block', marginBottom: '4px', color: '#666' }}>
                            Telegram ID:
                        </strong>
                        <span style={{ fontSize: '16px', fontFamily: 'monospace' }}>
                            {user.telegram_id}
                        </span>
                    </div>

                    {user.id && (
                        <div>
                            <strong style={{ display: 'block', marginBottom: '4px', color: '#666' }}>
                                ID в системе:
                            </strong>
                            <span style={{ fontSize: '16px', fontFamily: 'monospace' }}>
                                {user.id}
                            </span>
                        </div>
                    )}

                    {user.created_at && (
                        <div>
                            <strong style={{ display: 'block', marginBottom: '4px', color: '#666' }}>
                                Дата регистрации:
                            </strong>
                            <span style={{ fontSize: '16px' }}>{formatDate(user.created_at)}</span>
                        </div>
                    )}

                    {user.updated_at && user.updated_at !== user.created_at && (
                        <div>
                            <strong style={{ display: 'block', marginBottom: '4px', color: '#666' }}>
                                Последнее обновление:
                            </strong>
                            <span style={{ fontSize: '16px' }}>{formatDate(user.updated_at)}</span>
                        </div>
                    )}
                </div>
            </div>

            <div
                style={{
                    backgroundColor: '#e8f4f8',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '14px',
                    color: '#555',
                }}
            >
                <p style={{ margin: 0 }}>
                    💡 Это ваш профиль в системе ClubTac Rating. Здесь отображается информация,
                    полученная из Telegram.
                </p>
            </div>
        </div>
    )
}

