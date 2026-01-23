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

    if (loading) return <div>Загрузка...</div>
    if (error) return <div>Ошибка: {error}</div>
    if (players.length === 0) return <div>Нет данных</div>

    return (
        <ul className="space-y-2">
            {players.map((player) => (
                <li key={player.user_id} className="border p-3 rounded">
                    #{player.place} —{' '}
                    <Link href={`/player/${player.user_id}`} className="text-blue-600 hover:underline">
                        {player.username}
                    </Link>
                    <br />
                    Игр: {player.games_played} | Побед: {player.wins} | % побед: {player.win_rate}%
                </li>
            ))}
        </ul>
    )
}