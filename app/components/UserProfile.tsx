'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { scoresForPlayerTeam } from '@/lib/playerGameScore'
import { formatPointsRu, formatWinsGamesLine } from '@/lib/ruCountPhrases'
import { displayPublicNickname, TAKOFF_PUBLIC_NAME } from '@/lib/takoff'
import { TELEGRAM_INIT_DATA_HEADER } from '@/lib/admin/constants'
import { useUser } from '../contexts/UserContext'
import { useSoloLeaderMedalPrefix } from '../contexts/SoloLeaderRanksContext'
import BrandStarIcon from './BrandStarIcon'
import GamesTabIcon from './GamesTabIcon'
import TeamsTabIcon from './TeamsTabIcon'
import ProfileTabIcon from './ProfileTabIcon'
import SettingsIcon from './SettingsIcon'
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
        user_id?: number | null
    }>
    referralLink?: string | null
    invitedCount?: number
    recentGamesHasMore?: boolean
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
    const getMedalPrefix = useSoloLeaderMedalPrefix()
    const [stats, setStats] = useState<UserStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(false)
    const [gamesMoreLoading, setGamesMoreLoading] = useState(false)
    const [photoUrl, setPhotoUrl] = useState<string | null>(null)
    const [copyDone, setCopyDone] = useState(false)
    const [takoffSaving, setTakoffSaving] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [settingsEntered, setSettingsEntered] = useState(false)
    const [showAppAdminLink, setShowAppAdminLink] = useState(false)

    const sectionCard: React.CSSProperties = {
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 2px 16px rgba(29, 29, 27, 0.06)',
    }

    const statCardCell = {
        backgroundColor: '#FFDF00',
        borderRadius: '10px',
        padding: '14px 12px',
        textAlign: 'center' as const,
    }
    const statValueStyle = {
        fontSize: '36px',
        fontWeight: 'bold' as const,
        color: '#1D1D1B',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
    }
    const statLabelStyle = {
        fontSize: '12px',
        color: '#1D1D1B',
        marginTop: '6px',
        fontWeight: 600,
        opacity: 0.85,
    }

    useEffect(() => {
        if (!user) {
            setShowAppAdminLink(false)
            return
        }
        const initData =
            typeof window !== 'undefined' ? (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData?.trim?.() || '' : ''
        if (!initData) {
            setShowAppAdminLink(false)
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/admin/session', {
                    headers: { [TELEGRAM_INIT_DATA_HEADER]: initData },
                })
                const j = (await res.json().catch(() => ({}))) as { app_admin_ui?: boolean }
                if (!cancelled) setShowAppAdminLink(res.ok && !!j.app_admin_ui)
            } catch {
                if (!cancelled) setShowAppAdminLink(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [user])

    useEffect(() => {
        if (!settingsOpen) {
            setSettingsEntered(false)
            return
        }
        const id = requestAnimationFrame(() => setSettingsEntered(true))
        return () => cancelAnimationFrame(id)
    }, [settingsOpen])

    const closeSettings = useCallback(() => {
        setSettingsEntered(false)
        window.setTimeout(() => setSettingsOpen(false), 300)
    }, [])

    const handleTakoffChange = useCallback(
        async (next: boolean) => {
            if (!user?.id || user.telegram_id == null) return
            const initData =
                typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData?.trim?.() || '' : ''
            if (!initData) {
                console.error('takoff: нет Telegram.WebApp.initData — откройте приложение из Telegram Mini App')
                return
            }
            setTakoffSaving(true)
            try {
                const res = await fetch('/api/user/takoff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        initData,
                        id: user.id,
                        takoff: next,
                    }),
                })
                const payload = await res.json().catch(() => ({}))
                if (!res.ok) {
                    console.error('takoff update:', payload?.error || res.statusText)
                    return
                }
                if (payload.user) {
                    setUser(payload.user as User)
                } else {
                    setUser({ ...user, takoff: next } as User)
                }
            } catch (e) {
                console.error(e)
            } finally {
                setTakoffSaving(false)
            }
        },
        [user, setUser]
    )

    useEffect(() => {
        if (!settingsOpen) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [settingsOpen])

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
                params.append('recent_games_limit', '3')

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

    const loadMoreProfileGames = async () => {
        if (!user || !stats?.recentGamesHasMore || gamesMoreLoading) return
        if (!user.telegram_id && !user.nickname) return
        setGamesMoreLoading(true)
        try {
            const params = new URLSearchParams()
            if (user.telegram_id) {
                params.append('telegram_id', user.telegram_id.toString())
            } else {
                params.append('nickname', user.nickname!)
            }
            params.append('recent_games_limit', String((stats.recentGames?.length ?? 0) + 10))
            const response = await fetch(`/api/user/stats?${params.toString()}`)
            if (response.ok) {
                const data = await response.json()
                setStats((prev) =>
                    prev
                        ? {
                              ...prev,
                              recentGames: data.recentGames || [],
                              recentGamesHasMore: !!data.recentGamesHasMore,
                          }
                        : null
                )
            }
        } catch (e) {
            console.error('Ошибка подгрузки игр:', e)
        } finally {
            setGamesMoreLoading(false)
        }
    }

    const settingsFooter = (
        <div
            style={{
                marginTop: '28px',
                marginBottom: '24px',
                padding: '0 12px',
                display: 'flex',
                justifyContent: 'flex-end',
            }}
        >
            <button
                type="button"
                aria-label="Настройки"
                onClick={() => setSettingsOpen(true)}
                style={{
                    padding: '10px',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                }}
            >
                <SettingsIcon size={24} />
            </button>
        </div>
    )

    const settingsModal = settingsOpen ? (
        <>
            <div
                role="presentation"
                onClick={closeSettings}
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(29, 29, 27, 0.35)',
                    zIndex: 1100,
                    opacity: settingsEntered ? 1 : 0,
                    transition: 'opacity 0.3s ease-out',
                }}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: '100%',
                    maxWidth: '100%',
                    backgroundColor: '#FFFFFF',
                    zIndex: 1101,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '4px 0 24px rgba(29,29,27,0.12)',
                    transform: settingsEntered ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 0.3s ease-out',
                }}
            >
                <header
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px 12px',
                        borderBottom: '1px solid #EBE8E0',
                        flexShrink: 0,
                        position: 'relative',
                        minHeight: '48px',
                    }}
                >
                    <button
                        type="button"
                        onClick={closeSettings}
                        aria-label="Назад"
                        style={{
                            position: 'absolute',
                            left: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            padding: '8px',
                            cursor: 'pointer',
                            fontSize: '20px',
                            lineHeight: 1,
                            color: '#1D1D1B',
                        }}
                    >
                        ←
                    </button>
                    <h2
                        id="settings-title"
                        style={{
                            margin: 0,
                            fontSize: '17px',
                            fontWeight: 'bold',
                            color: '#1D1D1B',
                        }}
                    >
                        Настройки
                    </h2>
                </header>
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 12px' }}>
                    {!user ? (
                        <p style={{ margin: 0, fontSize: '15px', color: '#6B6B69' }}>
                            Войдите через Telegram Mini App, чтобы открыть настройку приватности в рейтинге.
                        </p>
                    ) : (
                        <>
                            <p style={{ margin: '0 0 16px', fontSize: '15px', color: '#6B6B69' }}>
                                Скрытие ника и фото в общих списках.
                            </p>
                            <div
                                style={{
                                    border: '1px solid #EBE8E0',
                                    borderRadius: '10px',
                                    padding: '14px 14px',
                                    backgroundColor: '#FFFEF7',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: '14px',
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1D1D1B', marginBottom: '6px' }}>
                                            Приватность в рейтинге
                                        </div>
                                        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.45, color: '#6B6B69' }}>
                                            В рейтинге игроков и в статистике команд вместо ника будет «{TAKOFF_PUBLIC_NAME}». На
                                            вашей странице не показываются фото и ник. Очки, место и игры — как обычно.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={!!user.takoff}
                                        disabled={takoffSaving}
                                        onClick={() => handleTakoffChange(!user.takoff)}
                                        style={{
                                            flexShrink: 0,
                                            width: '52px',
                                            height: '30px',
                                            borderRadius: '15px',
                                            border: '2px solid #1D1D1B',
                                            backgroundColor: user.takoff ? '#FFDF00' : '#EBE8E0',
                                            cursor: takoffSaving ? 'wait' : 'pointer',
                                            position: 'relative',
                                            transition: 'background-color 0.2s',
                                            padding: 0,
                                        }}
                                    >
                                        <span
                                            style={{
                                                position: 'absolute',
                                                top: '3px',
                                                left: user.takoff ? '26px' : '4px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                backgroundColor: '#FFFFFF',
                                                border: '1px solid #1D1D1B',
                                                transition: 'left 0.2s',
                                                display: 'block',
                                            }}
                                        />
                                    </button>
                                </div>
                                {takoffSaving && (
                                    <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#6B6B69' }}>Сохранение…</p>
                                )}
                            </div>
                            {showAppAdminLink && (
                                <div style={{ marginTop: '16px' }}>
                                    <Link
                                        href="/admin"
                                        style={{
                                            display: 'block',
                                            textAlign: 'center',
                                            padding: '12px',
                                            borderRadius: '10px',
                                            backgroundColor: '#1B5E20',
                                            color: '#fff',
                                            fontWeight: 700,
                                            textDecoration: 'none',
                                            fontSize: '15px',
                                        }}
                                    >
                                        Админка (в приложении)
                                    </Link>
                                    {user.app_role === 'root' && (
                                        <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#6B6B69', textAlign: 'center' }}>
                                            root: в т.ч. выдача admin для новой админки
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    ) : null

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
            <>
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
                        Пользователь не определён — откройте приложение через{' '}
                        <a
                            href="https://core.telegram.org/bots/webapps"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: '#1565C0',
                                fontWeight: 600,
                                textDecoration: 'underline',
                            }}
                        >
                            Telegram Mini App
                        </a>
                        .
                    </div>
                    {/* Блок профиля — пустые данные */}
                    <div
                        style={{
                            ...sectionCard,
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
                            <ProfileTabIcon size={40} />
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
                    <div style={sectionCard}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '12px',
                            }}
                        >
                            <div style={statCardCell}>
                                <div style={statValueStyle}>—</div>
                                <div style={statLabelStyle}>Место в рейтинге</div>
                            </div>
                            <div style={statCardCell}>
                                <div style={statValueStyle}>—</div>
                                <div style={statLabelStyle}>Игр сыграно</div>
                            </div>
                            <div style={statCardCell}>
                                <div style={statValueStyle}>—</div>
                                <div style={statLabelStyle}>Победы</div>
                            </div>
                            <div style={statCardCell}>
                                <div style={{ ...statValueStyle, textAlign: 'center' }}>
                                    —
                                    <div
                                        style={{
                                            ...statLabelStyle,
                                            marginTop: '4px',
                                        }}
                                    >
                                        % побед
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Последние игры — пусто */}
                    <div style={sectionCard}>
                        <h3
                            style={{
                                marginTop: 0,
                                marginBottom: '16px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <GamesTabIcon size={24} />
                            Последние игры
                        </h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Нет данных</p>
                    </div>
                    {/* Лучшие напарники — пусто */}
                    <div style={sectionCard}>
                        <h3
                            style={{
                                marginTop: 0,
                                marginBottom: '16px',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <TeamsTabIcon size={24} />
                            Лучшие напарники
                        </h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Нет данных</p>
                    </div>
                </div>
                {settingsFooter}
                {settingsModal}
            </>
        )
    }

    const userNickname = stats?.stats?.nickname?.trim()
    const displayName = userNickname || user.first_name || user.last_name || 'Пользователь'
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || displayName

    // Дата: «13 апреля»
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
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

    // Место и очки — новый Elo (через /api/user/stats); игры/победы — из hall_of_fame при наличии
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
        <>
            <div>
                {/* Компактный блок с информацией о пользователе */}
                <div
                    style={{
                        ...sectionCard,
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
                        {photoUrl && !user.takoff ? (
                            <img
                                src={photoUrl}
                                alt={fullName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <ProfileTabIcon size={40} />
                        )}
                    </div>

                    {/* Информация */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ margin: 0, marginBottom: '4px', fontSize: '18px', fontWeight: 'bold' }}>
                            {getMedalPrefix(user.id)}
                            {displayPublicNickname(userNickname, user.takoff)}
                        </h2>
                        {user.username && !user.takoff && (
                            <p style={{ margin: 0, marginBottom: '4px', fontSize: '14px', color: '#6B6B69' }}>
                                @{user.username}
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                            <span>TG: {user.telegram_id}</span>
                            {pointsValue != null ? (
                                <span style={{ color: '#1D1D1B', fontWeight: 500 }}>
                                    <BrandStarIcon size={14} />{' '}
                                    {formatPointsRu(Math.round(Number(pointsValue)))}
                                </span>
                            ) : (
                                <span>Очки: —</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Статистика */}
                {statsLoading ? (
                    <div style={{ ...sectionCard, textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Загрузка статистики...</p>
                    </div>
                ) : stats?.stats ? (
                    <div style={sectionCard}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '12px',
                            }}
                        >
                            <div style={statCardCell}>
                                <div style={statValueStyle}>#{stats.stats.place}</div>
                                <div style={statLabelStyle}>Место в рейтинге</div>
                            </div>
                            <div style={statCardCell}>
                                <div style={statValueStyle}>{gamesPlayedValue != null ? gamesPlayedValue : '—'}</div>
                                <div style={statLabelStyle}>Игр сыграно</div>
                            </div>
                            <div style={statCardCell}>
                                <div style={statValueStyle}>{winsValue != null ? winsValue : '—'}</div>
                                <div style={statLabelStyle}>Победы</div>
                            </div>
                            <div style={statCardCell}>
                                <div style={{ ...statValueStyle, textAlign: 'center' }}>
                                    {winRateValue != null ? Math.round(Number(winRateValue)) : '—'}
                                    <div
                                        style={{
                                            ...statLabelStyle,
                                            marginTop: '4px',
                                        }}
                                    >
                                        % побед
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ ...sectionCard, backgroundColor: '#FFF9E6', border: '1px solid #FFE950', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#1D1D1B' }}>
                            Статистика недоступна. Возможно, вы ещё не играли.
                        </p>
                    </div>
                )}

                {/* Игры и напарники сразу под статистикой; пустой ответ API не скрывает блоки (раньше казалось, что в Mini App их «нет»). */}
                {!statsLoading && (
                    <>
                        <div style={sectionCard}>
                            <h3
                                style={{
                                    marginTop: 0,
                                    marginBottom: '16px',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <GamesTabIcon size={24} />
                                Последние игры
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
                                        const { playerScore, opponentScore } = scoresForPlayerTeam(
                                            game.score_1,
                                            game.score_2,
                                            Boolean(isTeam1)
                                        )

                                        return (
                                            <div key={game.game_id}>
                                                {index > 0 && (
                                                    <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                                                )}
                                                <div
                                                    style={{
                                                        backgroundColor: '#FFFFFF',
                                                        padding: '12px 0',
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
                                                            {won ? '✅ Победа' : '❌ Поражение'} {playerScore} :{' '}
                                                            {opponentScore}
                                                        </div>
                                                        <div className="date-muted">{formatDate(game.created_at)}</div>
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                                        <div>
                                                            {user.takoff ? TAKOFF_PUBLIC_NAME : userNickname} + {partner}{' '}
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
                            {stats?.recentGamesHasMore && (stats?.recentGames?.length ?? 0) > 0 && (
                                <button
                                    type="button"
                                    disabled={gamesMoreLoading}
                                    onClick={loadMoreProfileGames}
                                    style={{
                                        marginTop: '8px',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: '1px solid #EBE8E0',
                                        borderRadius: '6px',
                                        color: '#1D1D1B',
                                        cursor: gamesMoreLoading ? 'wait' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        opacity: gamesMoreLoading ? 0.65 : 1,
                                    }}
                                >
                                    {gamesMoreLoading ? 'Загрузка…' : 'Показать ещё'}
                                </button>
                            )}
                        </div>

                        <div style={sectionCard}>
                            <h3
                                style={{
                                    marginTop: 0,
                                    marginBottom: '16px',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}
                            >
                                <TeamsTabIcon size={24} />
                                Лучшие напарники
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
                                                        {partner.user_id ? (
                                                            <Link
                                                                href={`/player/${partner.user_id}`}
                                                                className="link-player"
                                                                style={{
                                                                    color: '#1D1D1B',
                                                                    textDecoration: 'none',
                                                                    fontWeight: 'bold',
                                                                }}
                                                            >
                                                                {getMedalPrefix(partner.user_id)}
                                                                {partner.name}
                                                            </Link>
                                                        ) : (
                                                            partner.name
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: '12px',
                                                            color: '#A3A2A0',
                                                            fontWeight: 400,
                                                        }}
                                                    >
                                                        {formatWinsGamesLine(
                                                            Number(partner.wins) || 0,
                                                            Number(partner.games) || 0
                                                        )}
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
                <div
                    id="referral-block"
                    style={{
                        margin: '16px 12px 12px',
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
                                className="link-player"
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 'bold',
                                    color: '#1B5E20',
                                    textDecoration: 'none',
                                }}
                            >
                                {getMedalPrefix(inviterRow.id)}
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
            {showAppAdminLink && (
                <div style={{ padding: '0 12px', marginTop: '4px', marginBottom: '12px' }}>
                    <Link
                        href="/admin"
                        style={{
                            display: 'block',
                            textAlign: 'center',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: '#1B5E20',
                            color: '#fff',
                            fontWeight: 700,
                            textDecoration: 'none',
                            fontSize: '15px',
                        }}
                    >
                        Админка (в приложении)
                    </Link>
                </div>
            )}
            {settingsFooter}
            {settingsModal}
        </>
    )
}
