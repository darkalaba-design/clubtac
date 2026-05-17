'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatPointsRu, formatWinsGamesLine } from '@/lib/ruCountPhrases'
import { displayPublicNickname, TAKOFF_PUBLIC_NAME } from '@/lib/takoff'
import Tabs from '../../components/Tabs'
import { useSoloLeaderMedalPrefix } from '../../contexts/SoloLeaderRanksContext'
import BrandStarIcon from '../../components/BrandStarIcon'
import GamesTabIcon from '../../components/GamesTabIcon'
import TeamsTabIcon from '../../components/TeamsTabIcon'

interface PlayerStats {
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
}

export default function PlayerPageClient({ playerId }: { playerId: string }) {
    const router = useRouter()
    const getMedalPrefix = useSoloLeaderMedalPrefix()
    const [player, setPlayer] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(false)
    const [recentGamesHasMore, setRecentGamesHasMore] = useState(false)
    const [gamesMoreLoading, setGamesMoreLoading] = useState(false)
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, number>>({})

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('clubtac_players_hall_of_fame_v3')
                    .select('*')
                    .eq('user_id', playerId)
                    .single()

                if (queryError) {
                    console.error('Supabase error:', queryError)
                    setError(queryError.message)
                    setLoading(false)
                    return
                }

                let userpic: string | null = null
                let takoff = false
                const uid = (data as { user_id?: number }).user_id ?? Number(playerId)
                if (uid && !Number.isNaN(uid)) {
                    const { data: userRow } = await supabase
                        .from('clubtac_users')
                        .select('userpic, takoff')
                        .eq('id', uid)
                        .maybeSingle()
                    const row = userRow as { userpic?: string | null; takoff?: boolean | null } | null
                    userpic = row?.userpic?.trim() || null
                    takoff = row?.takoff === true
                }

                setPlayer({ ...data, userpic, takoff })
            } catch (err) {
                console.error('Error loading player:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        if (playerId) {
            load()
        }
    }, [playerId])

    // Загружаем маппинг nickname → user_id для последних игр и лучших напарников
    useEffect(() => {
        const loadIds = async () => {
            const nicknames = new Set<string>()
            const currentNick = player?.nickname?.trim()

            if (currentNick) {
                nicknames.add(currentNick)
            }

            playerStats?.recentGames?.forEach((game) => {
                ;[game.player_1_1, game.player_1_2, game.player_2_1, game.player_2_2].forEach((name) => {
                    const n = name?.trim()
                    if (n) {
                        nicknames.add(n)
                    }
                })
            })

            playerStats?.bestPartners?.forEach((p) => {
                const n = p.name?.trim()
                if (n) {
                    nicknames.add(n)
                }
            })

            if (nicknames.size === 0) return

            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('clubtac_players_hall_of_fame_v3')
                    .select('user_id, nickname')
                    .in('nickname', Array.from(nicknames))

                if (!error && data) {
                    const map: Record<string, number> = {}
                    data.forEach((row: any) => {
                        const n = row.nickname?.trim()
                        if (n) {
                            map[n] = row.user_id
                        }
                    })
                    setPlayerIdMap(map)
                }
            } catch (err) {
                console.error('Error loading playerIdMap for player page:', err)
            }
        }

        loadIds()
    }, [playerStats?.recentGames, playerStats?.bestPartners, player?.nickname])

    // Детальная статистика по user_id (надёжнее, чем nickname: совпадение строки с hall_of_fame / дубликаты ников)
    useEffect(() => {
        if (!player) return
        const uid = Number(playerId)
        if (!Number.isFinite(uid) || uid <= 0) return
        const rowUserId = (player as { user_id?: number }).user_id
        if (rowUserId != null && Number(rowUserId) !== uid) return

        const loadStats = async () => {
            setStatsLoading(true)
            setRecentGamesHasMore(false)
            try {
                const params = new URLSearchParams()
                params.append('user_id', String(Math.trunc(uid)))
                params.append('recent_games_limit', '3')

                const response = await fetch(`/api/user/stats?${params.toString()}`)
                if (response.ok) {
                    const data = await response.json()
                    setPlayerStats({
                        recentGames: data.recentGames || [],
                        bestPartners: data.bestPartners || [],
                    })
                    setRecentGamesHasMore(!!data.recentGamesHasMore)
                } else if (response.status === 404) {
                    setPlayerStats({ recentGames: [], bestPartners: [] })
                    setRecentGamesHasMore(false)
                } else {
                    const body = await response.text()
                    console.error('Ошибка загрузки статистики:', body)
                }
            } catch (error) {
                console.error('Ошибка при загрузке статистики:', error)
            } finally {
                setStatsLoading(false)
            }
        }

        loadStats()
        // Только `playerId` и `user_id` строки — не весь `player`, иначе после «Показать ещё» сбросится список при любом обновлении объекта
    }, [playerId, (player as { user_id?: number } | null)?.user_id])

    if (loading) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Загрузка...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ padding: '12px' }}>
                <div
                    style={{
                        backgroundColor: '#FFF9E6',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #FFE950',
                    }}
                >
                    <p style={{ margin: 0, color: '#1D1D1B' }}>Ошибка: {error}</p>
                </div>
            </div>
        )
    }

    if (!player) {
        return (
            <div style={{ padding: '12px' }}>
                <div
                    style={{
                        backgroundColor: '#FFF9E6',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #FFE950',
                    }}
                >
                    <p style={{ margin: 0, color: '#1D1D1B' }}>Игрок не найден</p>
                </div>
            </div>
        )
    }

    const loadMorePlayerGames = async () => {
        if (!player || !recentGamesHasMore || gamesMoreLoading) return
        const uid = Number(playerId)
        if (!Number.isFinite(uid) || uid <= 0) return
        const rowUserId = (player as { user_id?: number }).user_id
        if (rowUserId != null && Number(rowUserId) !== uid) return
        const next = (playerStats?.recentGames?.length ?? 0) + 10
        setGamesMoreLoading(true)
        try {
            const params = new URLSearchParams()
            params.append('user_id', String(Math.trunc(uid)))
            params.append('recent_games_limit', String(next))
            const response = await fetch(`/api/user/stats?${params.toString()}`)
            if (response.ok) {
                const data = await response.json()
                setPlayerStats((prev) => ({
                    recentGames: data.recentGames || [],
                    bestPartners: prev?.bestPartners ?? data.bestPartners ?? [],
                }))
                setRecentGamesHasMore(!!data.recentGamesHasMore)
            }
        } catch (e) {
            console.error('Ошибка подгрузки игр:', e)
        } finally {
            setGamesMoreLoading(false)
        }
    }

    const handleTabChange = (tab: 'players' | 'teams' | 'games' | 'profile') => {
        router.push(`/?tab=${tab}`)
    }

    // Дата: «13 апреля»
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        } catch {
            return dateString
        }
    }

    const rankPlaceNum = Number(player.place)
    const placeMedalPrefix =
        rankPlaceNum === 1 ? '🥇 ' : rankPlaceNum === 2 ? '🥈 ' : rankPlaceNum === 3 ? '🥉 ' : ''

    // Определяем, выиграл ли игрок игру (по nickname в играх)
    const didPlayerWin = (game: PlayerStats['recentGames'][0]) => {
        const nick = player?.nickname?.trim()
        if (!nick) return false
        const isTeam1 = game.player_1_1 === nick || game.player_1_2 === nick
        return isTeam1 ? game.score_1 > game.score_2 : game.score_2 > game.score_1
    }

    const renderPlayerName = (name: string | null | undefined) => {
        const n = name?.trim()
        if (!n) return '—'
        const id = playerIdMap[n]
        if (!id) return n
        return (
            <Link
                href={`/player/${id}`}
                className="link-player"
                style={{
                    color: '#1D1D1B',
                    textDecoration: 'none',
                    fontWeight: 500,
                }}
                onClick={(e) => {
                    // Не переписываем returnUrl при переходах между страницами игроков
                    e.stopPropagation()
                }}
            >
                {getMedalPrefix(id)}
                {n}
            </Link>
        )
    }

    return (
        <>
            <div style={{ padding: '12px 0 81px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Кнопка назад — обычный шаг назад по истории */}
            <button
                onClick={() => router.back()}
                style={{
                    display: 'inline-block',
                    marginBottom: '16px',
                    marginLeft: '12px',
                    color: '#1D1D1B',
                    textDecoration: 'none',
                    fontSize: '14px',
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                ← Назад
            </button>

            {/* Статистика (включая шапку профиля) */}
            <div
                style={{
                    padding: '16px',
                    marginBottom: '16px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                        marginBottom: '16px',
                        paddingBottom: '16px',
                        borderBottom: '1px solid #EBE8E0',
                    }}
                >
                    <div
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            backgroundColor: '#FFE950',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                            fontWeight: 'bold',
                            fontSize: '24px',
                        }}
                    >
                        {player.userpic?.trim() && !player.takoff ? (
                            <img
                                src={player.userpic.trim()}
                                alt={player.nickname?.trim() ? `Фото: ${player.nickname.trim()}` : 'Фото игрока'}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                }}
                            />
                        ) : (
                            <span
                                style={{
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    fontSize: placeMedalPrefix ? '20px' : '24px',
                                    lineHeight: 1.1,
                                }}
                            >
                                {placeMedalPrefix}#{player.place}
                            </span>
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ margin: 0, marginBottom: '4px', fontSize: '18px', fontWeight: 'bold' }}>
                            {getMedalPrefix(
                                (player as { user_id?: number }).user_id ?? Number(playerId)
                            )}
                            {displayPublicNickname(player.nickname, player.takoff)}
                        </h2>
                        {player.points != null && (
                            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                                <span style={{ color: '#1D1D1B', fontWeight: 500 }}>
                                    <BrandStarIcon size={14} />{' '}
                                    {formatPointsRu(Math.round(Number(player.points)))}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {(() => {
                    const gamesPlayed =
                        player.games_played ??
                        (player as any).games ??
                        (player as any).total_games
                    const wins =
                        player.wins ?? (player as any).total_wins
                    const winRate =
                        player.win_rate ??
                        (player as any).winrate ??
                        (player as any).win_percent

                    const statCard = {
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

                    return (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '12px',
                            }}
                        >
                            <div style={statCard}>
                                <div style={statValueStyle}>
                                    {placeMedalPrefix}#{player.place}
                                </div>
                                <div style={statLabelStyle}>Место в рейтинге</div>
                            </div>
                            <div style={statCard}>
                                <div style={statValueStyle}>{gamesPlayed != null ? gamesPlayed : '—'}</div>
                                <div style={statLabelStyle}>Игр сыграно</div>
                            </div>
                            <div style={statCard}>
                                <div style={statValueStyle}>{wins != null ? wins : '—'}</div>
                                <div style={statLabelStyle}>Победы</div>
                            </div>
                            <div style={statCard}>
                                <div style={{ ...statValueStyle, textAlign: 'center' }}>
                                    {winRate != null ? Math.round(Number(winRate)) : '—'}
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
                    )
                })()}
            </div>

            {/* Последние игры */}
            {statsLoading ? (
                <div
                    style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                        boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                        textAlign: 'center',
                    }}
                >
                    <p style={{ margin: 0, fontSize: '14px', color: '#6B6B69' }}>Загрузка статистики...</p>
                </div>
            ) : playerStats?.recentGames && playerStats.recentGames.length > 0 ? (
                <div
                    style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                        boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                    }}
                >
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
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {playerStats.recentGames.map((game, index) => {
                                const won = didPlayerWin(game)
                                const playerNick = player.nickname?.trim()
                                const isTeam1 = playerNick && (game.player_1_1 === playerNick || game.player_1_2 === playerNick)
                                const partner = isTeam1
                                    ? game.player_1_1 === playerNick
                                        ? game.player_1_2
                                        : game.player_1_1
                                    : game.player_2_1 === playerNick
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
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                    {won ? '✅ Победа' : '❌ Поражение'} {game.score_1} : {game.score_2}
                                                </div>
                                                <div className="date-muted">{formatDate(game.created_at)}</div>
                                            </div>
                                                <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                                    <div>
                                                        {player.takoff ? (
                                                            <span>{TAKOFF_PUBLIC_NAME}</span>
                                                        ) : (
                                                            renderPlayerName(player.nickname)
                                                        )}{' '}
                                                        + {renderPlayerName(partner)}{' '}
                                                        <strong>vs</strong> {renderPlayerName(opponent1)} +{' '}
                                                        {renderPlayerName(opponent2)}
                                                    </div>
                                                </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    {recentGamesHasMore && (
                        <button
                            type="button"
                            disabled={gamesMoreLoading}
                            onClick={loadMorePlayerGames}
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
            ) : null}

            {/* Лучшие напарники */}
            {!statsLoading && playerStats?.bestPartners && playerStats.bestPartners.length > 0 && (
                <div
                    style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                        boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                    }}
                >
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
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {playerStats.bestPartners.map((partner, index) => (
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
                                                {renderPlayerName(partner.name)}
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
                </div>
            )}
            </div>
            <Tabs active="players" onChange={handleTabChange} />
        </>
    )
}
