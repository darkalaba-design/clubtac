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

    if (loading) return <div>Загрузка...</div>
    if (error) return <div>Ошибка: {error}</div>
    if (games.length === 0) return <div>Нет данных</div>

    // Группировка игр по датам
    const gamesByDate = games.reduce((acc, game) => {
        const date = new Date(game.created_at).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })

        if (!acc[date]) {
            acc[date] = []
        }
        acc[date].push(game)
        return acc
    }, {} as Record<string, Game[]>)

    return (
        <div className="space-y-8">
            {Object.entries(gamesByDate).map(([date, dateGames]) => (
                <div key={date}>
                    <h2 className="text-xl font-bold mb-4">{date}</h2>
                    <div className="space-y-4">
                        {dateGames.map((game) => (
                            <div
                                key={game.game_id}
                                className="border rounded-lg p-6 bg-white dark:bg-gray-800"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto 1fr',
                                    alignItems: 'center',
                                    gap: '12px',
                                }}
                            >
                                {/* Левая команда */}
                                <div className="text-right">
                                    <div className="mb-2">
                                        {playerIdMap[game.player_1_1] ? (
                                            <Link
                                                href={`/player/${playerIdMap[game.player_1_1]}`}
                                                className="text-blue-600 hover:underline font-medium"
                                            >
                                                {game.player_1_1}
                                            </Link>
                                        ) : (
                                            <span className="font-medium">{game.player_1_1}</span>
                                        )}
                                    </div>
                                    <div>
                                        {playerIdMap[game.player_1_2] ? (
                                            <Link
                                                href={`/player/${playerIdMap[game.player_1_2]}`}
                                                className="text-blue-600 hover:underline font-medium"
                                            >
                                                {game.player_1_2}
                                            </Link>
                                        ) : (
                                            <span className="font-medium">{game.player_1_2}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Счет по центру */}
                                <div
                                    className="text-center"
                                    style={{
                                        fontSize: '40px',
                                        fontWeight: 'bold',
                                        lineHeight: '1',
                                    }}
                                >
                                    <span className={game.score_1 > game.score_2 ? 'text-green-600' : 'text-gray-600'}>
                                        {game.score_1}
                                    </span>
                                    <span className="mx-2 text-gray-400">:</span>
                                    <span className={game.score_2 > game.score_1 ? 'text-green-600' : 'text-gray-600'}>
                                        {game.score_2}
                                    </span>
                                </div>

                                {/* Правая команда */}
                                <div className="text-left">
                                    <div className="mb-2">
                                        {playerIdMap[game.player_2_1] ? (
                                            <Link
                                                href={`/player/${playerIdMap[game.player_2_1]}`}
                                                className="text-blue-600 hover:underline font-medium"
                                            >
                                                {game.player_2_1}
                                            </Link>
                                        ) : (
                                            <span className="font-medium">{game.player_2_1}</span>
                                        )}
                                    </div>
                                    <div>
                                        {playerIdMap[game.player_2_2] ? (
                                            <Link
                                                href={`/player/${playerIdMap[game.player_2_2]}`}
                                                className="text-blue-600 hover:underline font-medium"
                                            >
                                                {game.player_2_2}
                                            </Link>
                                        ) : (
                                            <span className="font-medium">{game.player_2_2}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

