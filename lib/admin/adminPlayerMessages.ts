export type AdminMessageSender = 'customer' | 'agent' | 'admin'

export type AdminMessageStatus = 'draft' | 'sent' | 'error'

export type AdminPlayerMessage = {
    id: string
    user_id: number
    message: string
    created_at: string
    sender: AdminMessageSender
    status?: AdminMessageStatus | null
}

export type AdminPlayerMessageSendResponse = {
    message: AdminPlayerMessage
}

/** Первый экран чата — последние N сообщений */
export const ADMIN_CHAT_MESSAGES_INITIAL = 20
/** Подгрузка старых при скролле вверх */
export const ADMIN_CHAT_MESSAGES_OLDER_PAGE = 30

export type AdminPlayerMessagesResponse = {
    messages: AdminPlayerMessage[]
    has_more: boolean
}

const SENDER_VALUES = new Set<AdminMessageSender>(['customer', 'agent', 'admin'])
const STATUS_VALUES = new Set<AdminMessageStatus>(['draft', 'sent', 'error'])

export function parseAdminMessageStatus(raw: unknown): AdminMessageStatus | null {
    if (typeof raw !== 'string') return null
    const s = raw.trim().toLowerCase()
    return STATUS_VALUES.has(s as AdminMessageStatus) ? (s as AdminMessageStatus) : null
}

export function parseAdminMessageSender(raw: unknown): AdminMessageSender | null {
    if (typeof raw !== 'string') return null
    const s = raw.trim().toLowerCase()
    return SENDER_VALUES.has(s as AdminMessageSender) ? (s as AdminMessageSender) : null
}

export function parseAdminPlayerMessageRow(row: Record<string, unknown>): AdminPlayerMessage | null {
    const id = row.id
    if (id == null || id === '') return null

    const user_id = Number(row.user_id)
    if (!Number.isFinite(user_id)) return null

    const sender = parseAdminMessageSender(row.sender)
    if (!sender) return null

    const message = typeof row.message === 'string' ? row.message : String(row.message ?? '')
    const created_at = typeof row.created_at === 'string' ? row.created_at : String(row.created_at ?? '')
    if (!created_at) return null

    const status = parseAdminMessageStatus(row.status)

    return {
        id: String(id),
        user_id,
        message,
        created_at,
        sender,
        ...(status ? { status } : {}),
    }
}

export function sortAdminPlayerMessagesAsc(messages: AdminPlayerMessage[]): AdminPlayerMessage[] {
    return [...messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
}

export function mergeAdminPlayerMessages(
    prev: AdminPlayerMessage[],
    incoming: AdminPlayerMessage[]
): AdminPlayerMessage[] {
    const byId = new Map<string, AdminPlayerMessage>()
    for (const m of prev) byId.set(m.id, m)
    for (const m of incoming) byId.set(m.id, m)
    return sortAdminPlayerMessagesAsc([...byId.values()])
}

export function adminMessageSenderLabel(sender: AdminMessageSender): string {
    switch (sender) {
        case 'customer':
            return 'Пользователь'
        case 'agent':
            return 'Агент'
        case 'admin':
            return 'Админ'
    }
}

/** Короткое время в ленте; при другом дне — дата и время. */
export function formatAdminMessageTime(iso: string, now = new Date()): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'

    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()

    if (sameDay) {
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }

    return d.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function formatAdminMessageDayLabel(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''

    const now = new Date()
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)

    if (diffDays === 0) return 'Сегодня'
    if (diffDays === 1) return 'Вчера'

    return d.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
}

export function dayKeyFromIso(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
