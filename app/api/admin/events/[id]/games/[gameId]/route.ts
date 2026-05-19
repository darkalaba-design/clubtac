import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildEventGameSummaries } from '@/lib/admin/eventGames'
import { buildPlayerInserts, parseEventGameBody, parseGameIdParam } from '@/lib/admin/eventGameBody'
import {
    calculateEloForGame,
    deleteEloForGame,
    deletePlayersForGame,
    EVENT_GAME_USER_SELECT,
    fetchPlayerSnapshot,
    insertPlayersForGame,
    rollbackGamePlayersAndElo,
} from '@/lib/admin/eventGameMutations'
import { requireEventGamesAdmin } from '@/lib/admin/requireEventGamesAdmin'

type RouteParams = { params: Promise<{ id: string; gameId: string }> }

async function assertActiveUsers(
    supabase: SupabaseClient,
    userIds: number[]
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
    const { data: users, error: usersErr } = await supabase
        .from('clubtac_users')
        .select('id')
        .in('id', userIds)
        .eq('is_active', true)

    if (usersErr) {
        console.error('event game users check:', usersErr)
        return {
            ok: false,
            response: NextResponse.json({ error: usersErr.message }, { status: 500 }),
        }
    }
    if ((users ?? []).length !== 4) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Один или несколько игроков не найдены или неактивны' },
                { status: 400 }
            ),
        }
    }
    return { ok: true }
}

async function fetchGameInEvent(supabase: SupabaseClient, gameId: number, eventId: string) {
    return supabase
        .from('clubtac_games')
        .select('id, created_at, event_id')
        .eq('id', gameId)
        .eq('event_id', eventId)
        .maybeSingle()
}

/** Редактирование: delete_elo → замена игроков → calculate_elo. */
export async function PATCH(request: NextRequest, ctx: RouteParams) {
    const { id: eventId, gameId: gameIdRaw } = await ctx.params
    const auth = await requireEventGamesAdmin(request, eventId)
    if (!auth.ok) return auth.response

    const gameId = parseGameIdParam(gameIdRaw)
    if (gameId == null) {
        return NextResponse.json({ error: 'Некорректный id партии' }, { status: 400 })
    }

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

    const { supabase } = auth
    const { data: gameRow, error: gameErr } = await fetchGameInEvent(supabase, gameId, eventId)

    if (gameErr) {
        console.error('PATCH event game fetch:', gameErr)
        return NextResponse.json({ error: gameErr.message }, { status: 500 })
    }
    if (!gameRow) {
        return NextResponse.json({ error: 'Партия не найдена в этом событии' }, { status: 404 })
    }

    const usersCheck = await assertActiveUsers(supabase, [...parsedBody.data.userIds])
    if (!usersCheck.ok) return usersCheck.response

    let snapshot
    try {
        snapshot = await fetchPlayerSnapshot(supabase, gameId)
    } catch (e) {
        console.error('PATCH event game snapshot:', e)
        return NextResponse.json({ error: 'Не удалось прочитать состав партии' }, { status: 500 })
    }

    if (snapshot.length !== 4) {
        return NextResponse.json({ error: 'Некорректный состав партии в базе' }, { status: 500 })
    }

    const { error: deleteEloErr } = await deleteEloForGame(supabase, gameId)
    if (deleteEloErr) {
        console.error('PATCH event game delete_elo:', deleteEloErr)
        return NextResponse.json({ error: deleteEloErr.message }, { status: 500 })
    }

    const { error: deletePlayersErr } = await deletePlayersForGame(supabase, gameId)
    if (deletePlayersErr) {
        console.error('PATCH event game delete players:', deletePlayersErr)
        await rollbackGamePlayersAndElo(supabase, gameId, snapshot)
        return NextResponse.json({ error: deletePlayersErr.message }, { status: 500 })
    }

    const playerInserts = buildPlayerInserts(gameId, parsedBody.data)
    const { error: playersInsertErr } = await insertPlayersForGame(supabase, playerInserts)

    if (playersInsertErr) {
        console.error('PATCH event game insert players:', playersInsertErr)
        const { error: rollbackErr } = await rollbackGamePlayersAndElo(supabase, gameId, snapshot)
        if (rollbackErr) {
            console.error('PATCH event game rollback after insert fail:', rollbackErr)
        }
        return NextResponse.json({ error: playersInsertErr.message }, { status: 500 })
    }

    const { error: eloErr } = await calculateEloForGame(supabase, gameId)
    if (eloErr) {
        console.error('PATCH event game calculate_elo:', eloErr)
        const { error: rollbackErr } = await rollbackGamePlayersAndElo(supabase, gameId, snapshot)
        if (rollbackErr) {
            console.error('PATCH event game rollback after elo fail:', rollbackErr)
        }
        return NextResponse.json({ error: eloErr.message }, { status: 500 })
    }

    const { data: usersFull } = await supabase
        .from('clubtac_users')
        .select(EVENT_GAME_USER_SELECT)
        .in('id', [...parsedBody.data.userIds])

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
        [{ id: gameId, created_at: gameRow.created_at as string | null }],
        playerInserts,
        usersById
    )

    return NextResponse.json({ ok: true, game_id: gameId, game: summary })
}

/** Удаление: delete_elo → players → game. */
export async function DELETE(request: NextRequest, ctx: RouteParams) {
    const { id: eventId, gameId: gameIdRaw } = await ctx.params
    const auth = await requireEventGamesAdmin(request, eventId)
    if (!auth.ok) return auth.response

    const gameId = parseGameIdParam(gameIdRaw)
    if (gameId == null) {
        return NextResponse.json({ error: 'Некорректный id партии' }, { status: 400 })
    }

    const { supabase } = auth

    const { data: gameRow, error: gameErr } = await fetchGameInEvent(supabase, gameId, eventId)
    if (gameErr) {
        console.error('DELETE event game fetch:', gameErr)
        return NextResponse.json({ error: gameErr.message }, { status: 500 })
    }
    if (!gameRow) {
        return NextResponse.json({ error: 'Партия не найдена в этом событии' }, { status: 404 })
    }

    const { error: deleteEloErr } = await deleteEloForGame(supabase, gameId)
    if (deleteEloErr) {
        console.error('DELETE event game delete_elo:', deleteEloErr)
        return NextResponse.json({ error: deleteEloErr.message }, { status: 500 })
    }

    const { error: deletePlayersErr } = await deletePlayersForGame(supabase, gameId)
    if (deletePlayersErr) {
        console.error('DELETE event game delete players:', deletePlayersErr)
        return NextResponse.json({ error: deletePlayersErr.message }, { status: 500 })
    }

    const { error: deleteGameErr } = await supabase.from('clubtac_games').delete().eq('id', gameId)
    if (deleteGameErr) {
        console.error('DELETE event game delete game:', deleteGameErr)
        return NextResponse.json({ error: deleteGameErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deleted_game_id: gameId })
}
