import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

/** Рейтинг игроков (новый Elo) для админки. */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const limitRaw = request.nextUrl.searchParams.get('limit')
    let limit = 200
    if (limitRaw) {
        const n = Number.parseInt(limitRaw, 10)
        if (Number.isFinite(n)) limit = Math.min(500, Math.max(1, n))
    }

    const { supabase } = gate
    const { data, error } = await supabase
        .from('clubtac_elo_leaderboard')
        .select('*')
        .order('place', { ascending: true })
        .limit(limit)

    if (error) {
        console.error('GET /api/admin/players:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data ?? []
    const ids = [
        ...new Set(
            rows
                .map((r: { user_id?: number }) => Number(r.user_id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
        ),
    ]

    let usersById: Record<number, { username: string | null; takoff: boolean }> = {}
    if (ids.length > 0) {
        const { data: userRows } = await supabase
            .from('clubtac_users')
            .select('id, username, takoff')
            .in('id', ids)
        if (userRows) {
            usersById = Object.fromEntries(
                userRows.map((u: { id: number; username?: string | null; takoff?: boolean | null }) => [
                    u.id,
                    { username: u.username ?? null, takoff: !!u.takoff },
                ])
            )
        }
    }

    const players = rows.map((row: Record<string, unknown>) => {
        const uid = Number(row.user_id)
        const meta = usersById[uid]
        return {
            ...row,
            username: meta?.username ?? null,
            takoff: meta?.takoff ?? false,
        }
    })

    return NextResponse.json({ players })
}
