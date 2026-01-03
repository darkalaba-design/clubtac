import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('players_hall_of_fame_ranked')
    .select('*')
    .order('place')

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">🏆 Hall of Fame</h1>

      <ul className="space-y-2">
        {data?.map(player => (
          <li key={player.user_id} className="border p-3 rounded">
            #{player.place} — {player.username}
            <br />
            Games: {player.games_played} | Wins: {player.wins} | Winrate: {player.win_rate}%
          </li>
        ))}
      </ul>
    </main>
  )
}