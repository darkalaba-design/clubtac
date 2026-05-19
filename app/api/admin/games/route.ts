import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { fetchAdminGamesGroupedByEvent } from '@/lib/admin/adminGamesByEvent'
import { isAppAdminGamesWriteImplemented } from '@/lib/admin/gamesWrite'

/** Все партии по событиям (clubtac_games + clubtac_players). */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const limitRaw = request.nextUrl.searchParams.get('limit')
    let gamesLimit = 500
    if (limitRaw) {
        const n = Number.parseInt(limitRaw, 10)
        if (Number.isFinite(n)) gamesLimit = Math.min(1000, Math.max(1, n))
    }

    const { supabase } = gate

    try {
        const groups = await fetchAdminGamesGroupedByEvent(supabase, { gamesLimit })
        return NextResponse.json({
            groups,
            games_write_implemented: isAppAdminGamesWriteImplemented(),
        })
    } catch (error) {
        console.error('GET /api/admin/games:', error)
        const message = error instanceof Error ? error.message : 'Ошибка загрузки партий'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
