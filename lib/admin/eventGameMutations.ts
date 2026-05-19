import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventGamePlayerInsert, EventGamePlayerSnapshot } from '@/lib/admin/eventGameBody'

export const EVENT_GAME_USER_SELECT = 'id, first_name, last_name, username, nickname, takoff'

export async function deleteEloForGame(supabase: SupabaseClient, gameId: number) {
    return supabase.rpc('clubtac_delete_elo_game', { p_game_id: gameId })
}

export async function calculateEloForGame(supabase: SupabaseClient, gameId: number) {
    return supabase.rpc('clubtac_calculate_elo', { p_game_id: gameId })
}

export async function fetchPlayerSnapshot(
    supabase: SupabaseClient,
    gameId: number
): Promise<EventGamePlayerSnapshot[]> {
    const { data, error } = await supabase
        .from('clubtac_players')
        .select('user_id, team_number, score')
        .eq('game_id', gameId)

    if (error) throw error
    return (data ?? []) as EventGamePlayerSnapshot[]
}

export async function deletePlayersForGame(supabase: SupabaseClient, gameId: number) {
    return supabase.from('clubtac_players').delete().eq('game_id', gameId)
}

export async function insertPlayersForGame(supabase: SupabaseClient, rows: EventGamePlayerInsert[]) {
    return supabase.from('clubtac_players').insert(rows)
}

/** Восстановить состав и пересчитать Elo после неудачного PATCH. */
export async function rollbackGamePlayersAndElo(
    supabase: SupabaseClient,
    gameId: number,
    snapshot: EventGamePlayerSnapshot[]
) {
    await deletePlayersForGame(supabase, gameId)
    if (snapshot.length > 0) {
        const rows = snapshot.map((p) => ({
            game_id: gameId,
            user_id: p.user_id,
            team_number: p.team_number,
            score: p.score,
        }))
        const { error: insertErr } = await insertPlayersForGame(supabase, rows)
        if (insertErr) return { error: insertErr }
    }
    return calculateEloForGame(supabase, gameId)
}
