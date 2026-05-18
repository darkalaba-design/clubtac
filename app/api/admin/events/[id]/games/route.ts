import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { isUuid } from '@/lib/uuid'
import {
    buildEventGameSummaries,
    type EventGameSummaryRow,
} from '@/lib/admin/eventGames'

type RouteParams = { params: Promise<{ id: string }> }

const USER_SELECT = 'id, first_name, last_name, username, nickname, takoff'

function parseUserId(body: Record<string, unknown>, key: string): number | null {
    const raw = body[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n) || n < 1) return null
    return Math.floor(n)
}

function parseScore(body: Record<string, unknown>, key: string): number | null {
    const raw = body[key]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 8) return null
    return Math.floor(n)
}

/** Партии события (для вкладки «Партии» в админке). */
export async function GET(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { id: eventId } = await ctx.params
    if (!eventId || typeof eventId !== 'string' || !isUuid(eventId)) {
        return NextResponse.json({ error: 'Некорректный id события (ожидается UUID)' }, { status: 400 })
    }

    const { supabase } = gate

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
            .select(USER_SELECT)
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
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { id: eventId } = await ctx.params
    if (!eventId || typeof eventId !== 'string' || !isUuid(eventId)) {
        return NextResponse.json({ error: 'Некорректный id события (ожидается UUID)' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const team1Player1 = parseUserId(body, 'team1_player1_id')
    const team1Player2 = parseUserId(body, 'team1_player2_id')
    const team2Player1 = parseUserId(body, 'team2_player1_id')
    const team2Player2 = parseUserId(body, 'team2_player2_id')
    const score1 = parseScore(body, 'team1_score')
    const score2 = parseScore(body, 'team2_score')

    if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
        return NextResponse.json({ error: 'Нужны id всех четырёх игроков' }, { status: 400 })
    }
    if (score1 == null || score2 == null) {
        return NextResponse.json({ error: 'Счёт команд: целое от 0 до 8' }, { status: 400 })
    }

    const userIds = [team1Player1, team1Player2, team2Player1, team2Player2]
    if (new Set(userIds).size !== 4) {
        return NextResponse.json({ error: 'Игроки должны быть разными' }, { status: 400 })
    }

    const { supabase } = gate

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
        .in('id', userIds)
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
            created_by: gate.actor.id,
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

    const playerInserts = [
        { game_id: gameId, user_id: team1Player1, team_number: 1, score: score1 },
        { game_id: gameId, user_id: team1Player2, team_number: 1, score: score1 },
        { game_id: gameId, user_id: team2Player1, team_number: 2, score: score2 },
        { game_id: gameId, user_id: team2Player2, team_number: 2, score: score2 },
    ]

    const { error: playersInsertErr } = await supabase.from('clubtac_players').insert(playerInserts)

    if (playersInsertErr) {
        console.error('POST event game insert players:', playersInsertErr)
        await supabase.from('clubtac_games').delete().eq('id', gameId)
        return NextResponse.json({ error: playersInsertErr.message }, { status: 500 })
    }

    const { error: eloErr } = await supabase.rpc('clubtac_calculate_elo', { p_game_id: gameId })

    if (eloErr) {
        console.error('POST event game calculate_elo:', eloErr)
        await supabase.from('clubtac_players').delete().eq('game_id', gameId)
        await supabase.from('clubtac_games').delete().eq('id', gameId)
        return NextResponse.json({ error: eloErr.message }, { status: 500 })
    }

    const { data: usersFull } = await supabase.from('clubtac_users').select(USER_SELECT).in('id', userIds)

    const usersById = new Map(
        (usersFull ?? []).map((u: { id: number; first_name?: string | null; last_name?: string | null; username?: string | null; nickname?: string | null; takoff?: boolean | null }) => [
            u.id,
            {
                user_id: u.id,
                first_name: u.first_name ?? null,
                last_name: u.last_name ?? null,
                username: u.username ?? null,
                nickname: u.nickname ?? null,
                takoff: u.takoff ?? null,
            },
        ])
    )

    const [summary] = buildEventGameSummaries(
        [{ id: gameId, created_at: insertedGame.created_at as string | null }],
        playerInserts,
        usersById
    )

    return NextResponse.json({ ok: true, game_id: gameId, game: summary }, { status: 201 })
}
