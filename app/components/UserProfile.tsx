'use client'

import React, { useEffect, useState } from 'react'
import { useUser } from '../contexts/UserContext'
import type { User } from '@/types/user'

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

interface UserStats {
    user: User
    stats: {
        place: number
        games_played: number
        wins: number
        win_rate: number
    } | null
    recentGames: Array<{
        game_id: number
        created_at: string
        player_1_1: string
        player_1_2: string
        player_2_1: string
        player_2_2: string
        score_1: number
        score_2: number
    }>
    bestPartners: Array<{
        name: string
        games: number
        wins: number
        winRate: number
    }>
}

/**
 * Компонент для отображения профиля залогиненного пользователя
 */
export default function UserProfile() {
    const { user, loading } = useUser()
    const [stats, setStats] = useState<UserStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(false)
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)

    // Получаем фото из Telegram
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const tg = (window as any).Telegram?.WebApp
            const telegramUser = tg?.initDataUnsafe?.user
            if (telegramUser?.photo_url) {
                setPhotoUrl(telegramUser.photo_url)
            }
        }
    }, [])

    // Загружаем статистику
    useEffect(() => {
        if (!user) return

        const loadStats = async () => {
            setStatsLoading(true)
            try {
                const params = new URLSearchParams()
                if (user.telegram_id) {
                    params.append('telegram_id', user.telegram_id.toString())
                } else if (user.username) {
                    params.append('username', user.username)
                }

                const response = await fetch(`/api/user/stats?${params.toString()}`)
                if (response.ok) {
                    const data = await response.json()
                    setStats(data)
                } else {
                    console.error('Ошибка загрузки статистики:', await response.text())
                }
            } catch (error) {
                console.error('Ошибка при загрузке статистики:', error)
            } finally {
                setStatsLoading(false)
            }
        }

        loadStats()
    }, [user])

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

    const displayName = user.username || user.first_name || 'Пользователь'
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || displayName

    // Форматирование даты
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })
        } catch {
            return dateString
        }
    }

    // Определяем, выиграл ли пользователь игру
    const didUserWin = (game: UserStats['recentGames'][0]) => {
        if (!user.username) return false
        const isTeam1 = game.player_1_1 === user.username || game.player_1_2 === user.username
        return isTeam1 ? game.score_1 > game.score_2 : game.score_2 > game.score_1
    }

    return (
        <div style={{ padding: '12px' }}>
            <DebugTelegram />

            {/* Компактный блок с информацией о пользователе */}
            <div
                style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                }}
            >
                {/* Фото */}
                <div
                    style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        backgroundColor: '#e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                    }}
                >
                    {photoUrl ? (
                        <img
                            src={photoUrl}
                            alt={fullName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <span style={{ fontSize: '32px' }}>👤</span>
                    )}
                </div>

                {/* Информация */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, marginBottom: '4px', fontSize: '18px', fontWeight: 'bold' }}>
                        {fullName}
                    </h2>
                    {user.username && (
                        <p style={{ margin: 0, marginBottom: '4px', fontSize: '14px', color: '#666' }}>
                            @{user.username}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#999', marginTop: '4px' }}>
                        {user.id && <span>ID: {user.id}</span>}
                        <span>TG: {user.telegram_id}</span>
                    </div>
                </div>
            </div>

            {/* Статистика */}
            {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p>Загрузка статистики...</p>
                </div>
            ) : stats?.stats ? (
                <div
                    style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                    }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        📊 Статистика
                    </h3>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '12px',
                        }}
                    >
                        <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Место в рейтинге</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>#{stats.stats.place}</div>
                        </div>
                        <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Игр сыграно</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.stats.games_played}</div>
                        </div>
                        <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Побед</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                                {stats.stats.wins}
                            </div>
                        </div>
                        <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Процент побед</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                                {stats.stats.win_rate}%
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    style={{
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px',
                        textAlign: 'center',
                    }}
                >
                    <p style={{ margin: 0, color: '#856404' }}>
                        Статистика недоступна. Возможно, вы ещё не играли.
                    </p>
                </div>
            )}

            {/* Последние игры */}
            {stats?.recentGames && stats.recentGames.length > 0 && (
                <div
                    style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                    }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        🎮 Последние игры
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.recentGames.map((game) => {
                            const won = didUserWin(game)
                            const isTeam1 = user.username && (game.player_1_1 === user.username || game.player_1_2 === user.username)
                            const partner = isTeam1
                                ? game.player_1_1 === user.username
                                    ? game.player_1_2
                                    : game.player_1_1
                                : game.player_2_1 === user.username
                                    ? game.player_2_2
                                    : game.player_2_1
                            const opponent1 = isTeam1 ? game.player_2_1 : game.player_1_1
                            const opponent2 = isTeam1 ? game.player_2_2 : game.player_1_2

                            return (
                                <div
                                    key={game.game_id}
                                    style={{
                                        backgroundColor: '#fff',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: `2px solid ${won ? '#28a745' : '#dc3545'}`,
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                            {won ? '✅ Победа' : '❌ Поражение'} {game.score_1} : {game.score_2}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>{formatDate(game.created_at)}</div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        <div>
                                            Вы + {partner} <strong>vs</strong> {opponent1} + {opponent2}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Лучшие напарники */}
            {stats?.bestPartners && stats.bestPartners.length > 0 && (
                <div
                    style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                    }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        🤝 Лучшие напарники
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stats.bestPartners.map((partner, index) => (
                            <div
                                key={partner.name}
                                style={{
                                    backgroundColor: '#fff',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                        {index === 0 && '🥇'} {index === 1 && '🥈'} {index === 2 && '🥉'} {partner.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {partner.games} игр, {partner.wins} побед
                                    </div>
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                                    {partner.winRate}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
