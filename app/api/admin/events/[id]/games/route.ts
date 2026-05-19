import { NextRequest, NextResponse } from 'next/server'
import {
    buildEventGameSummaries,
    type EventGameSummaryRow,
} from '@/lib/admin/eventGames'
import { buildPlayerInserts, parseEventGameBody } from '@/lib/admin/eventGameBody'
import {
    calculateEloForGame,
    deletePlayersForGame,
    EVENT_GAME_USER_SELECT,
    insertPlayersForGame,
} from '@/lib/admin/eventGameMutations'
import { requireEventGamesAdmin } from '@/lib/admin/requireEventGamesAdmin'

type RouteParams = { params: Promise<{ id: string }> }

/** Партии события (для вкладки «Партии» в админке). */
export async function GET(request: NextRequest, ctx: RouteParams) {
    const { id: eventId } = await ctx.params
    const auth = await requireEventGamesAdmin(request, eventId)
    if (!auth.ok) return auth.response

    const { supabase } = auth

    const { data: games, error: gamesErr } = await supabase
        .from('clubtac_games')
        .select('id, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

    if (gamesErr) {
        console.error('GET event games:', gamesErr)
        return NextResponse.json({ error: gamesErr.message }, { status: 500 })
    }

    const gameRows = (games ?? []) as { id: number; created_at: string | null }[]
    if (gameRows.length === 0) {
        return NextResponse.json({ games: [] as EventGameSummaryRow[] })
    }

    const gameIds = gameRows.map((g) => g.id)

    const { data: playerRows, error: playersErr } = await supabase
        .from('clubtac_players')
        .select('game_id, user_id, team_number, score')
        .in('game_id', gameIds)

    if (playersErr) {
        console.error('GET event games players:', playersErr)
        return NextResponse.json({ error: playersErr.message }, { status: 500 })
    }

    const userIds = [...new Set((playerRows ?? []).map((r: { user_id: number }) => r.user_id))]
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

        if (usersErr) {
            console.error('GET event games users:', usersErr)
            return NextResponse.json({ error: usersErr.message }, { status: 500 })
        }

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

    const summaries = buildEventGameSummaries(gameRows, playerRows ?? [], usersById)

    return NextResponse.json({ games: summaries })
}

/** Добавление партии: clubtac_games → clubtac_players → clubtac_calculate_elo. */
export async function POST(request: NextRequest, ctx: RouteParams) {
    const { id: eventId } = await ctx.params
    const auth = await requireEventGamesAdmin(request, eventId)
    if (!auth.ok) return auth.response

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const parsedBody = parseEventGameBody(body)
    if (!parsedBody.ok) {
        return NextResponse.json({ error: parsedBody.error }, { status: 400 })
    }

    const { supabase, actor } = auth
    const { userIds } = parsedBody.data

    const { data: eventRow, error: eventErr } = await supabase
        .from('clubtac_events')
        .select('id')
        .eq('id', eventId)
        .maybeSingle()

    if (eventErr) {
        console.error('POST event game fetch event:', eventErr)
        return NextResponse.json({ error: eventErr.message }, { status: 500 })
    }
    if (!eventRow) {
        return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
    }

    const { data: users, error: usersErr } = await supabase
        .from('clubtac_users')
        .select('id')
        .in('id', [...userIds])
        .eq('is_active', true)

    if (usersErr) {
        console.error('POST event game fetch users:', usersErr)
        return NextResponse.json({ error: usersErr.message }, { status: 500 })
    }
    if ((users ?? []).length !== 4) {
        return NextResponse.json({ error: 'Один или несколько игроков не найдены или неактивны' }, { status: 400 })
    }

    const { data: insertedGame, error: gameInsertErr } = await supabase
        .from('clubtac_games')
        .insert({
            created_by: actor.id,
            event_id: eventId,
        })
        .select('id, created_at')
        .single()

    if (gameInsertErr || !insertedGame) {
        console.error('POST event game insert game:', gameInsertErr)
        return NextResponse.json({ error: gameInsertErr?.message ?? 'Не удалось создать партию' }, { status: 500 })
    }

    const gameId = Number(insertedGame.id)
    if (!Number.isFinite(gameId)) {
        return NextResponse.json({ error: 'Некорректный id созданной партии' }, { status: 500 })
    }

    const playerInserts = buildPlayerInserts(gameId, parsedBody.data)

    const { error: playersInsertErr } = await insertPlayersForGame(supabase, playerInserts)

    if (playersInsertErr) {
        console.error('POST event game insert players:', playersInsertErr)
        await supabase.from('clubtac_games').delete().eq('id', gameId)
        return NextResponse.json({ error: playersInsertErr.message }, { status: 500 })
    }

    const { error: eloErr } = await calculateEloForGame(supabase, gameId)

    if (eloErr) {
        console.error('POST event game calculate_elo:', eloErr)
        await deletePlayersForGame(supabase, gameId)
        await supabase.from('clubtac_games').delete().eq('id', gameId)
        return NextResponse.json({ error: eloErr.message }, { status: 500 })
    }

    const { data: usersFull } = await supabase
        .from('clubtac_users')
        .select(EVENT_GAME_USER_SELECT)
        .in('id', [...userIds])

    const usersById = new Map(
        (usersFull ?? []).map(
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

    const [summary] = buildEventGameSummaries(
        [{ id: gameId, created_at: insertedGame.created_at as string | null }],
        playerInserts,
        usersById
    )

    return NextResponse.json({ ok: true, game_id: gameId, game: summary }, { status: 201 })
}
