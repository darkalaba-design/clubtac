import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { getPlayedGamesBaseTable } from '@/lib/admin/gamesTable'
import { isAppAdminGamesWriteImplemented } from '@/lib/admin/gamesWrite'

type RouteParams = { params: Promise<{ gameId: string }> }

/** Удаление сыгранной партии из базовой таблицы по game_id. */
export async function DELETE(request: NextRequest, ctx: RouteParams) {
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
                error: 'Удаление партий через приложение пока не подключено (будут clubtac_games и clubtac_players).',
                code: 'GAMES_WRITE_NOT_IMPLEMENTED',
            },
            { status: 501 }
        )
    }

    const { gameId: raw } = await ctx.params
    const gameId = Number.parseInt(raw, 10)
    if (!Number.isFinite(gameId) || gameId <= 0) {
        return NextResponse.json({ error: 'Некорректный game_id' }, { status: 400 })
    }

    const table = getPlayedGamesBaseTable()
    const { supabase } = gate
    const { data, error } = await supabase.from(table).delete().eq('game_id', gameId).select('game_id').maybeSingle()

    if (error) {
        console.error('DELETE /api/admin/games/[gameId]:', error)
        return NextResponse.json({ error: error.message, table }, { status: 500 })
    }
    if (!data) {
        return NextResponse.json({ error: 'Партия с таким game_id не найдена', table }, { status: 404 })
    }

    return NextResponse.json({ ok: true, deleted: data })
}
