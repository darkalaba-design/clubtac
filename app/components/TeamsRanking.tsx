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

    if (teams.length === 0) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Нет данных</p>
            </div>
        )
    }

    return (
        <div>
            <h3 style={{ margin: '0 12px 12px', fontSize: '18px', fontWeight: 'bold', color: '#1D1D1B' }}>
                👥 Рейтинг команд
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {teams.map((team, index) => {
                    const winRate = team.games_played > 0 ? Math.round((team.wins / team.games_played) * 100) : 0

                    return (
                        <div key={`${team.player_1_id}-${team.player_2_id}`}>
                            {index > 0 && (
                                <div style={{ height: '1px', backgroundColor: '#EBE8E0' }} />
                            )}
                            <div
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    padding: '16px 12px',
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
                                        #{team.rank}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                                            <Link
                                                href={`/player/${team.player_1_id}`}
                                                className="link-player"
                                                style={{
                                                    color: '#1D1D1B',
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                {team.player_1_username}
                                            </Link>
                                            <span style={{ margin: '0 4px', color: '#6B6B69' }}>+</span>
                                            <Link
                                                href={`/player/${team.player_2_id}`}
                                                className="link-player"
                                                style={{
                                                    color: '#1D1D1B',
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                {team.player_2_username}
                                            </Link>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6B6B69' }}>
                                            Игр: <span style={{ color: '#1D1D1B', fontWeight: '500' }}>{team.games_played}</span> | Побед: <span style={{ color: '#1D1D1B', fontWeight: '500' }}>{team.wins}</span> | % побед: <span style={{ color: '#2C2C2C', fontWeight: '500' }}>{winRate}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
