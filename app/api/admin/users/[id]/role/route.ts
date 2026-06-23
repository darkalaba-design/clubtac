import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageAdmins, parseAppRole } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * Смена роли пользователя: только root.
 * Тело: { "app_role": "admin" | "user", "admin_club_id"?: string }.
 * При выдаче admin обязателен admin_club_id; при снятии admin_club_id сбрасывается.
 */
export async function PATCH(request: NextRequest, ctx: RouteParams) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageAdmins(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Только root может менять роли' }, { status: 403 })
    }

    const { id: idParam } = await ctx.params
    const targetId = Number.parseInt(idParam, 10)
    if (!Number.isFinite(targetId) || targetId <= 0) {
        return NextResponse.json({ error: 'Некорректный id пользователя' }, { status: 400 })
    }

    let body: { app_role?: unknown; admin_club_id?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON в теле запроса' }, { status: 400 })
    }

    const nextRole = parseAppRole(body.app_role)
    if (!nextRole || nextRole === 'root') {
        return NextResponse.json(
            { error: 'Можно выставить только app_role: "admin" или "user"' },
            { status: 400 }
        )
    }

    const adminClubIdRaw = body.admin_club_id
    const adminClubId =
        typeof adminClubIdRaw === 'string' && adminClubIdRaw.trim() ? adminClubIdRaw.trim() : null

    if (nextRole === 'admin' && !adminClubId) {
        return NextResponse.json(
            { error: 'При назначении admin укажите admin_club_id (клуб управления)' },
            { status: 400 }
        )
    }

    const { supabase } = gate

    const { data: targetRow, error: targetErr } = await supabase
        .from('clubtac_users')
        .select('app_role')
        .eq('id', targetId)
        .maybeSingle()

    if (targetErr) {
        console.error('PATCH /api/admin/users/[id]/role read:', targetErr)
        return NextResponse.json({ error: targetErr.message }, { status: 500 })
    }
    if (!targetRow) {
        return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }
    if (parseAppRole((targetRow as { app_role?: unknown }).app_role) === 'root') {
        return NextResponse.json({ error: 'Роль root нельзя изменить через API' }, { status: 403 })
    }

    if (nextRole === 'admin' && adminClubId) {
        const { data: clubRow, error: clubErr } = await supabase
            .from('clubtac_clubs')
            .select('id')
            .eq('id', adminClubId)
            .maybeSingle()

        if (clubErr) {
            console.error('PATCH /api/admin/users/[id]/role club:', clubErr)
            return NextResponse.json({ error: clubErr.message }, { status: 500 })
        }
        if (!clubRow) {
            return NextResponse.json({ error: 'Клуб admin_club_id не найден' }, { status: 400 })
        }
    }

    const updatePayload: Record<string, unknown> = {
        app_role: nextRole,
        admin_club_id: nextRole === 'admin' ? adminClubId : null,
    }

    const { data: updated, error } = await supabase
        .from('clubtac_users')
        .update(updatePayload)
        .eq('id', targetId)
        .select('id, telegram_id, first_name, username, app_role, admin_club_id')
        .maybeSingle()

    if (error) {
        console.error('PATCH /api/admin/users/[id]/role:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated) {
        return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    return NextResponse.json({ user: updated })
}
