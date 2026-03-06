'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function HallOfFame() {
    const [players, setPlayers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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

                setPlayers(data || [])
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
            <h3 style={{ margin: '0 12px 12px', fontSize: '18px', fontWeight: 'bold', color: '#1D1D1B' }}>
                🏆 Рейтинг игроков
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {players.map((player, index) => (
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
                                    backgroundColor: '#FFFFFF',
                                    padding: '16px 12px',
                                    transition: 'background-color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#FFFEF7'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#FFFFFF'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            backgroundColor: '#FFE950',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '16px',
                                            flexShrink: 0,
                                            color: '#1D1D1B',
                                        }}
                                    >
                                        #{player.place}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', color: '#1D1D1B' }}>
                                            {player.nickname?.trim() || '—'}
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
                                            const points =
                                                player.points ??
                                                (player as any).total_points ??
                                                (player as any).rating

                                            return (
                                                <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                                    Игр:{' '}
                                                    <span style={{ color: '#1D1D1B', fontWeight: '500' }}>
                                                        {gamesPlayed != null ? gamesPlayed : '—'}
                                                    </span>{' '}
                                                    | Побед:{' '}
                                                    <span style={{ color: '#1D1D1B', fontWeight: '500' }}>
                                                        {wins != null ? wins : '—'}
                                                    </span>{' '}
                                                    | % побед:{' '}
                                                    <span style={{ color: '#2C2C2C', fontWeight: '500' }}>
                                                        {winRate != null ? `${winRate}%` : '—'}
                                                    </span>
                                                    {points != null && (
                                                        <>
                                                            {' '}
                                                            | Очки:{' '}
                                                            <span style={{ color: '#1D1D1B', fontWeight: '500' }}>
                                                                {Math.round(Number(points))}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    )
}
