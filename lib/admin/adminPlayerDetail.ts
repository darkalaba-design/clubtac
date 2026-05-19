/** Поля clubtac_users, которые показываем в «Анкете» (остальное — в «Доп. полях»). */
export const ADMIN_PLAYER_PROFILE_FIELD_KEYS = [
    'id',
    'telegram_id',
    'username',
    'first_name',
    'last_name',
    'nickname',
    'userpic',
    'takoff',
    'app_role',
    'is_active',
    'referral_code',
    'referred_by_user_id',
    'created_at',
    'updated_at',
    'status',
    'club_status',
    'player_status',
    'membership_status',
] as const

/** Поля, уже показанные в шапке анкеты — не дублировать внизу. */
export const ADMIN_PLAYER_HERO_FIELD_KEYS = new Set<string>([
    ...ADMIN_PLAYER_PROFILE_FIELD_KEYS,
])

/** Не показывать в «Прочие данные» — уже есть в шапке (кнопка Telegram и т.д.). */
const ADMIN_PLAYER_FOOTER_OMIT_KEYS = new Set<string>(['username'])

export type PlayerClubStatus = 'standard' | 'vip' | 'partner'

export type AdminPlayerStatsSummary = {
    place: number | null
    games: number | null
    wins: number | null
    winRate: number | null
    points: number | null
}

