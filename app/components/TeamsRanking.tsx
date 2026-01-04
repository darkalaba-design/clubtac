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

    if (loading) return <div>Загрузка...</div>
    if (error) return <div>Ошибка: {error}</div>
    if (teams.length === 0) return <div>Нет данных</div>

    return (
        <ul className="space-y-2">
            {teams.map((team) => {
                const winRate = team.games_played > 0
                    ? Math.round((team.wins / team.games_played) * 100)
                    : 0

                return (
                    <li key={`${team.player_1_id}-${team.player_2_id}`} className="border p-3 rounded">
                        #{team.rank} —{' '}
                        <Link href={`/player/${team.player_1_id}`} className="text-blue-600 hover:underline">
                            {team.player_1_username}
                        </Link>
                        {' + '}
                        <Link href={`/player/${team.player_2_id}`} className="text-blue-600 hover:underline">
                            {team.player_2_username}
                        </Link>
                        <br />
                        Games: {team.games_played} | Wins: {team.wins} | Winrate: {winRate}%
                    </li>
                )
            })}
        </ul>
    )
}