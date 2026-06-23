import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { clubDisplayName, publicCitySortIndex, type ClubRow } from '@/lib/clubs'

function sortClubs(a: ClubRow, b: ClubRow): number {
    const byCity = publicCitySortIndex(a.city) - publicCitySortIndex(b.city)
    if (byCity !== 0) return byCity
    const bySlug = publicCitySortIndex(a.slug) - publicCitySortIndex(b.slug)
    if (bySlug !== 0) return bySlug
    return clubDisplayName(a).localeCompare(clubDisplayName(b), 'ru')
}

/** Публичный список клубов для onboarding (один на город: Сочи, Серпухов, Москва). */
export async function GET() {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
        .from('clubtac_clubs_public')
        .select('id, name, city, slug, city_id, is_head')

    if (error) {
        console.error('GET /api/clubs view:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const clubs = ([...(data ?? [])] as ClubRow[]).sort(sortClubs)
    return NextResponse.json({ clubs })
}
