'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function PlayerPage() {
    const params = useParams()
    const router = useRouter()
    const playerId = params.id as string
    
    const [player, setPlayer] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data, error: queryError } = await supabase
                    .from('players_hall_of_fame_ranked')
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

    if (loading) return <div>Загрузка...</div>
    if (error) return <div>Ошибка: {error}</div>
    if (!player) return <div>Игрок не найден</div>

    return (
        <main style={{ padding: 24 }}>
            <Link href="/" className="text-blue-600 hover:underline mb-4 block">
                ← Назад к рейтингу
            </Link>
            
            <h1 className="text-2xl font-bold mb-4">Статистика игрока: {player.username}</h1>
            
            <div className="border p-6 rounded">
                <p><strong>Место в рейтинге:</strong> #{player.place}</p>
                <p><strong>Игр сыграно:</strong> {player.games_played}</p>
                <p><strong>Побед:</strong> {player.wins}</p>
                <p><strong>Winrate:</strong> {player.win_rate}%</p>
            </div>
            
            <p className="mt-4 text-gray-600">Детальная статистика будет добавлена позже</p>
        </main>
    )
}

