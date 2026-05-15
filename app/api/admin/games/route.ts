import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { getPlayedGamesBaseTable } from '@/lib/admin/gamesTable'
import { isAppAdminGamesWriteImplemented } from '@/lib/admin/gamesWrite'

const GAMES_SUMMARY_SELECT =
    'game_id, created_at, player_1_1, player_1_2, player_2_1, player_2_2, score_1, score_2'

/** Последние партии (из view games_summary) — только просмотр для админки. */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const limitRaw = request.nextUrl.searchParams.get('limit')
    let limit = 80
    if (limitRaw) {
        const n = Number.parseInt(limitRaw, 10)
        if (Number.isFinite(n)) limit = Math.min(200, Math.max(1, n))
    }

    const { supabase } = gate
    const { data, error } = await supabase
        .from('games_summary')
        .select(GAMES_SUMMARY_SELECT)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('GET /api/admin/games:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        games: data ?? [],
        games_read_only: true,
        games_write_implemented: isAppAdminGamesWriteImplemented(),
    })
}

/** Добавление партии — позже через clubtac_games + clubtac_players. */
export async function POST(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    if (!isAppAdminGamesWriteImplemented()) {
        return NextResponse.json(
            {
                error: 'Добавление партий через приложение пока не подключено (будут clubtac_games и clubtac_players).',
                code: 'GAMES_WRITE_NOT_IMPLEMENTED',
            },
            { status: 501 }
        )
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')
    const num = (k: string) => (typeof body[k] === 'number' && Number.isFinite(body[k]) ? (body[k] as number) : NaN)

    const player_1_1 = str('player_1_1')
    const player_1_2 = str('player_1_2')
    const player_2_1 = str('player_2_1')
    const player_2_2 = str('player_2_2')
    const score_1 = num('score_1')
    const score_2 = num('score_2')

    if (!player_1_1 || !player_1_2 || !player_2_1 || !player_2_2) {
        return NextResponse.json({ error: 'Обязательны строки player_1_1, player_1_2, player_2_1, player_2_2' }, { status: 400 })
    }
    if (!Number.isFinite(score_1) || !Number.isFinite(score_2)) {
        return NextResponse.json({ error: 'Обязательны числа score_1, score_2' }, { status: 400 })
    }

    const table = getPlayedGamesBaseTable()
    const row: Record<string, unknown> = {
        player_1_1,
        player_1_2,
        player_2_1,
        player_2_2,
        score_1,
        score_2,
    }

    if (typeof body.created_at === 'string' && body.created_at.trim()) {
        row.created_at = body.created_at.trim()
    }

    if (typeof body.game_id === 'number' && Number.isFinite(body.game_id) && body.game_id > 0) {
        row.game_id = Math.floor(body.game_id)
    }

    const { supabase } = gate
    const { data, error } = await supabase.from(table).insert(row).select('*').maybeSingle()

    if (error) {
        console.error('POST /api/admin/games:', error)
        return NextResponse.json(
            {
                error: error.message,
                hint: `Проверьте таблицу CLUBTAC_PLAYED_GAMES_TABLE (сейчас: ${table}) и колонки базовой таблицы (player_*, score_*).`,
            },
            { status: 500 }
        )
    }

    return NextResponse.json({ game: data, table }, { status: 201 })
}
