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
] as const

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
