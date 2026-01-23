'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Game {
    game_id: number
    created_at: string
    player_1_1: string
    player_1_2: string
    player_2_1: string
    player_2_2: string
    score_1: number
    score_2: number
}

export default function GamesList() {
    const [games, setGames] = useState<Game[]>([])
    const [playerIdMap, setPlayerIdMap] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()

                // Загружаем игры
                const { data: gamesData, error: gamesError } = await supabase
                    .from('games_summary')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (gamesError) {
                    console.error('Supabase error:', gamesError)
                    setError(gamesError.message)
                    setLoading(false)
                    return
                }

                // Загружаем маппинг имен на ID
                const { data: playersData, error: playersError } = await supabase
                    .from('players_hall_of_fame_ranked')
                    .select('user_id, username')

                if (!playersError && playersData) {
                    const idMap: Record<string, number> = {}
                    playersData.forEach((player: any) => {
                        idMap[player.username] = player.user_id
                    })
                    setPlayerIdMap(idMap)
                }

                console.log('Loaded games:', gamesData)
                setGames(gamesData || [])
            } catch (err) {
                console.error('Error loading games:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    // Форматирование даты
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })
        } catch {
            return dateString
        }
    }

    // Группировка игр по датам
    const gamesByDate = games.reduce((acc, game) => {
        const date = formatDate(game.created_at)
        if (!acc[date]) {
            acc[date] = []
        }
        acc[date].push(game)
        return acc
    }, {} as Record<string, Game[]>)

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

    if (games.length === 0) {
        return (
            <div style={{ padding: '12px', textAlign: 'center' }}>
                <p>Нет данных</p>
            </div>
        )
    }

    return (
        <div>
            <h3 style={{ margin: '0 12px 12px', fontSize: '18px', fontWeight: 'bold' }}>
                🎮 История игр
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {Object.entries(gamesByDate).map(([date, dateGames]) => (
                    <div key={date}>
                        <h4
                            style={{
                                margin: '0 12px 12px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: '#666',
                            }}
                        >
                            {date}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {dateGames.map((game, index) => {
                                const team1Won = game.score_1 > game.score_2
                                return (
                                    <div key={game.game_id}>
                                        {index > 0 && (
                                            <div style={{ height: '2px', backgroundColor: '#e0e0e0' }} />
                                        )}
                                        <div
                                            style={{
                                                backgroundColor: '#ffffff',
                                                padding: '10px 12px',
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto 1fr',
                                                alignItems: 'center',
                                                gap: '12px',
                                            }}
                                        >
                                            {/* Левая команда */}
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ marginBottom: '4px', lineHeight: '14px' }}>
                                                    {playerIdMap[game.player_1_1] ? (
                                                        <Link
                                                            href={`/player/${playerIdMap[game.player_1_1]}`}
                                                            style={{
                                                                color: '#007bff',
                                                                textDecoration: 'none',
                                                                fontWeight: '500',
                                                                fontSize: '14px',
                                                                verticalAlign: 'top',
                                                                lineHeight: '14px',
                                                            }}
                                                        >
                                                            {game.player_1_1}
                                                        </Link>
                                                    ) : (
                                                        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_1_1}</span>
                                                    )}
                                                </div>
                                                <div style={{ lineHeight: '14px', verticalAlign: 'bottom' }}>
                                                    {playerIdMap[game.player_1_2] ? (
                                                        <Link
                                                            href={`/player/${playerIdMap[game.player_1_2]}`}
                                                            style={{
                                                                color: '#007bff',
                                                                textDecoration: 'none',
                                                                fontWeight: '500',
                                                                fontSize: '14px',
                                                                verticalAlign: 'top',
                                                                lineHeight: '14px',
                                                            }}
                                                        >
                                                            {game.player_1_2}
                                                        </Link>
                                                    ) : (
                                                        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_1_2}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Счет по центру */}
                                            <div
                                                style={{
                                                    textAlign: 'center',
                                                    fontSize: '32px',
                                                    fontWeight: 'bold',
                                                    lineHeight: '1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '2px',
                                                }}
                                            >
                                                <span 
                                                    style={{ 
                                                        color: team1Won ? '#28a745' : '#666',
                                                        backgroundColor: team1Won ? '#e8f5e9' : '#f5f5f5',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        minWidth: '32px',
                                                    }}
                                                >
                                                    {game.score_1}
                                                </span>
                                                <span style={{ color: '#999', fontSize: '24px' }}>:</span>
                                                <span 
                                                    style={{ 
                                                        color: !team1Won ? '#28a745' : '#666',
                                                        backgroundColor: !team1Won ? '#e8f5e9' : '#f5f5f5',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        minWidth: '32px',
                                                    }}
                                                >
                                                    {game.score_2}
                                                </span>
                                            </div>

                                            {/* Правая команда */}
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ marginBottom: '4px', lineHeight: '14px' }}>
                                                    {playerIdMap[game.player_2_1] ? (
                                                        <Link
                                                            href={`/player/${playerIdMap[game.player_2_1]}`}
                                                            style={{
                                                                color: '#007bff',
                                                                textDecoration: 'none',
                                                                fontWeight: '500',
                                                                fontSize: '14px',
                                                                verticalAlign: 'top',
                                                                lineHeight: '14px',
                                                            }}
                                                        >
                                                            {game.player_2_1}
                                                        </Link>
                                                    ) : (
                                                        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_2_1}</span>
                                                    )}
                                                </div>
                                                <div style={{ lineHeight: '14px', verticalAlign: 'bottom' }}>
                                                    {playerIdMap[game.player_2_2] ? (
                                                        <Link
                                                            href={`/player/${playerIdMap[game.player_2_2]}`}
                                                            style={{
                                                                color: '#007bff',
                                                                textDecoration: 'none',
                                                                fontWeight: '500',
                                                                fontSize: '14px',
                                                                verticalAlign: 'top',
                                                                lineHeight: '14px',
                                                            }}
                                                        >
                                                            {game.player_2_2}
                                                        </Link>
                                                    ) : (
                                                        <span style={{ fontWeight: '500', fontSize: '14px', lineHeight: '14px' }}>{game.player_2_2}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
