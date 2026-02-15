'use client'

import React, { useEffect, useState } from 'react'
import { useUser } from '../contexts/UserContext'
import type { User } from '@/types/user'

interface UserStats {
    user: User
    stats: {
        place: number
        games_played: number
        wins: number
        win_rate: number
        points?: number
        nickname?: string | null
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
                } else if (user.nickname) {
                    params.append('nickname', user.nickname)
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
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Загрузка...</p>
            </div>
        )
    }

    // Пустая структура при неопределённом пользователе
    if (!user) {
        return (
            <div>
                <div
                    style={{
                        backgroundColor: '#FFF9E6',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        marginBottom: '12px',
                        fontSize: '13px',
                        color: '#1D1D1B',
                    }}
                >
                    Пользователь не определён — откройте приложение через Telegram Mini App.
                </div>
                {/* Блок профиля — пустые данные */}
                <div
                    style={{
                        backgroundColor: '#FFFFFF',
                        padding: '16px 12px',
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                    }}
                >
                    <div
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            backgroundColor: '#EBE8E0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <span style={{ fontSize: '32px' }}>👤</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ margin: 0, marginBottom: '4px', fontSize: '18px', fontWeight: 'bold', color: '#6B6B69' }}>
                            —
                        </h2>
                        <p style={{ margin: 0, marginBottom: '4px', fontSize: '14px', color: '#6B6B69' }}>@username</p>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                            <span>Очки: —</span>
                        </div>
                    </div>
                </div>
                {/* Статистика — пустые значения */}
                <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                <div style={{ backgroundColor: '#FFFFFF', padding: '16px 12px' }}>
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
                        <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Место в рейтинге</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>—</div>
                        </div>
                        <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Игр сыграно</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>—</div>
                        </div>
                        <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Победы</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>—</div>
                        </div>
                        <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>% побед</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>—</div>
                        </div>
                    </div>
                </div>
                {/* Последние игры — пусто */}
                <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                <div style={{ backgroundColor: '#FFFFFF', padding: '16px 12px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        🎮 Последние игры
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Нет данных</p>
                </div>
                {/* Лучшие напарники — пусто */}
                <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                <div style={{ backgroundColor: '#FFFFFF', padding: '16px 12px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        🤝 Лучшие напарники
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Нет данных</p>
                </div>
            </div>
        )
    }

    const userNickname = stats?.stats?.nickname?.trim()
    const displayName = userNickname || user.first_name || user.last_name || 'Пользователь'
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

    // Определяем, выиграл ли пользователь игру (по nickname в играх)
    const didUserWin = (game: UserStats['recentGames'][0]) => {
        if (!userNickname) return false
        const isTeam1 = game.player_1_1 === userNickname || game.player_1_2 === userNickname
        return isTeam1 ? game.score_1 > game.score_2 : game.score_2 > game.score_1
    }

    return (
        <div>
            {/* Компактный блок с информацией о пользователе */}
            <div
                style={{
                    backgroundColor: '#FFFFFF',
                    padding: '16px 12px',
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
                        backgroundColor: '#EBE8E0',
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
                    {userNickname && (
                        <p style={{ margin: 0, marginBottom: '4px', fontSize: '14px', color: '#6B6B69' }}>
                            {userNickname}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                        <span>TG: {user.telegram_id}</span>
                        {stats?.stats?.points != null && (
                            <span>Очки: {Math.round(stats.stats.points)}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Статистика */}
            {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p>Загрузка статистики...</p>
                </div>
            ) : stats?.stats ? (
                <>
                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                    <div
                        style={{
                            backgroundColor: '#FFFFFF',
                            padding: '16px 12px',
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
                            <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Место в рейтинге</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>#{stats.stats.place}</div>
                            </div>
                            <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Игр сыграно</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>{stats.stats.games_played}</div>
                            </div>
                            <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Победы</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>
                                    {stats.stats.wins}
                                </div>
                            </div>
                            <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>% побед</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>
                                    {stats.stats.win_rate}%
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                    <div
                        style={{
                            backgroundColor: '#FFF9E6',
                            padding: '16px 12px',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ margin: 0, color: '#1D1D1B' }}>
                            Статистика недоступна. Возможно, вы ещё не играли.
                        </p>
                    </div>
                </>
            )}

            {/* Последние игры */}
            {stats?.recentGames && stats.recentGames.length > 0 && (
                <>
                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                    <div
                        style={{
                            backgroundColor: '#FFFFFF',
                            padding: '16px 12px',
                        }}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                            🎮 Последние игры
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {stats.recentGames.map((game, index) => {
                                const won = didUserWin(game)
                                const isTeam1 = userNickname && (game.player_1_1 === userNickname || game.player_1_2 === userNickname)
                                const partner = isTeam1
                                    ? game.player_1_1 === userNickname
                                        ? game.player_1_2
                                        : game.player_1_1
                                    : game.player_2_1 === userNickname
                                        ? game.player_2_2
                                        : game.player_2_1
                                const opponent1 = isTeam1 ? game.player_2_1 : game.player_1_1
                                const opponent2 = isTeam1 ? game.player_2_2 : game.player_1_2

                                return (
                                    <div key={game.game_id}>
                                        {index > 0 && (
                                            <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                                        )}
                                        <div
                                            style={{
                                                backgroundColor: '#FFFFFF',
                                                padding: '12px 0',
                                                borderLeft: `4px solid ${won ? '#1B5E20' : '#B71C1C'}`,
                                                paddingLeft: '12px',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                    {won ? '✅ Победа' : '❌ Поражение'} {game.score_1} : {game.score_2}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#6B6B69' }}>{formatDate(game.created_at)}</div>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                                <div>
                                                    {userNickname} + {partner} <strong>vs</strong> {opponent1} + {opponent2}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Лучшие напарники */}
            {stats?.bestPartners && stats.bestPartners.length > 0 && (
                <>
                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                    <div
                        style={{
                            backgroundColor: '#FFFFFF',
                            padding: '16px 12px',
                        }}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                            🤝 Лучшие напарники
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {stats.bestPartners.map((partner, index) => (
                                <div key={partner.name}>
                                    {index > 0 && (
                                        <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                                    )}
                                    <div
                                        style={{
                                            backgroundColor: '#FFFFFF',
                                            padding: '12px 0',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                                                {index === 0 && '🥇'} {index === 1 && '🥈'} {index === 2 && '🥉'} {partner.name}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                                {partner.games} игр, {partner.wins} побед
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2C2C2C' }}>
                                            {partner.winRate}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
