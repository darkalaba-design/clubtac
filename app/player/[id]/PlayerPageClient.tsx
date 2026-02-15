'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Tabs from '../../components/Tabs'

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
    }>
}

export default function PlayerPageClient({ playerId }: { playerId: string }) {
    const router = useRouter()
    const [player, setPlayer] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(false)

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('clubtac_players_hall_of_fame_ranked_v2')
                    .select('*')
                    .eq('user_id', playerId)
                    .single()

                if (queryError) {
                    console.error('Supabase error:', queryError)
                    setError(queryError.message)
                    setLoading(false)
                    return
                }

                setPlayer(data)
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

    // Загружаем детальную статистику после загрузки данных игрока
    useEffect(() => {
        if (!player?.nickname?.trim()) return

        const loadStats = async () => {
            setStatsLoading(true)
            try {
                const params = new URLSearchParams()
                params.append('nickname', player.nickname.trim())

                const response = await fetch(`/api/user/stats?${params.toString()}`)
                if (response.ok) {
                    const data = await response.json()
                    setPlayerStats({
                        recentGames: data.recentGames || [],
                        bestPartners: data.bestPartners || [],
                    })
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
    }, [player?.nickname])

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

    const handleTabChange = (tab: 'players' | 'teams' | 'games' | 'profile') => {
        router.push(`/?tab=${tab}`)
    }

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

    // Определяем, выиграл ли игрок игру (по nickname в играх)
    const didPlayerWin = (game: PlayerStats['recentGames'][0]) => {
        const nick = player?.nickname?.trim()
        if (!nick) return false
        const isTeam1 = game.player_1_1 === nick || game.player_1_2 === nick
        return isTeam1 ? game.score_1 > game.score_2 : game.score_2 > game.score_1
    }

    return (
        <>
            <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: '81px' }}>
            {/* Кнопка назад */}
            <button
                onClick={() => router.back()}
                style={{
                    display: 'inline-block',
                    marginBottom: '16px',
                    color: '#1D1D1B',
                    textDecoration: 'none',
                    fontSize: '14px',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                ← Назад
            </button>

            {/* Компактный блок с информацией об игроке */}
            <div
                style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    boxShadow: '0 2px 16px rgba(29,29,27,0.06)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                }}
            >
                {/* Аватар с местом */}
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
                    #{player.place}
                </div>

                {/* Информация */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, marginBottom: '4px', fontSize: '18px', fontWeight: 'bold' }}>
                        {player.nickname?.trim() || '—'}
                    </h2>
                    {player.points != null && (
                        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6B6B69', marginTop: '4px' }}>
                            <span>Очки: {Math.round(player.points)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Статистика */}
            <div
                style={{
                    backgroundColor: '#FFFEF7',
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
                    <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Место в рейтинге</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>#{player.place}</div>
                    </div>
                    <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Игр сыграно</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>{player.games_played}</div>
                    </div>
                    <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>Победы</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>{player.wins}</div>
                    </div>
                    <div style={{ backgroundColor: '#FFDF00', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#1D1D1B', marginBottom: '4px' }}>% побед</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1D1D1B' }}>{player.win_rate}%</div>
                    </div>
                </div>
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
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        🎮 Последние игры
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
                                                    {(player.nickname?.trim() || '—')} + {partner} <strong>vs</strong> {opponent1} + {opponent2}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
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
                    <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                        🤝 Лучшие напарники
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
            )}
            </div>
            <Tabs active="players" onChange={handleTabChange} />
        </>
    )
}
