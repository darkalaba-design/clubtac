'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '../contexts/UserContext'

export default function HallOfFame() {
    const [players, setPlayers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { user } = useUser()

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('clubtac_players_hall_of_fame_v3')
                    .select('*')
                    .order('place')

                if (queryError) {
                    console.error('Supabase error:', queryError)
                    setError(queryError.message)
                    setLoading(false)
                    return
                }

                const filtered = (data || []).filter((player: any) => {
                    const gamesPlayed =
                        player.games_played ??
                        (player as any).games ??
                        (player as any).total_games
                    return gamesPlayed && Number(gamesPlayed) > 0
                })

                setPlayers(filtered)
            } catch (err) {
                console.error('Error loading players:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

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

    if (players.length === 0) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Нет данных</p>
            </div>
        )
    }

    return (
        <div>
            <h3 style={{ margin: '0 12px 8px', fontSize: '16px', fontWeight: 'bold', color: '#1D1D1B' }}>
                🏆 Рейтинг игроков
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {players.map((player, index) => {
                    const gamesPlayed =
                        player.games_played ??
                        (player as any).games ??
                        (player as any).total_games
                    const wins =
                        player.wins ?? (player as any).total_wins
                    const points =
                        player.points ??
                        (player as any).total_points ??
                        (player as any).rating

                    const isCurrentUser =
                        user && typeof user.id !== 'undefined' && player.user_id === user.id

                    return (
                        <div key={player.user_id}>
                            {index > 0 && (
                                <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                            )}
                            <Link
                                href={`/player/${player.user_id}`}
                                style={{
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    display: 'block',
                                }}
                            >
                                <div
                                    style={{
                                        backgroundColor: isCurrentUser ? '#FFF4C2' : '#FFFFFF',
                                        padding: '4px 12px',
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = isCurrentUser ? '#FFECA0' : '#FFFEF7'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = isCurrentUser ? '#FFF4C2' : '#FFFFFF'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                backgroundColor: '#FFE950',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                fontSize: '13px',
                                                flexShrink: 0,
                                                color: '#1D1D1B',
                                            }}
                                        >
                                            #{player.place}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '8px',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: '14px',
                                                        fontWeight: 'bold',
                                                        color: isCurrentUser ? '#B05C00' : '#1D1D1B',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {player.nickname?.trim() || '—'}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: '11px',
                                                        color: '#6B6B69',
                                                        textAlign: 'right',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    Побед:{' '}
                                                    <span style={{ color: '#1D1D1B', fontWeight: 700 }}>
                                                        {wins != null ? wins : '—'}
                                                    </span>{' '}
                                                    из{' '}
                                                    <span style={{ color: '#6B6B69', fontWeight: 400 }}>
                                                        {gamesPlayed != null ? gamesPlayed : '—'}
                                                    </span>
                                                    {points != null && (
                                                        <>
                                                            {'. '}Очки:{' '}
                                                            <span style={{ color: '#1D1D1B', fontWeight: 700 }}>
                                                                {Math.round(Number(points))}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
