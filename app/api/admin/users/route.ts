import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageAdmins } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

/** Список пользователей для назначения админов — только root. */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageAdmins(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Только root может просматривать список для управления админами' }, { status: 403 })
    }

    const limitRaw = request.nextUrl.searchParams.get('limit')
    let limit = 100
    if (limitRaw) {
        const n = Number.parseInt(limitRaw, 10)
        if (Number.isFinite(n)) limit = Math.min(200, Math.max(1, n))
    }

    const { supabase } = gate
    const { data, error } = await supabase
        .from('clubtac_users')
        .select('id, telegram_id, first_name, last_name, username, app_role, created_at')
        .order('id', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('GET /api/admin/users:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: data ?? [] })
}
