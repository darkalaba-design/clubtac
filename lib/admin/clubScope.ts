import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppRole } from '@/lib/admin/appRole'
import type { AdminActorRow } from '@/lib/admin/requireActor'

export type AdminActorWithClubs = AdminActorRow & {
    club_id: string | null
    admin_club_id: string | null
}

/** root → null (все клубы); admin → admin_club_id. */
export function getActorManagedClubId(actor: AdminActorWithClubs): string | null {
    if (actor.app_role === 'root') return null
    if (actor.app_role === 'admin') return actor.admin_club_id
    return null
}

export function isRootActor(actor: Pick<AdminActorRow, 'app_role'>): boolean {
    return actor.app_role === 'root'
}

export function assertAdminHasManagedClub(actor: AdminActorWithClubs): NextResponse | null {
    if (actor.app_role !== 'admin') return null
    if (!actor.admin_club_id?.trim()) {
        return NextResponse.json(
            { error: 'У admin не назначен клуб управления (admin_club_id). Обратитесь к root.' },
            { status: 403 }
        )
    }
    return null
}

export function assertEventInManagedClub(
    actor: AdminActorWithClubs,
    eventClubId: string | null | undefined
): NextResponse | null {
    const managed = getActorManagedClubId(actor)
    if (!managed) return null
    if (!eventClubId || eventClubId !== managed) {
        return NextResponse.json({ error: 'Нет доступа к событию другого клуба' }, { status: 403 })
    }
    return null
}

export function assertUserInManagedClub(
    actor: AdminActorWithClubs,
    userClubId: string | null | undefined
): NextResponse | null {
    const managed = getActorManagedClubId(actor)
    if (!managed) return null
    if (!userClubId || userClubId !== managed) {
        return NextResponse.json({ error: 'Нет доступа к игроку другого клуба' }, { status: 403 })
    }
    return null
}

export function resolveEventClubIdForCreate(actor: AdminActorWithClubs, requestedClubId: string): string | NextResponse {
    const managed = getActorManagedClubId(actor)
    if (managed) {
        if (requestedClubId && requestedClubId !== managed) {
            return NextResponse.json(
                { error: 'Admin может создавать события только в своём клубе управления' },
                { status: 403 }
            )
        }
        return managed
    }
    return requestedClubId
}

export function canActorAccessBroadcasts(actor: Pick<AdminActorRow, 'app_role'>, broadcastsForAdminsEnabled: boolean): boolean {
    if (actor.app_role === 'root') return true
    return actor.app_role === 'admin' && broadcastsForAdminsEnabled
}

export async function requireEventInManagedClub(
    actor: AdminActorWithClubs,
    supabase: SupabaseClient,
    eventId: string
): Promise<{ ok: true; club_id: string } | { ok: false; response: NextResponse }> {
    const adminClubErr = assertAdminHasManagedClub(actor)
    if (adminClubErr) return { ok: false, response: adminClubErr }

    const { data, error } = await supabase
        .from('clubtac_events')
        .select('club_id')
        .eq('id', eventId)
        .maybeSingle()

    if (error) {
        return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) }
    }
    if (!data) {
        return { ok: false, response: NextResponse.json({ error: 'Событие не найдено' }, { status: 404 }) }
    }

    const clubId = (data as { club_id?: string | null }).club_id
    const denied = assertEventInManagedClub(actor, clubId)
    if (denied) return { ok: false, response: denied }

    return { ok: true, club_id: clubId ?? '' }
}

export async function requireUserInManagedClub(
    actor: AdminActorWithClubs,
    supabase: SupabaseClient,
    userId: number
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
    const adminClubErr = assertAdminHasManagedClub(actor)
    if (adminClubErr) return { ok: false, response: adminClubErr }

    const { data, error } = await supabase
        .from('clubtac_users')
        .select('club_id')
        .eq('id', userId)
        .maybeSingle()

    if (error) {
        return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) }
    }
    if (!data) {
        return { ok: false, response: NextResponse.json({ error: 'Игрок не найден' }, { status: 404 }) }
    }

    const denied = assertUserInManagedClub(actor, (data as { club_id?: string | null }).club_id)
    if (denied) return { ok: false, response: denied }

    return { ok: true }
}
