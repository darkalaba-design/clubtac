import {
    buildEventGameSummaries,
    type EventGameSummaryRow,
} from '@/lib/admin/eventGames'
import { EVENT_GAME_USER_SELECT } from '@/lib/admin/eventGameMutations'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminGamesByEventGroup = {
    event_id: string
    event_title: string | null
    starts_at: string | null
    games: EventGameSummaryRow[]
}

type GameRow = { id: number; created_at: string | null; event_id: string | null }

type PlayerRow = {
    game_id: number | string
    user_id: number
    team_number: number
    score: number | null
}

/** Все партии админки, сгруппированные по событиям (новые события сверху). */
export async function fetchAdminGamesGroupedByEvent(
    supabase: SupabaseClient,
    options?: { gamesLimit?: number }
): Promise<AdminGamesByEventGroup[]> {
    const gamesLimit = options?.gamesLimit ?? 500

    const { data: gameRows, error: gamesErr } = await supabase
        .from('clubtac_games')
        .select('id, created_at, event_id')
        .not('event_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(gamesLimit)

    if (gamesErr) {
        throw gamesErr
    }

    const games = (gameRows ?? []) as GameRow[]
    if (games.length === 0) {
        return []
    }

    const gameIds = games.map((g) => g.id)
    const eventIds = [...new Set(games.map((g) => g.event_id).filter((id): id is string => Boolean(id)))]

    const [playersRes, eventsRes] = await Promise.all([
        supabase
            .from('clubtac_players')
            .select('game_id, user_id, team_number, score')
            .in('game_id', gameIds),
        eventIds.length > 0
            ? supabase.from('clubtac_events').select('id, title, starts_at').in('id', eventIds)
            : Promise.resolve({ data: [], error: null }),
    ])

    if (playersRes.error) throw playersRes.error
    if (eventsRes.error) throw eventsRes.error

    const eventById = new Map<
        string,
        { title: string | null; starts_at: string | null }
    >()
    for (const e of eventsRes.data ?? []) {
        const row = e as { id: string; title?: string | null; starts_at?: string | null }
        eventById.set(row.id, {
            title: row.title ?? null,
            starts_at: row.starts_at ?? null,
        })
    }

    const userIds = [...new Set((playersRes.data ?? []).map((r: PlayerRow) => r.user_id))]
    let usersById = new Map<
        number,
        {
            user_id: number
            first_name?: string | null
            last_name?: string | null
            username?: string | null
            nickname?: string | null
            takoff?: boolean | null
        }
    >()

    if (userIds.length > 0) {
        const { data: users, error: usersErr } = await supabase
            .from('clubtac_users')
            .select(EVENT_GAME_USER_SELECT)
            .in('id', userIds)

        if (usersErr) throw usersErr

        usersById = new Map(
            (users ?? []).map(
                (u: {
                    id: number
                    first_name?: string | null
                    last_name?: string | null
                    username?: string | null
                    nickname?: string | null
                    takoff?: boolean | null
                }) => [
                    u.id,
                    {
                        user_id: u.id,
                        first_name: u.first_name ?? null,
                        last_name: u.last_name ?? null,
                        username: u.username ?? null,
                        nickname: u.nickname ?? null,
                        takoff: u.takoff ?? null,
                    },
                ]
            )
        )
    }

    const summaries = buildEventGameSummaries(
        games.map((g) => ({ id: g.id, created_at: g.created_at })),
        (playersRes.data ?? []) as PlayerRow[],
        usersById
    )

    const summariesByGameId = new Map(summaries.map((s) => [s.game_id, s]))
    const gamesByEventId = new Map<string, EventGameSummaryRow[]>()

    for (const g of games) {
        const eventId = g.event_id
        if (!eventId) continue
        const summary = summariesByGameId.get(g.id)
        if (!summary) continue
        const list = gamesByEventId.get(eventId) ?? []
        list.push(summary)
        gamesByEventId.set(eventId, list)
    }

    const groups: AdminGamesByEventGroup[] = eventIds.map((eventId) => {
        const meta = eventById.get(eventId)
        const eventGames = gamesByEventId.get(eventId) ?? []
        eventGames.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        return {
            event_id: eventId,
            event_title: meta?.title ?? null,
            starts_at: meta?.starts_at ?? null,
            games: eventGames,
        }
    })

    groups.sort((a, b) => {
        const ta = a.starts_at ? new Date(a.starts_at).getTime() : 0
        const tb = b.starts_at ? new Date(b.starts_at).getTime() : 0
        if (tb !== ta) return tb - ta
        return (b.event_title ?? '').localeCompare(a.event_title ?? '', 'ru')
    })

    return groups.filter((g) => g.games.length > 0)
}
