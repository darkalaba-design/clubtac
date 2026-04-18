'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
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
    referralLink?: string | null
    invitedCount?: number
    inviter?: {
        id: number
        first_name: string
        last_name?: string | null
        nickname?: string | null
        username?: string | null
        telegram_id: number
    } | null
}

/**
 * Компонент для отображения профиля залогиненного пользователя
 */
export default function UserProfile() {
    const { user, loading, setUser } = useUser()
    const [stats, setStats] = useState<UserStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(false)
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)
    const [copyDone, setCopyDone] = useState(false)

    // Получаем фото из базы данных или Telegram
    useEffect(() => {
        // Сначала пробуем получить из user.userpic (из базы данных)
        if (user?.userpic) {
            setPhotoUrl(user.userpic)
        } else if (typeof window !== 'undefined') {
            // Если в базе нет, используем из Telegram WebApp
            const tg = (window as any).Telegram?.WebApp
            const telegramUser = tg?.initDataUnsafe?.user
            if (telegramUser?.photo_url) {
                setPhotoUrl(telegramUser.photo_url)
            }
        }
    }, [user])

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
                    if (data.user) {
                        setUser(data.user as User)
                    }
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
        // Не зависеть от целого `user`: после ответа /api/user/stats вызывается
        // setUser(data.user) — новый объект по ссылке, иначе эффект зацикливается
        // и «Загрузка статистики» не исчезает.
    }, [user?.id, user?.telegram_id, user?.nickname, setUser])

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
                        <p style={{ margin: 0, marginBottom: '4px', fontSize: '14px', color: '#6B6B69' }}>—</p>
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
        const n = (s: string | undefined | null) => (s ?? '').trim()
        const un = userNickname
        const isTeam1 = n(game.player_1_1) === un || n(game.player_1_2) === un
        return isTeam1 ? game.score_1 > game.score_2 : game.score_2 > game.score_1
    }

    // Показатели из clubtac_players_hall_of_fame_v3 (названия полей могли измениться)
    const s = stats?.stats as {
        points?: number
        total_points?: number
        rating?: number
        games_played?: number
        games?: number
        total_games?: number
        wins?: number
        total_wins?: number
        win_rate?: number
        winrate?: number
        win_percent?: number
    } | undefined
    const pointsValue = s && (s.points ?? s.total_points ?? s.rating)
    const gamesPlayedValue = s && (s.games_played ?? s.games ?? s.total_games)
    const winsValue = s && (s.wins ?? s.total_wins)
    const winRateValue = s && (s.win_rate ?? s.winrate ?? s.win_percent)

    const botUsername =
        typeof process !== 'undefined'
            ? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '')?.trim() || ''
            : ''
    const refUser = (stats?.user as User | undefined) ?? user ?? undefined
    const referralShareLink =
        stats?.referralLink ??
        (botUsername && refUser?.referral_code
            ? `https://t.me/${botUsername}?startapp=${encodeURIComponent(refUser.referral_code)}`
            : null)
    const invitedTotal = stats && typeof stats.invitedCount === 'number' ? stats.invitedCount : null
    const inviterRow = stats?.inviter

    const handleCopyReferral = async () => {
        if (!referralShareLink) return
        try {
            await navigator.clipboard.writeText(referralShareLink)
            setCopyDone(true)
            setTimeout(() => setCopyDone(false), 2000)
        } catch {
            setCopyDone(false)
        }
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
                        {userNickname || '—'}
                    </h2>
                    {user.username && (
                        <p style={{ margin: 0, marginBottom: '4px', fontSize: '14px', color: '#6B6B69' }}>
                            @{user.username}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                        <span>TG: {user.telegram_id}</span>
                        <span>Очки: {pointsValue != null ? Math.round(Number(pointsValue)) : '—'}</span>
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
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>
                                    {gamesPlayedValue != null ? gamesPlayedValue : '—'}
                                </div>
                            </div>
                            <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Победы</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>
                                    {winsValue != null ? winsValue : '—'}
                                </div>
                            </div>
                            <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>% побед</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>
                                    {winRateValue != null ? `${winRateValue}%` : '—'}
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

            {/* Игры и напарники сразу под статистикой; пустой ответ API не скрывает блоки (раньше казалось, что в Mini App их «нет»). */}
            {!statsLoading && (
                <>
                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                    <div style={{ backgroundColor: '#FFFFFF', padding: '16px 12px' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                            🎮 Последние игры
                        </h3>
                        {(stats?.recentGames?.length ?? 0) > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {stats!.recentGames!.map((game, index) => {
                                    const won = didUserWin(game)
                                    const n = (s: string | undefined | null) => (s ?? '').trim()
                                    const un = userNickname ?? ''
                                    const isTeam1 =
                                        !!un && (n(game.player_1_1) === un || n(game.player_1_2) === un)
                                    const partner = isTeam1
                                        ? n(game.player_1_1) === un
                                            ? game.player_1_2
                                            : game.player_1_1
                                        : n(game.player_2_1) === un
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
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: '8px',
                                                    }}
                                                >
                                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                        {won ? '✅ Победа' : '❌ Поражение'} {game.score_1} :{' '}
                                                        {game.score_2}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                                        {formatDate(game.created_at)}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                                    <div>
                                                        {userNickname} + {partner}{' '}
                                                        <strong>vs</strong> {opponent1} + {opponent2}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Нет данных</p>
                        )}
                    </div>

                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                    <div style={{ backgroundColor: '#FFFFFF', padding: '16px 12px' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                            🤝 Лучшие напарники
                        </h3>
                        {(stats?.bestPartners?.length ?? 0) > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {stats!.bestPartners!.map((partner, index) => (
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
                                                    {index === 0 && '🥇'} {index === 1 && '🥈'} {index === 2 && '🥉'}{' '}
                                                    {partner.name}
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
                        ) : (
                            <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>
                                Нет данных. Список появляется при не менее 3 совместных играх с одним напарником.
                            </p>
                        )}
                    </div>
                </>
            )}

            {/* Реферальная программа — после статистики, заметная карточка */}
            <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
            <div
                id="referral-block"
                style={{
                    margin: '12px',
                    padding: '16px 14px',
                    backgroundColor: '#FFF9E6',
                    borderRadius: '12px',
                    border: '2px solid #FFDF00',
                    boxShadow: '0 2px 8px rgba(29,29,27,0.06)',
                }}
            >
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 'bold', color: '#1D1D1B' }}>
                    🔗 Пригласить друзей
                </h3>
                {!botUsername && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>
                        Добавьте в окружение переменную{' '}
                        <code style={{ fontSize: '12px' }}>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> (имя бота без @) и
                        пересоберите приложение — без этого ссылку не собрать.
                    </p>
                )}
                {botUsername && !refUser?.referral_code && !statsLoading && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#6B6B69' }}>
                        Реферальный код появится после миграции БД и повторного входа. Закройте Mini App и откройте снова.
                    </p>
                )}
                {referralShareLink && (
                    <>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6B6B69' }}>Ваша ссылка</p>
                        <div
                            style={{
                                fontSize: '12px',
                                wordBreak: 'break-all',
                                color: '#1D1D1B',
                                marginBottom: '8px',
                                padding: '8px',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '6px',
                                border: '1px solid #EBE8E0',
                            }}
                        >
                            {referralShareLink}
                        </div>
                        <button
                            type="button"
                            onClick={handleCopyReferral}
                            style={{
                                padding: '8px 14px',
                                fontSize: '14px',
                                fontWeight: 600,
                                border: 'none',
                                borderRadius: '8px',
                                backgroundColor: '#FFDF00',
                                color: '#1D1D1B',
                                cursor: 'pointer',
                            }}
                        >
                            {copyDone ? 'Скопировано' : 'Копировать ссылку'}
                        </button>
                    </>
                )}
                <p style={{ margin: '12px 0 0', fontSize: '14px', color: '#1D1D1B' }}>
                    Приглашено:{' '}
                    <strong>{invitedTotal !== null ? invitedTotal : statsLoading ? '…' : '—'}</strong>
                </p>
                {inviterRow && (
                    <div style={{ marginTop: '12px' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#6B6B69' }}>Вас пригласил</p>
                        <Link
                            href={`/player/${inviterRow.id}`}
                            style={{
                                fontSize: '15px',
                                fontWeight: 'bold',
                                color: '#1B5E20',
                                textDecoration: 'none',
                            }}
                        >
                            {inviterRow.nickname?.trim() ||
                                [inviterRow.first_name, inviterRow.last_name].filter(Boolean).join(' ') ||
                                inviterRow.username ||
                                `Игрок #${inviterRow.id}`}
                        </Link>
                        {inviterRow.username && (
                            <span style={{ fontSize: '13px', color: '#6B6B69', marginLeft: '8px' }}>
                                @{inviterRow.username}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
