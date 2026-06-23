export type ClubRow = {
    id: string
    name: string
    /** Название города из clubtac_cities */
    city: string | null
    city_id?: number | null
    slug?: string | null
    is_head?: boolean | null
}

/** Стабильный slug главного клуба (если задан в БД). */
export const DEFAULT_CLUB_SLUG = 'sochi'

/** Города мультиклуба v1 — сопоставление по clubtac_cities.name (регистронезависимо). */
export const PUBLIC_CITY_SLUGS = ['sochi', 'serpukhov', 'moscow'] as const

export type PublicCitySlug = (typeof PUBLIC_CITY_SLUGS)[number]

const CITY_NAME_TO_SLUG: Record<string, PublicCitySlug> = {
    сочи: 'sochi',
    sochi: 'sochi',
    серпухов: 'serpukhov',
    serpukhov: 'serpukhov',
    москва: 'moscow',
    moscow: 'moscow',
}

export function cityNameToSlug(name: string | null | undefined): PublicCitySlug | null {
    if (!name?.trim()) return null
    return CITY_NAME_TO_SLUG[name.trim().toLowerCase()] ?? null
}

export function isPublicMulticlubCityName(name: string | null | undefined): boolean {
    return cityNameToSlug(name) != null
}

export function publicCitySortIndex(cityOrSlug: string | null | undefined): number {
    const fromName = cityNameToSlug(cityOrSlug)
    const slug = fromName ?? (cityOrSlug as PublicCitySlug | null)
    const i = slug ? PUBLIC_CITY_SLUGS.indexOf(slug) : -1
    return i >= 0 ? i : 99
}

export function clubDisplayName(club: Pick<ClubRow, 'name' | 'city'> | null | undefined): string {
    if (!club) return '—'
    return club.city?.trim() || club.name?.trim() || '—'
}
