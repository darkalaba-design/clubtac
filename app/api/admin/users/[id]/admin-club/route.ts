import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageAdmins, parseAppRole } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

type RouteParams = { params: Promise<{ id: string }> }

/** Смена клуба управления admin — только root. */
export async function PATCH(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageAdmins(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Только root может менять клуб admin' }, { status: 403 })
    }

    const { id: idParam } = await ctx.params
    const targetId = Number.parseInt(idParam, 10)
    if (!Number.isFinite(targetId) || targetId <= 0) {
        return NextResponse.json({ error: 'Некорректный id пользователя' }, { status: 400 })
    }

    let body: { admin_club_id?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const adminClubId =
        typeof body.admin_club_id === 'string' && body.admin_club_id.trim()
            ? body.admin_club_id.trim()
            : null

    if (!adminClubId) {
        return NextResponse.json({ error: 'Нужен admin_club_id (uuid клуба)' }, { status: 400 })
    }

    const { supabase } = gate

    const { data: targetRow, error: targetErr } = await supabase
        .from('clubtac_users')
        .select('app_role, admin_club_id')
        .eq('id', targetId)
        .maybeSingle()

    if (targetErr) {
        console.error('PATCH /api/admin/users/[id]/admin-club read:', targetErr)
        return NextResponse.json({ error: targetErr.message }, { status: 500 })
    }
    if (!targetRow) {
        return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const role = parseAppRole((targetRow as { app_role?: unknown }).app_role)
    if (role === 'root') {
        return NextResponse.json({ error: 'Клуб управления для root не задаётся' }, { status: 403 })
    }
    if (role !== 'admin') {
        return NextResponse.json({ error: 'Клуб управления можно задать только пользователю с ролью admin' }, { status: 400 })
    }

    const { data: clubRow, error: clubErr } = await supabase
        .from('clubtac_clubs')
        .select('id')
        .eq('id', adminClubId)
        .maybeSingle()

    if (clubErr) {
        console.error('PATCH /api/admin/users/[id]/admin-club club:', clubErr)
        return NextResponse.json({ error: clubErr.message }, { status: 500 })
    }
    if (!clubRow) {
        return NextResponse.json({ error: 'Клуб не найден' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
        .from('clubtac_users')
        .update({ admin_club_id: adminClubId })
        .eq('id', targetId)
        .select('id, telegram_id, first_name, last_name, username, app_role, admin_club_id')
        .maybeSingle()

    if (error) {
        console.error('PATCH /api/admin/users/[id]/admin-club:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated) {
        return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    return NextResponse.json({ user: updated })
}
