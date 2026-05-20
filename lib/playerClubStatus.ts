export type PlayerClubStatus = 'standard' | 'vip' | 'partner'

export const PLAYER_CLUB_STATUSES: readonly PlayerClubStatus[] = ['standard', 'vip', 'partner']

export function parsePlayerClubStatus(raw: unknown): PlayerClubStatus | null {
    if (raw == null || raw === '') return 'standard'
    const s = String(raw).toLowerCase().trim()
    if (s === 'vip') return 'vip'
    if (s === 'partner') return 'partner'
    if (s === 'standard') return 'standard'
    return null
}

export function resolvePlayerClubStatus(source: { status?: unknown } | Record<string, unknown>): PlayerClubStatus {
    const status = 'status' in source ? source.status : undefined
    return parsePlayerClubStatus(status ?? 'standard') ?? 'standard'
}

export function nextPlayerClubStatus(current: PlayerClubStatus): PlayerClubStatus {
    const i = PLAYER_CLUB_STATUSES.indexOf(current)
    return PLAYER_CLUB_STATUSES[(i + 1) % PLAYER_CLUB_STATUSES.length]
}

export function playerClubStatusChipStyle(status: PlayerClubStatus): {
    backgroundColor: string
    color: string
} {
    switch (status) {
        case 'vip':
            return { backgroundColor: '#EDE7F6', color: '#5E35B1' }
        case 'partner':
            return { backgroundColor: '#FFDF00', color: '#1D1D1B' }
        default:
            return { backgroundColor: '#EBE8E0', color: '#6B6B69' }
    }
}

/** Подписи в админке. */
export function playerClubStatusLabelAdmin(status: PlayerClubStatus): string {
    switch (status) {
        case 'vip':
            return 'VIP'
        case 'partner':
            return 'Partner'
        default:
            return 'Стандарт'
    }
}

/** Подписи на публичном и личном профиле. */
export function playerClubStatusLabelPublic(status: PlayerClubStatus): string {
    switch (status) {
        case 'vip':
            return 'Участник'
        case 'partner':
            return 'Партнер'
        default:
            return 'Гость'
    }
}
