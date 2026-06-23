import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageAdmins } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

const USER_SELECT =
    'id, telegram_id, first_name, last_name, username, nickname, app_role, admin_club_id, created_at'

function escapeIlike(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function applyUsersSearch<T extends { or: (filters: string) => T }>(query: T, rawQ: string): T {
    const q = rawQ.trim()
    if (!q) return query

    if (/^\d+$/.test(q)) {
        const n = Number.parseInt(q, 10)
        return query.or(`id.eq.${n},telegram_id.eq.${n}`)
    }

    const pat = `%${escapeIlike(q)}%`
    return query.or(
        `first_name.ilike."${pat}",last_name.ilike."${pat}",username.ilike."${pat}",nickname.ilike."${pat}"`
    )
}

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
    let limit = 5000
    if (limitRaw) {
        const n = Number.parseInt(limitRaw, 10)
        if (Number.isFinite(n)) limit = Math.min(5000, Math.max(1, n))
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

    const { supabase } = gate

    const { count: total, error: countErr } = await supabase
        .from('clubtac_users')
        .select('*', { count: 'exact', head: true })

    if (countErr) {
        console.error('GET /api/admin/users count:', countErr)
        return NextResponse.json({ error: countErr.message }, { status: 500 })
    }

    let dataQuery = supabase.from('clubtac_users').select(USER_SELECT).order('id', { ascending: false }).limit(limit)
    dataQuery = applyUsersSearch(dataQuery, q)

    const { data, error } = await dataQuery

    if (error) {
        console.error('GET /api/admin/users:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const users = data ?? []
    return NextResponse.json({
        users,
        total: total ?? users.length,
        loaded: users.length,
        truncated: q ? false : users.length < (total ?? users.length),
    })
}
