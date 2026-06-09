import { NextRequest, NextResponse } from 'next/server'
import { getBroadcastsForAdminsEnabled, setBroadcastsForAdminsEnabled } from '@/lib/admin/appSettings'
import { canManageAdmins } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { requireActor } from '@/lib/admin/requireActor'

/** Текущее значение переключателя «рассылки для admin». Только root. */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageAdmins(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Только root может менять настройки' }, { status: 403 })
    }

    const enabled = await getBroadcastsForAdminsEnabled(gate.supabase)
    return NextResponse.json({ enabled })
}

/** Включить/выключить рассылки для admin. Только root. */
export async function PATCH(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageAdmins(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Только root может менять настройки' }, { status: 403 })
    }

    let body: { enabled?: unknown }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Нужен JSON: { "enabled": true | false }' }, { status: 400 })
    }

    if (typeof body.enabled !== 'boolean') {
        return NextResponse.json({ error: 'enabled: boolean' }, { status: 400 })
    }

    try {
        await setBroadcastsForAdminsEnabled(gate.supabase, body.enabled)
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Не удалось сохранить настройку'
        return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ enabled: body.enabled })
}
