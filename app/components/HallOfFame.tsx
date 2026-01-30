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
                    .from('clubtac_players_hall_of_fame_ranked_v2')
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
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #ffc107',
                    }}
                >
                    <p style={{ margin: 0, color: '#856404' }}>Ошибка: {error}</p>
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
            <h3 style={{ margin: '0 12px 12px', fontSize: '18px', fontWeight: 'bold' }}>
                🏆 Рейтинг игроков
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {players.map((player, index) => (
                    <div key={player.user_id}>
                        {index > 0 && (
                            <div style={{ height: '2px', backgroundColor: '#e0e0e0' }} />
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
                                    backgroundColor: '#ffffff',
                                    padding: '16px 12px',
                                    transition: 'background-color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f8f9fa'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#ffffff'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            backgroundColor: '#e0e0e0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '16px',
                                            flexShrink: 0,
                                            color: '#000000',
                                        }}
                                    >
                                        #{player.place}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', color: '#000000' }}>
                                            {player.username}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                            Игр: <span style={{ color: '#000000', fontWeight: '500' }}>{player.games_played}</span> | Побед: <span style={{ color: '#000000', fontWeight: '500' }}>{player.wins}</span> | % побед: <span style={{ color: '#007bff', fontWeight: '500' }}>{player.win_rate}%</span>
                                            {player.points != null && (
                                                <> | Очки: <span style={{ color: '#000000', fontWeight: '500' }}>{Math.round(player.points)}</span></>
                                            )}
                                        </div>
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
