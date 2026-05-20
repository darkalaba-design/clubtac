import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { parsePlayerClubStatus } from '@/lib/admin/adminPlayerDetail'

type RouteParams = { params: Promise<{ userId: string }> }

function parseUserId(raw: string): number | null {
    const id = Number.parseInt(raw, 10)
    if (!Number.isFinite(id) || id < 1) return null
    return id
}

/** Смена статуса в клубе (standard / vip / partner) для игрока. */
export async function PATCH(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { userId: userIdRaw } = await ctx.params
    const userId = parseUserId(userIdRaw)
    if (userId == null) {
        return NextResponse.json({ error: 'Некорректный id игрока' }, { status: 400 })
    }

    let body: { status?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const nextStatus = parsePlayerClubStatus(body.status)
    if (!nextStatus) {
        return NextResponse.json(
            { error: 'status: "standard", "vip" или "partner"' },
            { status: 400 }
        )
    }

    const { supabase } = gate

    const { data: updated, error } = await supabase
        .from('clubtac_users')
        .update({ status: nextStatus })
        .eq('id', userId)
        .select('id, status')
        .maybeSingle()

    if (error) {
        console.error('PATCH /api/admin/players/[userId]/status:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated) {
        return NextResponse.json({ error: 'Игрок не найден' }, { status: 404 })
    }

    return NextResponse.json({ user: updated })
}