function numOrNull(v: unknown): number | null {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

export function resolvePlayerClubStatus(user: Record<string, unknown>): PlayerClubStatus {
    const raw =
        user.status ?? user.club_status ?? user.player_status ?? user.membership_status ?? 'standard'
    const s = String(raw).toLowerCase().trim()
    if (s === 'vip') return 'vip'
    if (s === 'partner') return 'partner'
    return 'standard'
}

export function playerClubStatusLabel(status: PlayerClubStatus): string {
    switch (status) {
        case 'vip':
            return 'VIP'
        case 'partner':
            return 'Partner'
        default:
            return 'Стандарт'
    }
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

export function extractPlayerStatsSummary(detail: AdminPlayerDetailResponse): AdminPlayerStatsSummary {
    const hall = detail.hall_of_fame
    const elo = detail.elo_leaderboard
    const winRaw = hall?.win_rate ?? hall?.winrate ?? hall?.win_percent
    let winRate = numOrNull(winRaw)
    if (winRate != null && winRate <= 1 && winRate > 0) {
        winRate = Math.round(winRate * 100)
    } else if (winRate != null) {
        winRate = Math.round(winRate)
    }

    return {
        place: numOrNull(elo?.place ?? hall?.place),
        games: numOrNull(hall?.games_played ?? hall?.games ?? hall?.total_games ?? elo?.games_played),
        wins: numOrNull(hall?.wins ?? hall?.total_wins),
        winRate,
        points: numOrNull(elo?.rating ?? hall?.points ?? hall?.total_points),
    }
}

export function formatAdminPlayerRegistrationDate(iso: unknown): string {
    if (iso == null) return '—'
    try {
        const d = new Date(String(iso))
        if (Number.isNaN(d.getTime())) return '—'
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
        return '—'
    }
}

export function formatAdminPlayerTelegramName(user: Record<string, unknown>): string | null {
    const first = typeof user.first_name === 'string' ? user.first_name.trim() : ''
    const last = typeof user.last_name === 'string' ? user.last_name.trim() : ''
    const full = [first, last].filter(Boolean).join(' ').trim()
    return full || null
}

/** Поля для блока «остальные данные» внизу анкеты. */
export function getAdminPlayerFooterEntries(detail: AdminPlayerDetailResponse): { key: string; value: unknown }[] {
    const entries: { key: string; value: unknown }[] = []
    const skip = ADMIN_PLAYER_HERO_FIELD_KEYS

    for (const [key, value] of Object.entries(detail.profile_fields)) {
        if (skip.has(key) || ADMIN_PLAYER_FOOTER_OMIT_KEYS.has(key)) continue
        entries.push({ key, value })
    }
    for (const [key, value] of Object.entries(detail.extra_fields)) {
        if (ADMIN_PLAYER_FOOTER_OMIT_KEYS.has(key)) continue
        entries.push({ key, value })
    }

    if (detail.elo_rating) {
        for (const [key, value] of Object.entries(detail.elo_rating)) {
            if (key === 'user_id') continue
            if (detail.elo_leaderboard && key in detail.elo_leaderboard) continue
            entries.push({ key: `elo_ratings.${key}`, value })
        }
    }

    if (detail.hall_of_fame) {
        const statsKeys = new Set(['user_id', 'place', 'games_played', 'games', 'total_games', 'wins', 'total_wins', 'win_rate', 'winrate', 'win_percent', 'points', 'total_points', 'rating', 'nickname'])
        for (const [key, value] of Object.entries(detail.hall_of_fame)) {
            if (statsKeys.has(key)) continue
            entries.push({ key: `hall.${key}`, value })
        }
    }

    return entries
}

/** Подстроки в имени колонки → вкладка «Чат». */
export const ADMIN_PLAYER_CHAT_FIELD_HINTS = ['chat', 'message', 'dialog', 'topic', 'thread'] as const

export const ADMIN_PLAYER_FIELD_LABELS: Record<string, string> = {
    id: 'ID в системе',
    telegram_id: 'Telegram ID',
    username: 'Username в Telegram',
    first_name: 'Имя (Telegram)',
    last_name: 'Фамилия (Telegram)',
    nickname: 'Ник в клубе',
    userpic: 'URL аватара',
    takoff: 'Режим «Такофф»',
    app_role: 'Роль в приложении',
    is_active: 'Аккаунт активен',
    referral_code: 'Реферальный код',
    referred_by_user_id: 'Пригласил (user id)',
    created_at: 'Регистрация',
    updated_at: 'Обновлён',
    status: 'Статус в клубе',
    club_status: 'Статус в клубе',
    player_status: 'Статус в клубе',
    membership_status: 'Статус в клубе',
}

export type AdminPlayerInviterSummary = {
    id: number
    first_name?: string | null
    last_name?: string | null
    nickname?: string | null
    username?: string | null
    telegram_id?: number | null
    display_name: string
}

export type AdminPlayerWalletTransaction = {
    id?: string | number
    amount: number
    type: string
    order_id?: string | null
    event_id?: string | null
    event_title?: string | null
    created_at?: string | null
}

export type AdminPlayerEventParticipation = {
    id: string | number
    event_id: string
    event_title?: string | null
    starts_at?: string | null
    payment_status: string
    price_paid: number | null
    created_at?: string | null
}

export type AdminPlayerDetailResponse = {
    user: Record<string, unknown>
    profile_fields: Record<string, unknown>
    chat_fields: Record<string, unknown>
    extra_fields: Record<string, unknown>
    elo_leaderboard: Record<string, unknown> | null
    elo_rating: Record<string, unknown> | null
    hall_of_fame: Record<string, unknown> | null
    wallet_balance: number
    wallet_transactions: AdminPlayerWalletTransaction[]
    event_participations: AdminPlayerEventParticipation[]
    referral_link: string | null
    invited_count: number
    inviter: AdminPlayerInviterSummary | null
    telegram_links: {
        username_url: string | null
        tg_user_url: string | null
    }
}

export function formatAdminPlayerFieldValue(key: string, value: unknown): string {
    if (value == null) return '—'
    if (typeof value === 'boolean') return value ? 'да' : 'нет'
    if (key === 'created_at' || key === 'updated_at' || key.endsWith('_at')) {
        const s = String(value)
        try {
            const d = new Date(s)
            if (!Number.isNaN(d.getTime())) {
                return d.toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                })
            }
        } catch {
            /* fallthrough */
        }
        return s
    }
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

/** Служебные записи с нулевой суммой не показываем во вкладке «Финансы». */
export function isAdminPlayerZeroFinanceAmount(amount: unknown): boolean {
    if (amount == null) return false
    const n = Number(amount)
    return Number.isFinite(n) && n === 0
}

/** Служебные транзакции с amount = 0 не показываем во вкладке «Финансы». */
export function filterAdminPlayerWalletTransactionsForDisplay<
    T extends { amount?: unknown },
>(walletTransactions: T[]): T[] {
    return walletTransactions.filter((tx) => !isAdminPlayerZeroFinanceAmount(tx.amount))
}

export function walletTransactionTypeLabel(type: string): string {
    switch (type) {
        case 'manual_adjustment':
            return 'Пополнение'
        case 'game_payment':
            return 'Оплата события'
        case 'refund':
            return 'Возврат'
        default:
            return type
    }
}

export function splitUserFieldsForAdmin(user: Record<string, unknown>): {
    profile_fields: Record<string, unknown>
    chat_fields: Record<string, unknown>
    extra_fields: Record<string, unknown>
} {
    const profileSet = new Set<string>(ADMIN_PLAYER_PROFILE_FIELD_KEYS)
    const profile_fields: Record<string, unknown> = {}
    const chat_fields: Record<string, unknown> = {}
    const extra_fields: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(user)) {
        if (profileSet.has(key as (typeof ADMIN_PLAYER_PROFILE_FIELD_KEYS)[number])) {
            profile_fields[key] = value
        } else if (
            ADMIN_PLAYER_CHAT_FIELD_HINTS.some((hint) => key.toLowerCase().includes(hint))
        ) {
            chat_fields[key] = value
        } else {
            extra_fields[key] = value
        }
    }

    return { profile_fields, chat_fields, extra_fields }
}
