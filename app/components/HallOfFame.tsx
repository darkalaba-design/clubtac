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
                    .from('players_hall_of_fame_ranked')
                    .select('*')
                    .order('place')

                if (queryError) {
                    console.error('Supabase error:', queryError)
                    setError(queryError.message)
                    setLoading(false)
                    return
                }

                console.log('Loaded players:', data)
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
        <div style={{ padding: '12px' }}>
            <div
                style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: '12px',
                    padding: '16px',
                }}
            >
                <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 'bold' }}>
                    🏆 Рейтинг игроков
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {players.map((player) => (
                        <Link
                            key={player.user_id}
                            href={`/player/${player.user_id}`}
                            style={{
                                textDecoration: 'none',
                                color: 'inherit',
                            }}
                        >
                            <div
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                            }}
                                        >
                                            #{player.place}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                                                {player.username}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#666' }}>
                                                Игр: {player.games_played} | Побед: {player.wins} | % побед: {player.win_rate}%
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                                        {player.win_rate}%
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
