import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'

/** Все активные пользователи clubtac_users для вкладки «Игроки» в админке. */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const limitRaw = request.nextUrl.searchParams.get('limit')
    let limit = 500
    if (limitRaw) {
        const n = Number.parseInt(limitRaw, 10)
        if (Number.isFinite(n)) limit = Math.min(1000, Math.max(1, n))
    }

    const { supabase } = gate
    const { data: users, error } = await supabase
        .from('clubtac_users')
        .select(
            'id, telegram_id, first_name, last_name, username, nickname, takoff, userpic, created_at, app_role, status, club_status, player_status, membership_status'
        )
        .eq('is_active', true)
        .order('id', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('GET /api/admin/players:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = users ?? []
    const ids = rows.map((u: { id: number }) => u.id)

    let eloByUserId: Record<
        number,
        { rating?: number | null; games_played?: number | null; place?: number | null }
    > = {}

    if (ids.length > 0) {
        const { data: eloRows, error: eloErr } = await supabase
            .from('clubtac_elo_leaderboard')
            .select('user_id, rating, games_played, place')
            .in('user_id', ids)

        if (eloErr) {
            console.error('GET /api/admin/players elo:', eloErr)
        } else if (eloRows) {
            eloByUserId = Object.fromEntries(
                eloRows.map(
                    (r: {
                        user_id: number
                        rating?: number | null
                        games_played?: number | null
                        place?: number | null
                    }) => [r.user_id, r]
                )
            )
        }
    }

    const players = rows.map(
        (u: {
            id: number
            telegram_id: number
            first_name?: string | null
            last_name?: string | null
            username?: string | null
            nickname?: string | null
            takoff?: boolean | null
            userpic?: string | null
            created_at?: string | null
            app_role?: string | null
            status?: string | null
            club_status?: string | null
            player_status?: string | null
            membership_status?: string | null
        }) => {
            const elo = eloByUserId[u.id]
            return {
                user_id: u.id,
                telegram_id: u.telegram_id,
                first_name: u.first_name ?? null,
                last_name: u.last_name ?? null,
                username: u.username ?? null,
                nickname: u.nickname ?? null,
                takoff: !!u.takoff,
                userpic: u.userpic ?? null,
                created_at: u.created_at ?? null,
                app_role: u.app_role ?? 'user',
                status: u.status ?? null,
                club_status: u.club_status ?? null,
                player_status: u.player_status ?? null,
                membership_status: u.membership_status ?? null,
                rating: elo?.rating ?? null,
                games_played: elo?.games_played ?? null,
                place: elo?.place ?? null,
            }
        }
    )

    return NextResponse.json({ players })
}
