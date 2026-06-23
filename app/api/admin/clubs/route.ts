import { NextRequest, NextResponse } from 'next/server'
import { requireActor } from '@/lib/admin/requireActor'
import { canManageEvents } from '@/lib/admin/appRole'
import { denyIfOutsideAppAdminAllowlist } from '@/lib/admin/allowlist'
import { publicCitySortIndex } from '@/lib/clubs'

export type AdminClubOption = {
    id: string
    name: string
    city: string | null
    slug?: string | null
}

/** Список клубов для событий и назначения admin (город из clubtac_cities). */
export async function GET(request: NextRequest) {
    const gate = await requireActor(request)
    if (!gate.ok) return gate.response

    const blocked = denyIfOutsideAppAdminAllowlist(gate.actor.telegram_id)
    if (blocked) return blocked

    if (!canManageEvents(gate.actor.app_role)) {
        return NextResponse.json({ error: 'Нужны права admin или root' }, { status: 403 })
    }

    const { supabase } = gate

    const { data, error } = await supabase
        .from('clubtac_clubs_public')
        .select('id, name, city, slug')

    if (!error && data?.length) {
        const clubs = ([...data] as AdminClubOption[]).sort(
            (a, b) => publicCitySortIndex(a.city ?? a.slug) - publicCitySortIndex(b.city ?? b.slug)
        )
        return NextResponse.json({ clubs })
    }

    const { data: fallback, error: fbErr } = await supabase
        .from('clubtac_clubs')
        .select('id, name, slug, is_head, clubtac_cities(name)')
        .eq('is_head', true)
        .order('name', { ascending: true })

    if (fbErr) {
        console.error('GET /api/admin/clubs:', error, fbErr)
        return NextResponse.json({ error: fbErr.message }, { status: 500 })
    }

    const clubs: AdminClubOption[] = (fallback ?? [])
        .map((row) => {
            const r = row as {
                id: string
                name: string
                slug?: string | null
                clubtac_cities?: { name?: string | null } | { name?: string | null }[] | null
            }
            const cityRef = r.clubtac_cities
            const cityName = Array.isArray(cityRef) ? cityRef[0]?.name : cityRef?.name
            return {
                id: r.id,
                name: r.name,
                city: cityName ?? null,
                slug: r.slug ?? null,
            }
        })
        .sort((a, b) => publicCitySortIndex(a.city ?? a.slug) - publicCitySortIndex(b.city ?? b.slug))

    return NextResponse.json({ clubs })
}
