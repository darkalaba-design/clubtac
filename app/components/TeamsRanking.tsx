'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function TeamsRanking() {
    const [teams, setTeams] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('teams_ranked')
                    .select('*')
                    .order('rank')

                if (queryError) {
                    console.error('Supabase error:', queryError)
                    setError(queryError.message)
                    setLoading(false)
                    return
                }

                console.log('Loaded teams:', data)
                setTeams(data || [])
            } catch (err) {
                console.error('Error loading teams:', err)
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

    if (teams.length === 0) {
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
                    👥 Рейтинг команд
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teams.map((team) => {
                        const winRate = team.games_played > 0 ? Math.round((team.wins / team.games_played) * 100) : 0

                        return (
                            <div
                                key={`${team.player_1_id}-${team.player_2_id}`}
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
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
                                            #{team.rank}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                                                <Link
                                                    href={`/player/${team.player_1_id}`}
                                                    style={{
                                                        color: '#007bff',
                                                        textDecoration: 'none',
                                                    }}
                                                >
                                                    {team.player_1_username}
                                                </Link>
                                                <span style={{ margin: '0 4px', color: '#666' }}>+</span>
                                                <Link
                                                    href={`/player/${team.player_2_id}`}
                                                    style={{
                                                        color: '#007bff',
                                                        textDecoration: 'none',
                                                    }}
                                                >
                                                    {team.player_2_username}
                                                </Link>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#666' }}>
                                                Игр: {team.games_played} | Побед: {team.wins} | % побед: {winRate}%
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                                        {winRate}%
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
